import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from '../config/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = join(__dirname, '..', '..', 'prompts')

// Load behaviour modules 01..19 in order (skip 00 index and 20 examples at
// runtime to save tokens). Cached at boot; restart the server to pick up edits.
function loadModules() {
  const files = readdirSync(PROMPTS_DIR)
    .filter((f) => /^\d{2}_.*\.md$/.test(f))
    .filter((f) => {
      const n = Number(f.slice(0, 2))
      return n >= 1 && n <= 19
    })
    .sort()

  return files
    .map((f) => readFileSync(join(PROMPTS_DIR, f), 'utf8').trim())
    .join('\n\n---\n\n')
}

const BASE_PROMPT = loadModules()

function formatKnownContact(contact) {
  if (!contact) return 'KNOWN_CONTACT: (none yet — this may be a brand-new visitor)'
  const fields = {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    gender: contact.gender,
    concern: contact.concern,
    package: contact.package,
    membership: contact.membership,
    client_type: contact.client_type,
    tags: contact.tags,
    deposit_paid: contact.deposit_paid,
    booked_date: contact.booked_date,
    conversation_summary: contact.conversation_summary,
  }
  const known = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)),
  )
  return `KNOWN_CONTACT (do NOT re-ask these): ${JSON.stringify(known)}`
}

function formatKnowledge(chunks) {
  if (!chunks || chunks.length === 0) {
    return 'RETRIEVED_KNOWLEDGE: (none matched — answer only from the modules above; if a fact is not documented, say you will confirm — never invent it)'
  }
  const body = chunks
    .map((c, i) => `[${i + 1}] (${c.source}${c.title ? ` · ${c.title}` : ''})\n${c.content}`)
    .join('\n\n')
  return `RETRIEVED_KNOWLEDGE (authoritative — prefer this for facts):\n${body}`
}

// Current date/time in the studio's local timezone (Surrey, BC = Pacific).
// The model has NO inherent sense of "today" — without this it invents a year.
function currentDateTime() {
  const d = new Date()
  const long = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  return `${long}  (ISO: ${iso})`
}

function bookingFormLine() {
  return config.booking.formUrl
    ? `BOOKING_FORM_URL: ${config.booking.formUrl} — when it's time to send the booking/deposit form, share THIS exact URL as a markdown link. Never use any other link.`
    : 'BOOKING_FORM_URL: (none configured) — do NOT invent, output, or link any booking form (no "[Booking Form](#)", no fake URL). When it\'s time for the form, say our team will send the booking + deposit form shortly, and collect their phone/email so we can. Never produce a placeholder or dead link.'
}

function availabilityLine() {
  return config.ghl.apiKey && config.ghl.locationId
    ? 'AVAILABILITY: You HAVE a `check_availability` tool wired to the live calendar. To answer any availability/booking/time question you MUST call it (service = facial or wax) and present the real slots. NEVER say "one moment please", "let me check", or "I\'ll get back to you" without calling the tool — that is a failure.'
    : 'AVAILABILITY: No live calendar is connected right now. Do NOT say "one moment please" / "let me check" / "I\'ll get back to you" and then go silent. Instead, ask for their preferred date and tell them our team will confirm the exact open time shortly, then continue collecting phone / consultation-vs-facial.'
}

// Assemble the full system prompt for one turn.
export function buildSystemPrompt({ contact, knowledge, channel }) {
  return [
    BASE_PROMPT,
    '\n\n=== RUNTIME CONTEXT ===',
    `CURRENT DATE & TIME — studio local (America/Vancouver): ${currentDateTime()}`,
    'Treat the above as "today" for ALL scheduling. Never guess the year or invent a week range — compute "this week"/"next week" from it. Booking dates are naturally in the future; never tell a client a future date is invalid unless it is in the PAST relative to today.',
    availabilityLine(),
    bookingFormLine(),
    `CHANNEL: ${channel || 'website'}`,
    formatKnownContact(contact),
    formatKnowledge(knowledge),
  ].join('\n')
}
