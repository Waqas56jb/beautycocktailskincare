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

// Cluster slots per the owner's rules: start from 12pm; prefer slots closest to
// noon / to existing bookings so there are no long gaps. Returns a flat list of
// ISO times, soonest days first, up to `limit`.
export function clusterSlots(slotsByDay, limit = 6) {
  const noonMinutes = 12 * 60
  const scored = []
  for (const [day, slots] of Object.entries(slotsByDay)) {
    for (const iso of slots) {
      // Read the wall-clock hour/min from the slot's OWN timezone (the offset in
      // the ISO string), not the server's timezone.
      const m = iso.match(/T(\d{2}):(\d{2})/)
      const mins = m ? Number(m[1]) * 60 + Number(m[2]) : 0
      // distance from noon → prefer noon-ward slots first (owner rule)
      scored.push({ iso, day, distance: Math.abs(mins - noonMinutes) })
    }
  }
  scored.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.distance - b.distance))
  return scored.slice(0, limit).map((s) => s.iso)
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
