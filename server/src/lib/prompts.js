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
  const on = config.ghl.apiKey && config.ghl.locationId
  if (!on) {
    return 'AVAILABILITY: No live calendar is connected right now. Do NOT say "one moment please" / "let me check" then go silent. Ask for their preferred date and say our team will confirm the exact open time shortly.'
  }
  return [
    'AVAILABILITY & BOOKING (live calendar via `check_availability` tool):',
    '- To answer ANY availability/time/booking question you MUST call `check_availability` (service = facial or wax). NEVER say "one moment"/"let me check" without calling it.',
    '- **Offer only the FIRST 1–2 options** the tool returns (they are ordered to avoid gaps between bookings — most-clustered first). Do NOT dump the whole list. If the client declines, offer the NEXT 1–2, and so on. Only fall back to farther/odd times after the close ones are declined.',
    '- **Use the SERVICE the client most recently asked for.** If they say "facial", pass service=facial; if "wax"/"waxing", pass service=wax. Do NOT let earlier topics carry over — if they switched from waxing to "facial", check FACIAL. If it\'s genuinely unclear which they want, ASK before checking.',
    '- **Always LABEL the slots with the correct service** you actually checked (e.g. "here are our facial slots"). Never call facial slots "waxing" or vice-versa.',
    '- Offer ONLY the exact times the tool returned. If the client asks for a time that is NOT in the returned slots (e.g. they want 7pm but only 3pm is open that day), tell them that time isn\'t available and offer the real open times. **NEVER invent a slot** — business hours (11am–7pm) are NOT the same as open slots.',
    '- After they pick a REAL slot and give their phone, send the **Skin Evaluation Form** link exactly as in the templates (https://www.beautycocktailskincare.com/free-skin-evaluation), or the e-transfer form if they can\'t pay online. Always output the real link — never say "I can\'t provide a link."',
    '- **Never imply it is booked** — avoid "you\'re all set"/"booked"/"confirmed"/"tentatively"/"lock in"/"see you soon" until the Skin Evaluation form is filled AND the $50 deposit is in (staff types "deposit received"). Say warmly: they\'re booked once the quick form + $50 deposit are done, and that deposit goes toward their session.',
  ].join('\n')
}

function ghlTagsLine(tags) {
  if (!tags || !tags.length) return 'GHL_TAGS: (none) — treat as a new lead.'
  return [
    `GHL_TAGS (this contact's live journey tags): ${tags.join(', ')}`,
    '- If `active_package` is present → PACKAGE client: the payment/deposit/cancel/reschedule deposit rules below do NOT apply to them; help them book their package sessions.',
    '- `payment_deposit_success` = their $50 deposit is confirmed. Booking needs this PLUS a form tag (`tag_skin form submitted` or the etransfer version).',
    '- `payment_failed_1` = their online payment failed once → warmly ask them to try the form/payment again.',
    '- `payment_failed_2` = failed twice → offer **e-transfer** instead: send the e-transfer Skin Evaluation Form and the e-transfer details.',
    '- `client` / `tag_facial_client` / `tag_wax_client` = a returning client — greet them warmly as someone who has visited before.',
    '- Never claim a booking is done unless `payment_deposit_success` is present (or a staff member typed "deposit received").',
  ].join('\n')
}

function securityLine(channel) {
  if (channel === 'instagram' || channel === 'whatsapp') {
    return 'SECURITY: This is a verified channel (the person is identified by the platform) — you MAY handle reschedule / cancel / booking-status / past-session requests directly.'
  }
  return [
    'SECURITY — this is the WEBSITE (visitor identity is NOT verified). This rule OVERRIDES everything else:',
    '- For ANY request about an EXISTING booking or personal history — reschedule, cancel, "do I have a booking?", deposit/payment status, or past/previous sessions — do NOT look it up, do NOT confirm or deny whether they have a booking, do NOT act on it, and do NOT ask for their phone for this purpose (anyone could know a phone number).',
    '- Instead, ALWAYS redirect them warmly to our verified channels (include BOTH links): "For your security, I can\'t change an existing booking or share personal account details here 💛. Please reach us on WhatsApp or Instagram so our team can verify you and help securely — WhatsApp: https://wa.me/12494964181 · Instagram: https://www.instagram.com/beautycocktail_skincare_surrey"',
    '- **New bookings and general enquiries are perfectly fine here** — proceed normally. This redirect is ONLY for existing-booking changes and personal history.',
  ].join('\n')
}

// Assemble the full system prompt for one turn.
export function buildSystemPrompt({ contact, knowledge, channel, ghlTags }) {
  return [
    BASE_PROMPT,
    '\n\n=== RUNTIME CONTEXT ===',
    `CURRENT DATE & TIME — studio local (America/Vancouver): ${currentDateTime()}`,
    'Treat the above as "today" for ALL scheduling. Never guess the year or invent a week range — compute "this week"/"next week" from it. Booking dates are naturally in the future; never tell a client a future date is invalid unless it is in the PAST relative to today.',
    securityLine(channel),
    availabilityLine(),
    ghlTagsLine(ghlTags),
    `CHANNEL: ${channel || 'website'}`,
    formatKnownContact(contact),
    formatKnowledge(knowledge),
  ].join('\n')
}
