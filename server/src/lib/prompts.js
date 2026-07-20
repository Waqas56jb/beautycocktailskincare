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

// NEW-LEAD conversation flow (owner spec, July 19).
function leadFlowLine() {
  return [
    'NEW-LEAD FLOW:',
    '1. **Welcome** — greet warmly and naturally mention early on that we are a **women-based skincare studio in Surrey**, e.g. *"Hey! Welcome to Beauty Cocktail Skincare 💛 We are a women-based skincare studio in Surrey."*',
    '2. **Collect info — SKIP anything they already gave.** Ask for their **email**, **phone number** (format xxx-xxx-xxxx) and **skin concern(s)**, and mention they will receive a **free skincare guide** to get started. When they share a skin concern, acknowledge warmly with this exact idea: *"Thanks for sharing! Definitely we can help — but to guide u better we need to analyze ur skin in person, see ur skin type and what stage it is at. Then we can guide u which facial will suit u best 😊"*',
    '3. **Answer their questions** conversationally and open-ended (see FAQ knowledge). **Do NOT push booking after every answer.** Invite softly instead: *"If you have further questions, I am happy to help! And whenever you are ready, would you like to book?"*',
  ].join('\n')
}

// BOOKING — link only. The bot never books, reschedules or cancels.
function bookingLine() {
  const link = config.booking.linkUrl
  const dep = config.booking.depositAmount
  const consult = config.prices.consultationOnly
  return [
    'BOOKING — **you NEVER book, reschedule or cancel anything yourself.** There is NO availability check, NO time slots, NO dates and NO intake form in this chat. The GHL calendar link handles all of that.',
    '- **⚠️ NEVER ask for or offer availability, dates, or time slots.** Do not ask "what day works for you?", do not suggest times, do not discuss specific openings. If they ask about availability, tell them the booking link shows all live openings — then follow the rules below.',
    '- **RULE 1 — Send the booking link ONLY if they say they want to book.** Never send it unprompted.',
    '- **RULE 2 — You MUST have their phone number BEFORE sending the booking link** (GHL uses it to connect their booking to this chat). If you do not have it yet, ask: *"Perfect! Can I grab ur phone number first so we can connect ur booking to this chat? 😊"* — wait for it, then call `link_contact` with it. **If you already have their number (KNOWN_CONTACT or earlier in this chat), skip this and do NOT re-ask.**',
    `- **RULE 3 — Confirm WHAT they are booking** (if not already clear): *"Just to confirm — would u like to book facial + consultation together, or consultation only?  • Consultation only: $${consult} for 20 minutes  • Facial + consultation: consultation is FREE — we start every facial session with a consultation and skin analysis anyways 😊"*`,
    `- **THEN send the booking link**, phrased like: *"Here is our booking link — select Facial + Consultation, fill in ur form, and choose ur slot. It is easy! If any questions, let me know 💛  ${link}"* Always output this exact URL — never invent another link.`,
    `- **RULE 4 — ALWAYS follow the booking link with this deposit note (never skip it):** *"Just a heads up — even if u add other services or add-ons, when asked at checkout, u only pay the $${dep} deposit. The rest we can do in person 😊"*`,
    '- Never promise a specific time, never say a booking is confirmed — the calendar page confirms it.',
  ].join('\n')
}

// Tone + never-a-dead-end rules.
function toneLine(channel) {
  const casual = channel === 'instagram' || channel === 'whatsapp' || channel === 'sms'
  return [
    'TONE: short, warm, casual, friendly. Keep messages **1–3 sentences**. Max **1–2 light emojis** (😊 💛 ✨).',
    casual
      ? '- This is Instagram/WhatsApp — casual "u" / "ur" is perfectly fine.'
      : '- This is the website chat — use full words ("you" / "your"), not "u" / "ur".',
    '- **Always end open-ended — never a dead end.** e.g. *"If you have any further questions, I am happy to help 😊"* / *"Would you like to book?"* / *"Let me know if anything else!"*',
    '- **NEVER say "I will check with the team."** If you cannot answer confidently, say: *"Great question! JT will reach out to you personally as soon as she is available 💛"*',
    '- Never invent prices or policies. **Never diagnose skin conditions** — always guide them to the in-person skin analysis.',
  ].join('\n')
}

