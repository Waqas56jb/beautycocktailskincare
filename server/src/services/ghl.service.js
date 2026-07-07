import { config } from '../config/env.js'

const { apiKey, locationId, timezone, base, version, calendars } = config.ghl

function headers() {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: version,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export function ghlEnabled() {
  return Boolean(apiKey && locationId)
}

async function ghlFetch(path, { method = 'GET', body, query } = {}) {
  let url = `${base}${path}`
  if (query) {
    const qs = new URLSearchParams(query).toString()
    url += (path.includes('?') ? '&' : '?') + qs
  }
  const res = await fetch(url, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.message || `GHL ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// ── Availability ───────────────────────────────────────────────────────────
// Returns { 'YYYY-MM-DD': ['ISO', ...] } for the calendar in [startMs, endMs].
export async function getFreeSlots(calendarId, startMs, endMs) {
  const data = await ghlFetch(`/calendars/${calendarId}/free-slots`, {
    query: { startDate: startMs, endDate: endMs, timezone },
  })
  const out = {}
  for (const [day, v] of Object.entries(data)) {
    if (v && Array.isArray(v.slots)) out[day] = v.slots
  }
  return out
}

// Owner's clustering rule (cluster-booking / business optimization). GHL free
// slots are the SOURCE OF TRUTH (they already respect staff hours, breaks and
// existing bookings). On top of that we ORDER the free slots so the ones that sit
// back-to-back against an EXISTING booking come first — grouping appointments,
// leaving no small gaps. We use the REAL bookings (from getAppointments) plus the
// service duration, so a booking at the very start OR end of the day is handled
// correctly (e.g. only 5:30 & 6:30 booked, 1-hr facial → offer 4:30 first, since
// 4:30 + 1hr = 5:30 = the booking). On a fully-open day we anchor near noon.
// Returns a flat ISO list, best-first, earliest day first.
const NOON = 12 * 60

function minsOfIso(iso) {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

// Group flat appointments ([{start,end} epoch ms]) by their studio-local day.
function apptsByPacificDay(appts = [], timezone) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const out = {}
  for (const a of appts) {
    const day = fmt.format(new Date(a.start))
    ;(out[day] ||= []).push(a)
  }
  return out
}

export function clusterSlots(slotsByDay, appts = [], serviceMins = 60, limit = 60) {
  const ordered = []
  const durMs = serviceMins * 60000
  const byDay = apptsByPacificDay(appts, timezone)
  const days = Object.keys(slotsByDay).sort()
  for (const day of days) {
    const slots = (slotsByDay[day] || [])
      .map((iso) => ({ iso, mins: minsOfIso(iso), t: new Date(iso).getTime() }))
      .filter((s) => s.t)
      .sort((a, b) => a.mins - b.mins)
    if (!slots.length) continue

    const dayAppts = byDay[day] || []
    if (dayAppts.length) {
      // Score by relation to real bookings: a slot that ends exactly when a
      // booking starts, or starts exactly when a booking ends, is BACK-TO-BACK
      // (best). Otherwise rank by how close it sits to the nearest booking edge.
      for (const s of slots) {
        const candEnd = s.t + durMs
        const adjacent = dayAppts.some((a) => a.start === candEnd || a.end === s.t)
        let dist = Infinity
        for (const a of dayAppts) {
          dist = Math.min(dist, Math.abs(a.start - candEnd), Math.abs(a.end - s.t))
        }
        s.adjacent = adjacent
        s.dist = dist
      }
      slots.sort((a, b) => (a.adjacent === b.adjacent ? a.dist - b.dist || a.mins - b.mins : a.adjacent ? -1 : 1))
    } else {
      // No bookings that day → anchor near noon (earliest-clustered feel).
      slots.sort((a, b) => Math.abs(a.mins - NOON) - Math.abs(b.mins - NOON) || a.mins - b.mins)
    }
    for (const s of slots) ordered.push(s.iso)
  }
  return ordered.slice(0, limit)
}

// ── Contacts ───────────────────────────────────────────────────────────────
export async function upsertContact({ name, firstName, phone, email, tags = [], customFields }) {
  const body = { locationId }
  if (name) body.name = name
  if (firstName) body.firstName = firstName
  if (phone) body.phone = phone
  if (email) body.email = email
  if (tags.length) body.tags = tags
  if (customFields) body.customFields = customFields
  const data = await ghlFetch('/contacts/upsert', { method: 'POST', body })
  return data.contact || data
}

export async function addTags(contactId, tags = []) {
  if (!tags.length) return
  return ghlFetch(`/contacts/${contactId}/tags`, { method: 'POST', body: { tags } })
}

export async function removeTags(contactId, tags = []) {
  if (!tags.length) return
  return ghlFetch(`/contacts/${contactId}/tags`, { method: 'DELETE', body: { tags } })
}

// Read the contact's current GHL tags (so the bot knows their journey state:
// active_package, payment_failed_1/2, payment_deposit_success, client, etc.).
export async function getContactTags(contactId) {
  try {
    const data = await ghlFetch(`/contacts/${contactId}`)
    return data.contact?.tags || []
  } catch {
    return []
  }
}

export async function addNote(contactId, noteBody) {
  return ghlFetch(`/contacts/${contactId}/notes`, { method: 'POST', body: { body: noteBody } })
}

// ── Appointments ───────────────────────────────────────────────────────────
export async function createAppointment({ calendarId, contactId, startTime, endTime, title, appointmentStatus = 'confirmed' }) {
  const body = { calendarId, locationId, contactId, startTime, title: title || 'Appointment', appointmentStatus, ignoreDateRange: false, toNotify: true }
  if (endTime) body.endTime = endTime
  return ghlFetch('/calendars/events/appointments', { method: 'POST', body })
}

export async function deleteAppointment(eventId) {
  return ghlFetch(`/calendars/events/${eventId}`, { method: 'DELETE' })
}

// Existing booked appointments (start/end epoch ms) — used to enforce the
// "max 3 consecutive bookings" rule.
export async function getAppointments(calendarId, startMs, endMs) {
  try {
    const data = await ghlFetch('/calendars/events', {
      query: { locationId, calendarId, startTime: startMs, endTime: endMs },
    })
    return (data.events || [])
      .map((e) => ({ start: new Date(e.startTime).getTime(), end: new Date(e.endTime).getTime() }))
      .filter((e) => e.start && e.end)
  } catch {
    return []
  }
}

export async function deleteContact(contactId) {
  return ghlFetch(`/contacts/${contactId}`, { method: 'DELETE' })
}

export const CALENDARS = calendars
