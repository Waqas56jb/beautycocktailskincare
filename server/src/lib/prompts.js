import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from '../config/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = join(__dirname, '..', '..', 'prompts')

// Studio hours (from the GHL calendar config: open 11:00, close 19:00, daily).
// Stated to clients when they ask for an out-of-hours time.
const BUSINESS_HOURS = '11:00 AM–7:00 PM'

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
    `- **BUSINESS HOURS: ${BUSINESS_HOURS}** (last appointment starts by 7:00 PM). ONLY mention these hours when the client asks for a time that is actually OUTSIDE them (before 11 AM or after 7 PM) — then say e.g. *"We're open ${BUSINESS_HOURS} 💛"* and offer the nearest in-hours time. **If the requested time IS within 11 AM–7 PM, do NOT mention business hours at all** — it's redundant; just check availability and answer. Never say "just to clarify, we're open…" for an in-hours request.`,
    '- To answer ANY availability/time/booking question you MUST call `check_availability`. NEVER say "one moment"/"let me check" without calling it.',
    '- **BOOKING SEQUENCE — follow IN ORDER, and do ONLY ONE step per message. Never dump multiple steps (slot + form + deposit + phone) in a single reply.** Wait for the client to respond before moving to the next step:',
    '   1. **Warm greeting** — women-based studio in Surrey (only for a brand-new chat).',
    '   2. **Confirm their skin concern** (the must-have) and reassure: *"Yes, we can absolutely help with that ❤️"*.',
    '   3. **Agree on date & time** — ask their preferred date(s) + a rough time (morning/afternoon/evening), then check availability and offer the best single slot until they pick one.',
    '   4. **Confirm the service** — confirm it\'s a **facial** (our facial includes a consultation, so it covers both). If they specifically want a standalone consultation instead, present that as the alternative — but lead with the facial (consultation included). Settle facial vs wax vs both here.',
    '   5. **Ask for their phone** (their WhatsApp number) — and STOP; wait for it. Do NOT send the form yet.',
    '   6. **After they give the phone**, call `link_contact`, then send the **Skin Evaluation Form** (one message).',
    '   7. **Then the $50 deposit**, then they\'re booked once both are done.',
    '- **CONFIRM THE SERVICE before checking a slot:** facial (60 min), wax (30 min), or both combined (90 min). Pass the right `service` to the tool (`facial`/`wax`/`facial_wax`) — the slot must fit the FULL visit (`totalMinutes`).',
    '- **When the client names a specific day, pass it to the tool as the `date` argument.** For "today"/"tomorrow" pass the LITERAL word "today" or "tomorrow" (never compute the calendar date yourself — you miscount days). For a named calendar day, pass YYYY-MM-DD. The tool returns a focused `requested` object — trust it: if `requested.available` is true, offer its `times` (first 1–3); if false, say that exact date is fully booked and offer the nearest from `options`. Follow the tool\'s `instruction` exactly.',
    '- **Never decide yourself whether a date is in the past or too far out** — always pass it to the tool and let it answer. Any date the client names for a booking is in the future; do NOT tell them a day is "in the past."',
    '- **If the client names a day, ANSWER IT DIRECTLY — do NOT keep asking them to "give 2–3 dates".** Never say a date is booked if the tool shows it open, and never claim a time is the "only" one when more are listed. Only offer the exact times the tool returned — never invent one.',
    '- Never loop the same "which dates work?" question.',
    '- **Lead with the ONE best slot** the tool returns (the first item — most-clustered, back-to-back with existing bookings). Suggest that single time first (you may add "or" one alternative). Do NOT list 3+ times up front. Only if the client declines or asks for more, offer the next best option(s) — still never more than 3 at a time.',
    '- **Use the SERVICE the client most recently asked for.** If they say "facial", pass service=facial; if "wax"/"waxing", pass service=wax. Do NOT let earlier topics carry over — if they switched from waxing to "facial", check FACIAL. If it\'s genuinely unclear which they want, ASK before checking.',
    '- **Always LABEL the slots with the correct service** you actually checked (e.g. "here are our facial slots"). Never call facial slots "waxing" or vice-versa.',
    '- Offer ONLY the exact times the tool returned. If the client asks for a time that is NOT in the returned slots (e.g. they want 7pm but only 3pm is open that day), tell them that time isn\'t available and offer the real open times. **NEVER invent a slot** — business hours (11am–7pm) are NOT the same as open slots.',
    '- **NEVER share the Skin Evaluation form until you have their phone number, and never in the SAME message as asking for the phone.** Flow: (1) ask for their phone and wait; (2) call `link_contact` with it; (3) in the NEXT message share the **Skin Evaluation Form** (https://www.beautycocktailskincare.com/free-skin-evaluation) and tell them to enter that **same phone number** in the form. Use the e-transfer form if they can\'t pay online. Always output the real link — never say "I can\'t provide a link."',
    '- **If `link_contact` fails or errors, NEVER tell the customer there was a "connection issue", "problem connecting your number", or any technical error.** Just continue smoothly — thank them, send the form, and proceed. Technical hiccups are invisible to the client.',
    '- **When you ask for the phone number, you MUST suggest their WhatsApp number** (we communicate/follow up via WhatsApp). Always phrase it like: *"What\'s the best number to reach you — ideally your **WhatsApp number**? 💛"* Never just ask for "your phone number" without naming WhatsApp.',
    '- **Knowing if the form/deposit came in:** a client\'s form + deposit status lives on their GHL record, matched by phone. You see it from their linked tags or from a `link_contact` result. If a client says they **already filled the form or paid** but you have NO linked record / no form tag for this chat, do NOT guess — ask for the **phone number they used in the form** and call `link_contact` with it to connect this chat to their record, then confirm from the result. If it still isn\'t showing, say it can take a few minutes and the team will confirm — never claim they\'re booked until the deposit shows.',
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
  if (channel === 'instagram' || channel === 'whatsapp' || channel === 'sms') {
    return 'SECURITY: This is a verified channel (the person is identified by their platform account or phone number) — you MAY handle reschedule / cancel / booking-status / past-session requests directly.'
  }
  return [
    'SECURITY — this is the WEBSITE (visitor identity is NOT verified). This rule OVERRIDES everything else:',
    '- For any request about a PRE-EXISTING booking or personal history — reschedule, cancel, "do I have a booking?", "when is my appointment", or past/previous sessions — do NOT look it up, do NOT confirm or deny whether they have a booking, do NOT act on it, and do NOT ask for their phone for this purpose (anyone could know a phone number).',
    '- Instead, ALWAYS redirect them warmly to our verified channels using these EXACT markdown links (compact, clickable — never paste raw long URLs): "For your security, I can\'t change an existing booking or share personal account details here 💛. Please reach us so our team can verify you and help securely — [Message us on WhatsApp](https://wa.me/12494964181) or [Message us on Instagram](https://www.instagram.com/beautycocktail_skincare_surrey)."',
    '- **ALLOWED here — do NOT redirect these:** taking a NEW booking; collecting their phone for a booking in progress; and **when the client says they "filled the form", "submitted the form", "paid", or "sent the deposit"** → this is the active booking flow, NOT a pre-existing booking. Do NOT send the WhatsApp/Instagram redirect for these. Instead ask for the **phone number they used in the form** and call `link_contact` to connect this chat and confirm their status.',
    '- **New bookings and general enquiries are perfectly fine here** — proceed normally. The redirect above is ONLY for CHANGING or LOOKING UP a booking they made earlier (reschedule, cancel, "when/where is my appointment", past sessions).',
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
