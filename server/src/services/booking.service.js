import {
  ghlEnabled,
  getFreeSlots,
  getAppointments,
  clusterSlots,
  upsertContact,
  addNote,
  createAppointment,
  CALENDARS,
} from './ghl.service.js'

// How many appointments would be back-to-back if `[candStart, candEnd]` is booked?
// (Existing appts whose end === a start chain together.) Owner rule: max 3.
function consecutiveIfBooked(candStart, candEnd, appts) {
  let count = 1
  let curStart = candStart
  let changed = true
  while (changed) {
    changed = false
    for (const a of appts) {
      if (a.end === curStart) { count++; curStart = a.start; changed = true; break }
    }
  }
  let curEnd = candEnd
  changed = true
  while (changed) {
    changed = false
    for (const a of appts) {
      if (a.start === curEnd) { count++; curEnd = a.end; changed = true; break }
    }
  }
  return count
}

const SERVICE_MINUTES = { facial: 60, wax: 30 }
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmtTime(iso) {
  const m = iso.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!m) return { day: '', label: iso }
  const day = m[1]
  let h = Number(m[2])
  const min = m[3]
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = ((h + 11) % 12) + 1
  return { day, iso, label: `${h12}:${min} ${ampm}` }
}

// Full explicit date label only — NO "today/tomorrow" (relative words cause the
// AI to miscount days). Always e.g. "Wednesday, July 9".
function dateLabel(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${wd}, ${MONTHS[m - 1]} ${d}`
}

// Pacific today / tomorrow as YYYY-MM-DD, so the bot can resolve "today/tomorrow"
// without computing dates itself.
function pacificDayRefs() {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m, d] = todayStr.split('-').map(Number)
  const tmw = new Date(Date.UTC(y, m - 1, d + 1))
  const tomorrowStr = `${tmw.getUTCFullYear()}-${String(tmw.getUTCMonth() + 1).padStart(2, '0')}-${String(tmw.getUTCDate()).padStart(2, '0')}`
  return { todayStr, tomorrowStr }
}

// Normalize a model-supplied date (YYYY-MM-DD, 'today', 'tomorrow', or a natural
// date like "July 12") to a YYYY-MM-DD string, or null if unparseable.
function normalizeDate(date, todayStr, tomorrowStr) {
  if (!date) return null
  const s = String(date).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/today/i.test(s)) return todayStr
  if (/tomorrow/i.test(s)) return tomorrowStr
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2})/) // "July 12" / "12 July" handled loosely
  const monthIdx = MONTHS.findIndex((mo) => new RegExp(mo, 'i').test(s))
  if (monthIdx >= 0) {
    const dayNum = m ? Number(m[2].length && /^\d/.test(m[2]) ? m[2] : m[1]) : Number((s.match(/\d{1,2}/) || [])[0])
    if (dayNum) {
      const year = Number(todayStr.slice(0, 4))
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    }
  }
  return null
}

// Tool the model calls to get REAL open slots, clustered from noon.
// `date` (optional) focuses the answer on one day so the model doesn't have to
// scan the whole list (which caused hallucinated / wrong "fully booked" replies).
export async function checkAvailability({ service = 'facial', date } = {}) {
  const cal = service === 'wax' ? CALENDARS.wax : CALENDARS.facial
  if (!ghlEnabled() || !cal) return { available: false, reason: 'calendar_not_connected' }
  try {
    const now = Date.now()
    const end = now + 14 * 864e5
    const [slotsByDay, appts] = await Promise.all([getFreeSlots(cal, now, end), getAppointments(cal, now, end)])
    let clustered = clusterSlots(slotsByDay, 60) // ordered best-first (no-gap clustering)
    // Enforce max 3 consecutive bookings — drop any slot that would create a 4th.
    clustered = clustered.filter((iso) => {
      const s = new Date(iso).getTime()
      return consecutiveIfBooked(s, s + 60 * 60000, appts) <= 3
    })
    const { todayStr, tomorrowStr } = pacificDayRefs()

    // Group the clustered slots by day (clustered order preserved within each day)
    const byDay = new Map()
    for (const iso of clustered) {
      const { day, label } = fmtTime(iso)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day).push(label)
    }
    const days = [...byDay.entries()].map(([date, times]) => ({
      date,
      dateLabel: dateLabel(date),
      isToday: date === todayStr,
      isTomorrow: date === tomorrowStr,
      times: times.slice(0, 3), // top clustered times that day
    }))

    // Flat best-first list (for generic "earliest" asks)
    const options = clustered.slice(0, 12).map((iso) => {
      const { day, label } = fmtTime(iso)
      return { dateLabel: dateLabel(day), time: label }
    })

    const result = {
      available: days.length > 0,
      service,
      todayDate: dateLabel(todayStr), // e.g. "Tuesday, July 8"
      tomorrowDate: dateLabel(tomorrowStr), // e.g. "Wednesday, July 9"
      days, // availability per day (with isToday/isTomorrow flags)
      options,
      instruction:
        'Answer DIRECTLY — never keep asking for dates. EVERY date listed in `days` is OPEN: its `times` are real bookable slots, already ordered best-first — offer the first 1–3 of them (do not reorder, do not dump all). To answer a specific-day question, find that date in `days` and offer its times (filter to the rough time they asked for, e.g. afternoon = 12pm+, if they gave one). A date is unavailable ONLY if it does NOT appear in `days` at all — then say that exact date is fully booked and offer the nearest date from `days`. **NEVER say a date is booked/unavailable if it appears in `days`** (that is a contradiction — do not do it). `todayDate`/`tomorrowDate` are the exact dates for "today"/"tomorrow". Always use the full `dateLabel` verbatim; never write "today/tomorrow" yourself. **Offer ONLY the exact times listed — never invent a time that is not in the data.**',
    }

    // Focused single-day answer when the client named a specific day.
    const target = normalizeDate(date, todayStr, tomorrowStr)
    if (target) {
      const match = days.find((d) => d.date === target)
      const label = /^\d{4}-\d{2}-\d{2}$/.test(target) ? dateLabel(target) : target
      if (match) {
        result.requested = { date: target, dateLabel: label, available: true, times: match.times }
        result.instruction = `The client asked about ${label}. It IS OPEN at these exact times (best-first): ${match.times.join(', ')}. Offer the first 1–3 (if they gave a rough time like "afternoon", offer the ones that fit but never claim it's the "only" time if others are listed). Use "${label}" verbatim. Do NOT say it is booked. Never invent a time not in this list.`
      } else {
        const alt = options.slice(0, 3).map((o) => `${o.dateLabel} ${o.time}`).join('; ')
        result.requested = { date: target, dateLabel: label, available: false }
        result.instruction = `The client asked about ${label}. It has NO open slots — say that exact date (${label}) is fully booked, then offer the nearest real options: ${alt}. Never invent a time.`
      }
    }

    return result
  } catch (e) {
    console.warn('checkAvailability failed:', e.message)
    return { available: false, reason: 'error' }
  }
}

