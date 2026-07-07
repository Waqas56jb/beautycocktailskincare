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

// Owner's clustering rule: fill the day with NO gaps. Offer free slots that sit
// right next to an existing booking (or, on an empty day, anchor at 12pm), then
// progressively farther slots as fallbacks. Returns a flat ISO list, best-first,
// earliest day first — the bot offers the top 1–2 and works down as they decline.
const OPEN_MIN = 11 * 60 // 11:00
const CLOSE_MIN = 19 * 60 // 19:00
const INTERVAL = 30
const DUR = 60 // service length used to build the possible-start grid

function minsOfIso(iso) {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

export function clusterSlots(slotsByDay, limit = 12) {
  const ordered = []
  const days = Object.keys(slotsByDay).sort()
  for (const day of days) {
    const isos = slotsByDay[day] || []
    const pairs = isos.map((iso) => ({ iso, mins: minsOfIso(iso) }))
    const freeSet = new Set(pairs.map((p) => p.mins))

    // Which business-hour start slots are occupied (booked or blocked)?
    const occupied = []
    for (let t = OPEN_MIN; t + DUR <= CLOSE_MIN; t += INTERVAL) {
      if (!freeSet.has(t)) occupied.push(t)
    }

    for (const p of pairs) {
      p.score = occupied.length
        ? Math.min(...occupied.map((o) => Math.abs(o - p.mins))) // adjacency to a booking
        : Math.abs(p.mins - 12 * 60) // empty day → anchor at noon
    }
    pairs.sort((a, b) => a.score - b.score || a.mins - b.mins)
    for (const p of pairs) ordered.push(p.iso)
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

export async function deleteContact(contactId) {
  return ghlFetch(`/contacts/${contactId}`, { method: 'DELETE' })
}

export const CALENDARS = calendars
