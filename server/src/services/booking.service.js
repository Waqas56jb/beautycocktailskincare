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

// Tool the model calls to get REAL open slots, clustered from noon.
export async function checkAvailability({ service = 'facial' } = {}) {
  const cal = service === 'wax' ? CALENDARS.wax : CALENDARS.facial
  if (!ghlEnabled() || !cal) return { available: false, reason: 'calendar_not_connected' }
  try {
    const now = Date.now()
    const end = now + 14 * 864e5
    const slotsByDay = await getFreeSlots(cal, now, end)
    const clustered = clusterSlots(slotsByDay, 40) // ordered best-first (no-gap clustering)
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

    return {
      available: days.length > 0,
      service,
      todayDate: dateLabel(todayStr), // e.g. "Tuesday, July 8"
      tomorrowDate: dateLabel(tomorrowStr), // e.g. "Wednesday, July 9"
      days, // availability per day (with isToday/isTomorrow flags)
      options,
      instruction:
        'Answer the client DIRECTLY — do NOT keep asking them for dates. `todayDate`/`tomorrowDate` are the exact dates; use `days` (each has isToday/isTomorrow) to answer any "today/tomorrow/specific day" question. If the asked day is in `days`, offer its first 1–2 times. If it is NOT in `days`, tell them that day has no openings and offer the nearest 1–2 from `options`. Always use the full `dateLabel` (never write "today/tomorrow" yourself).',
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