// Sync the contact to GHL (create/update by phone) with tags. Best-effort.
export async function syncContactToGHL({ name, phone, email, concern, tags = [] }) {
  if (!ghlEnabled() || !phone) return null
  try {
    const customFields = []
    const contact = await upsertContact({
      firstName: name,
      phone,
      email,
      tags: tags.length ? tags : ['hot new lead'],
      customFields,
    })
    if (concern && contact?.id) {
      await addNote(contact.id, `Skin concern: ${concern}`).catch(() => {})
    }
    return contact
  } catch (e) {
    console.warn('syncContactToGHL failed:', e.message)
    return null
  }
}

// Create the actual appointment(s) — called after the human confirms "deposit
// received". Handles a facial+wax combination back-to-back (one person).
export async function bookAppointments({ contactId, services }) {
  if (!ghlEnabled() || !contactId) return { booked: false, reason: 'not_connected' }
  const created = []
  let cursor = null
  for (const s of services) {
    const cal = s.service === 'wax' ? CALENDARS.wax : CALENDARS.facial
    const startIso = cursor || s.startIso
    const mins = SERVICE_MINUTES[s.service] || 60
    const endIso = new Date(new Date(startIso).getTime() + mins * 60000).toISOString()
    const appt = await createAppointment({
      calendarId: cal,
      contactId,
      startTime: startIso,
      endTime: endIso,
      title: `${s.service === 'wax' ? 'Wax' : 'Facial'} appointment`,
    })
    created.push({ service: s.service, id: appt.id, startIso, endIso })
    cursor = endIso // next service starts right after (back-to-back, one person)
  }
  return { booked: true, appointments: created }
}