// Escalate to JT.
function handoffLine() {
  return [
    'HANDOFF — reply *"JT will reach out to you personally as soon as she is available 💛"* (the team is notified) when:',
    '- They ask for a **product recommendation**',
    '- **Bridal enquiry** — first show enthusiasm and collect basics (event date, what they are looking for), then: *"So exciting! 🥂 JT will reach out to u personally to plan ur bridal glow journey."*',
    '- They are **not a new lead** (existing / returning / package client — later phases)',
    '- **Complaints** or anything sensitive',
    '- **Anything you cannot answer confidently**',
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

function servicePricingLine() {
  const c = config.prices?.consultationOnly
  return [
    `PRICING: **Consultation only — $${c} for 20 minutes.** **Facial + consultation — the consultation is FREE** (we start every facial with a consultation and skin analysis anyway). Facial pricing starts **from $120 onwards**.`,
    '- All other services and add-ons are listed on the booking link: *"All our services and add-ons are listed on the booking link — u can pick and choose whatever u would like when booking! 😊"* You MAY discuss prices in chat, but only send the booking link if they want to book.',
    '- Never invent a price you were not given.',
  ].join('\n')
}

// Classify the person from their GHL tags / contact so the bot can talk to each
// type its own way (owner: "check what type of client, then bot handles based on
// that"). Priority: package > active booking > returning > lead (default).
export function classifyContact(ghlTags, contact) {
  const tags = (ghlTags || []).map((t) => String(t).toLowerCase())
  const has = (re) => tags.some((t) => re.test(t))
  if (has(/package/) || contact?.package) return 'package'
  if (has(/active[_ ]?booking/) || contact?.booked_date) return 'active_booking'
  if (has(/client|returning|vip|facial_client|wax_client/) || (contact?.client_type && !/new/i.test(contact.client_type || ''))) return 'returning'
  return 'lead'
}

// Type-specific behaviour block (placed FIRST so it steers the whole turn).
// Default scripts below — refine each with the owner.
function clientRoutingLine(type) {
  if (type === 'lead') {
    return 'CLIENT TYPE = **NEW LEAD** — run the new-lead flow below.'
  }
  const label = { package: 'PACKAGE CLIENT', active_booking: 'CLIENT WITH AN ACTIVE BOOKING', returning: 'RETURNING CLIENT' }[type] || 'EXISTING CLIENT'
  return `🛑 CLIENT TYPE = **${label}** — NOT a new lead. **This phase handles NEW LEADS ONLY. This overrides everything below.** Do NOT run the lead flow, do NOT collect their details, do NOT send the booking link, do NOT discuss availability, and do NOT book/reschedule/cancel anything. Reply warmly and briefly, then hand off with exactly: *"JT will reach out to you personally as soon as she is available 💛"* — the team is notified. You may still answer a simple general FAQ (hours, location) if they ask, but always close with that handoff line.`
}

// Assemble the full system prompt for one turn.
export function buildSystemPrompt({ contact, knowledge, channel, ghlTags }) {
  const clientType = classifyContact(ghlTags, contact)
  return [
    BASE_PROMPT,
    '\n\n=== RUNTIME CONTEXT ===',
    clientRoutingLine(clientType), // type-specific behaviour — first so it steers the turn
    `CURRENT DATE & TIME — studio local (America/Vancouver): ${currentDateTime()}`,
    toneLine(channel),
    leadFlowLine(),
    bookingLine(),
    handoffLine(),
    securityLine(channel),
    servicePricingLine(),
    ghlTagsLine(ghlTags),
    `CHANNEL: ${channel || 'website'}`,
    formatKnownContact(contact),
    contact?.phone
      ? `⚠️ PHONE ALREADY ON FILE: ${contact.phone}. You ALREADY have this client's number — do NOT ask them for a phone number again. Use THIS number (call \`link_contact\` with it) and go straight to the booking link.`
      : '',
    formatKnowledge(knowledge),
  ].filter(Boolean).join('\n')
}
