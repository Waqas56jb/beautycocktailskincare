import {
  ghlEnabled,
  getFreeSlots,
  clusterSlots,
  upsertContact,
  addNote,
  createAppointment,
  CALENDARS,
} from './ghl.service.js'

const SERVICE_MINUTES = { facial: 60, wax: 30 }
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

// Pacific "today" and "tomorrow" as YYYY-MM-DD, so slot dates are labeled
// correctly (the model must never guess today/tomorrow itself).
function pacificDayRefs() {
  const now = new Date()
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [y, m, d] = todayStr.split('-').map(Number)
  const tmw = new Date(Date.UTC(y, m - 1, d + 1))
  const tomorrowStr = `${tmw.getUTCFullYear()}-${String(tmw.getUTCMonth() + 1).padStart(2, '0')}-${String(tmw.getUTCDate()).padStart(2, '0')}`
  return { todayStr, tomorrowStr }
}

function dateLabel(dayStr, todayStr, tomorrowStr) {
  const [y, m, d] = dayStr.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const base = `${wd}, ${MONTHS[m - 1]} ${d}`
  if (dayStr === todayStr) return `Today (${base})`
  if (dayStr === tomorrowStr) return `Tomorrow (${base})`
  return base
}

// Tool the model calls to get REAL open slots, clustered from noon.
export async function checkAvailability({ service = 'facial' } = {}) {
  const cal = service === 'wax' ? CALENDARS.wax : CALENDARS.facial
  if (!ghlEnabled() || !cal) return { available: false, reason: 'calendar_not_connected' }
  try {
    const now = Date.now()
    const end = now + 14 * 864e5
    const slotsByDay = await getFreeSlots(cal, now, end)
    const clustered = clusterSlots(slotsByDay, 12) // ordered best-first (no-gap clustering)
    const { todayStr, tomorrowStr } = pacificDayRefs()
    // Ordered options, best (most clustered) first. Each carries an exact
    // date label so the bot never has to compute today/tomorrow itself.
    const options = clustered.map((iso) => {
      const { day, label } = fmtTime(iso)
      return { dateLabel: dateLabel(day, todayStr, tomorrowStr), time: label, iso }
    })
    return {
      available: options.length > 0,
      service,
      options,
      instruction:
        'Present slots using each option\'s EXACT `dateLabel` verbatim (e.g. "Tomorrow (Wednesday, Jul 8) at 1:00 PM"). Do NOT recompute today/tomorrow yourself. Offer ONLY the first 1–2 options; if declined, offer the next 1–2. Never list them all at once.',
    }
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
