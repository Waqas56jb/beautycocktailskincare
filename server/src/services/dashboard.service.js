import { supabase } from '../lib/supabase.js'

async function count(table, build) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (build) q = build(q)
  const { count: c, error } = await q
  if (error) throw error
  return c || 0
}

export async function getStats() {
  const now = Date.now()
  const weekAgo = new Date(now - 7 * 864e5).toISOString()
  const prevWeek = new Date(now - 14 * 864e5).toISOString()

  const [
    totalLeads,
    newLeads,
    prevNewLeads,
    openConversations,
    booked,
    depositPaid,
    totalConversations,
  ] = await Promise.all([
    count('contacts'),
    count('contacts', (q) => q.gte('created_at', weekAgo)),
    count('contacts', (q) => q.gte('created_at', prevWeek).lt('created_at', weekAgo)),
    count('conversations', (q) => q.eq('status', 'open')),
    count('contacts', (q) => q.not('booked_date', 'is', null)),
    count('contacts', (q) => q.eq('deposit_paid', true)),
    count('conversations'),
  ])

  const conversionRate = totalLeads ? Math.round((booked / totalLeads) * 100) : 0
  const leadsDelta = prevNewLeads ? Math.round(((newLeads - prevNewLeads) / prevNewLeads) * 100) : null

  return {
    totalLeads,
    newLeads,
    leadsDelta, // % vs previous 7 days (null if no baseline)
    openConversations,
    totalConversations,
    booked,
    depositPaid,
    conversionRate,
  }
}

export async function getCharts() {
  const since = new Date(Date.now() - 13 * 864e5) // last 14 days inclusive
  since.setHours(0, 0, 0, 0)

  const [{ data: contacts }, { data: conversations }] = await Promise.all([
    supabase
      .from('contacts')
      .select('created_at, client_type, booked_date, deposit_paid')
      .gte('created_at', since.toISOString()),
    supabase.from('conversations').select('channel, created_at'),
  ])

  // Leads over time — last 14 days, zero-filled
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, label: d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), leads: 0 })
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]))
  for (const c of contacts || []) {
    const key = c.created_at?.slice(0, 10)
    if (dayIndex.has(key)) days[dayIndex.get(key)].leads++
  }

  // Conversations by channel
  const channelMap = {}
  for (const c of conversations || []) channelMap[c.channel] = (channelMap[c.channel] || 0) + 1
  const byChannel = Object.entries(channelMap).map(([channel, value]) => ({ channel, value }))

  // Contacts by client type (all-time within loaded window)
  const { data: allContacts } = await supabase.from('contacts').select('client_type')
  const typeMap = {}
  for (const c of allContacts || []) {
    const t = c.client_type || 'New Lead'
    typeMap[t] = (typeMap[t] || 0) + 1
  }
  const byClientType = Object.entries(typeMap)
    .map(([type, value]) => ({ type, value }))
    .sort((a, b) => b.value - a.value)

  // Booking funnel
  const totalLeads = (allContacts || []).length
  const { count: bookedCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .not('booked_date', 'is', null)
  const { count: depositCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('deposit_paid', true)
  const funnel = [
    { stage: 'Leads', value: totalLeads },
    { stage: 'Booked', value: bookedCount || 0 },
    { stage: 'Deposit Paid', value: depositCount || 0 },
  ]

  return { leadsOverTime: days, byChannel, byClientType, funnel }
}
