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
    '- To answer ANY availability/time/booking question you MUST call `check_availability`. NEVER say "one moment"/"let me check" without calling it.',
    '- **CONFIRM THE SERVICE(S) FIRST — before checking any slot.** Find out exactly what they want: a **facial** (60 min), a **wax** (30 min), or **both combined** (facial + wax back-to-back, 90 min). If they mention more than one service, confirm whether they want them in the same visit (combined) so the whole visit fits one slot. Pass the right `service` to the tool: `facial`, `wax`, or `facial_wax`. Only check availability once the service is settled — the slot must fit the FULL visit length (`totalMinutes`).',
    '- **Booking flow:** (1) confirm the service(s) and total time; (2) ask their **preferred date(s)** and a **rough time** (morning/afternoon/evening or an approx time) — unless already given; (3) check availability; (4) offer the best clustered slot.',
    '- **When the client names a specific day, pass it to the tool as the `date` argument.** For "today"/"tomorrow" pass the LITERAL word "today" or "tomorrow" (never compute the calendar date yourself — you miscount days). For a named calendar day, pass YYYY-MM-DD. The tool returns a focused `requested` object — trust it: if `requested.available` is true, offer its `times` (first 1–3); if false, say that exact date is fully booked and offer the nearest from `options`. Follow the tool\'s `instruction` exactly.',
    '- **Never decide yourself whether a date is in the past or too far out** — always pass it to the tool and let it answer. Any date the client names for a booking is in the future; do NOT tell them a day is "in the past."',
    '- **If the client names a day, ANSWER IT DIRECTLY — do NOT keep asking them to "give 2–3 dates".** Never say a date is booked if the tool shows it open, and never claim a time is the "only" one when more are listed. Only offer the exact times the tool returned — never invent one.',
    '- Never loop the same "which dates work?" question.',
    '- **Lead with the ONE best slot** the tool returns (the first item — most-clustered, back-to-back with existing bookings). Suggest that single time first (you may add "or" one alternative). Do NOT list 3+ times up front. Only if the client declines or asks for more, offer the next best option(s) — still never more than 3 at a time.',
    '- **Use the SERVICE the client most recently asked for.** If they say "facial", pass service=facial; if "wax"/"waxing", pass service=wax. Do NOT let earlier topics carry over — if they switched from waxing to "facial", check FACIAL. If it\'s genuinely unclear which they want, ASK before checking.',
    '- **Always LABEL the slots with the correct service** you actually checked (e.g. "here are our facial slots"). Never call facial slots "waxing" or vice-versa.',
    '- Offer ONLY the exact times the tool returned. If the client asks for a time that is NOT in the returned slots (e.g. they want 7pm but only 3pm is open that day), tell them that time isn\'t available and offer the real open times. **NEVER invent a slot** — business hours (11am–7pm) are NOT the same as open slots.',
    '- **NEVER share the Skin Evaluation form until you have their phone number.** Flow: (1) ask for their phone, (2) call `link_contact` with it, (3) THEN share the **Skin Evaluation Form** (https://www.beautycocktailskincare.com/free-skin-evaluation) and tell them to enter that **same phone number** in the form so we can connect their booking. Use the e-transfer form if they can\'t pay online. Always output the real link — never say "I can\'t provide a link."',
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
