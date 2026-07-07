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

// Owner's clustering rule: fill the day with NO gaps. Works purely from GHL's
// real free slots (which already reflect staff availability + bookings + calendar
// rules) — no hardcoded time grid. A "gap" (a jump between consecutive free slots
// bigger than the normal step) means a booking sits there, so the free slots on
// either EDGE of that gap are preferred (cluster next to bookings). On a fully-open
// day (no gaps) we anchor at 12pm. Returns a flat ISO list, best-first, earliest
// day first — the bot offers the top 1–2 and works down.
const NOON = 12 * 60

function minsOfIso(iso) {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

export function clusterSlots(slotsByDay, limit = 40) {
  const ordered = []
  const days = Object.keys(slotsByDay).sort()
  for (const day of days) {
    const pairs = (slotsByDay[day] || [])
      .map((iso) => ({ iso, mins: minsOfIso(iso) }))
      .sort((a, b) => a.mins - b.mins)
    if (!pairs.length) continue

    const mins = pairs.map((p) => p.mins)
    // Normal step between adjacent free slots (smallest consecutive gap).
    let step = 60
    if (mins.length > 1) {
      let mn = Infinity
      for (let i = 1; i < mins.length; i++) mn = Math.min(mn, mins[i] - mins[i - 1])
      step = mn
    }
    // Slots sitting right next to a booked GAP (a jump > step between free slots) —
    // day boundaries (first/last) don't count as bookings.
    const nearGap = new Set()
    for (let i = 0; i < pairs.length; i++) {
      const prevGap = i > 0 && mins[i] - mins[i - 1] > step
      const nextGap = i < pairs.length - 1 && mins[i + 1] - mins[i] > step
      if (prevGap || nextGap) nearGap.add(pairs[i].mins)
    }
    for (const p of pairs) {
      const base = nearGap.has(p.mins) ? 0 : nearGap.size > 0 ? 100000 : 0
      p.score = base + Math.abs(p.mins - NOON) // gap-adjacent first, then noon-ward
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
