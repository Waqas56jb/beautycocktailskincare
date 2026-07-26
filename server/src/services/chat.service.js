import { openai, textOf } from '../lib/openai.js'
import { config } from '../config/env.js'
import { buildSystemPrompt, classifyContact } from '../lib/prompts.js'
import { searchKnowledge } from './knowledge.service.js'
import { getContact, findOrCreateContact, updateContact } from './contacts.service.js'
import { extractAndSave } from './extraction.service.js'
import { linkContactByPhone, lookupAppointmentByPhone, getUpcomingAppointment } from './booking.service.js'
import { ghlEnabled, getContactTags, getContactByPhone } from './ghl.service.js'
import {
  getConversation,
  createConversation,
  addMessage,
  getRecentMessages,
  touchConversation,
} from './conversations.service.js'

// Debounce window for coalescing rapid consecutive messages on messaging
// channels (WhatsApp/Instagram) so we reply once, to the newest message.
const COALESCE_MS = Number(process.env.COALESCE_MS) || 1500

const EMPTY_REPLY = "I didn't quite catch that 💛 Could you type your message again?"
const ERROR_REPLY =
  "Sorry, I'm having a little trouble right now — please try again in a moment, or leave your details and our team will follow up. 💛"

// Tools the model can call (OpenAI function-calling format). A tool call arrives
// as `message.tool_calls[]` whose `function.arguments` is a JSON STRING — we
// JSON.parse it before dispatching to runTool.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'link_contact',
      description:
        "Connect this chat to the customer's GoHighLevel record using their WhatsApp number, and read back their live booking status (form submitted / deposit paid). Call this when you collect their WhatsApp number before sending the booking link, or when they say they already filled the form/paid but you have no record of it — always ask for their WhatsApp number (not just a 'phone number') and pass it here.",
      parameters: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Their WhatsApp number (the one they will use / used in the form). Always ask for the WhatsApp number specifically.',
          },
          name: { type: 'string', description: 'Their name, if known.' },
          email: { type: 'string', description: 'Their email, if known.' },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_appointment',
      description:
        "Look up a customer's EXISTING/upcoming appointment by their WhatsApp number. Use this ONLY when they explicitly ask about an appointment they already have — 'when is my appointment', 'do I have a booking', 'what time am I booked'. ⚠️ Do NOT use this when they want to MAKE a new booking ('book me', 'I want to book', 'can I book', or 'yes' after you offered to book) — that is a NEW booking: send the booking link instead, do not look anything up. Do not call this repeatedly for the same number. Read-only: it never reschedules or cancels.",
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Their WhatsApp number (the one they booked with). Always ask for the WhatsApp number specifically.' },
        },
        required: ['phone'],
      },
    },
  },
]

async function runTool(name, input = {}, ctx = {}) {
  if (name === 'link_contact')
    return linkContactByPhone({ contact: ctx.contact, phone: input.phone, name: input.name, email: input.email })
  if (name === 'lookup_appointment') return lookupAppointmentByPhone({ phone: input.phone })
  return { error: 'unknown_tool' }
}

// Parse a tool call's JSON-string arguments safely.
function parseArgs(str) {
  try {
    return JSON.parse(str || '{}')
  } catch {
    return {}
  }
}

// Which tools to offer for a channel. On WhatsApp/Instagram the contact is already
// identified via their GHL record and an active-booking client's appointment is
// pre-fetched into the prompt — so NO tools are needed there. Offering them only
// tempts the model to "check form/deposit" or "look up a booking" on a plain
// "Book me", derailing the booking. The website (anonymous visitors) keeps both.
function toolsFor(channel) {
  if (!ghlEnabled()) return undefined
  return channel === 'website' ? TOOLS : undefined
}

// Map stored history to chat messages (role + content). The system prompt is
// prepended separately as a `system` message before each API call.
function toChatMessages(history) {
  return history
    .filter((m) => (m.content || '').trim())
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
}

// Pull the first plausible phone number out of free text (chat history). Matches
// a 10–13 digit run allowing spaces, dashes, dots, brackets and a leading +.
// Used to identify returning / active-booking clients from what they type.
function findPhone(text) {
  const matches = String(text || '').match(/\+?\d[\d\s().-]{8,}\d/g) || []
  for (const m of matches) {
    const digits = m.replace(/\D/g, '')
    if (digits.length >= 10 && digits.length <= 13) return digits
  }
  return null
}

// Shared setup: resolve contact + conversation, persist the user message, gather
// context, and build the system prompt + message list.
async function prepareTurn({ conversationId, text, visitor = {}, channel = 'website' }) {
  const message = String(text || '').trim()
  if (!message) return { empty: true, conversationId: conversationId || null }

  let conversation = conversationId ? await getConversation(conversationId) : null
  let contact = conversation?.contact_id ? await getContact(conversation.contact_id) : null

  if (!contact) contact = await findOrCreateContact({ ...visitor, source: visitor.source || channel })
  if (!conversation) conversation = await createConversation({ contactId: contact?.id, channel })
  else if (!conversation.contact_id && contact) await touchConversation(conversation.id, { contact_id: contact.id })

  await addMessage(conversation.id, 'user', message)

  // ── Rapid-fire coalescing (messaging channels only) ──────────────────────
  // On WhatsApp/Instagram people often fire several messages in a row. Each one
  // arrives as its own webhook and, processed concurrently, they see each other's
  // half-written history and reply to the WRONG message (the "blind/deaf" bug).
  // Fix: after saving the message, wait a short debounce; if a NEWER message has
  // since arrived, bail out — only the newest message replies, and it does so
  // with the full context of everything typed. The website (request/response) is
  // unaffected.
  if (channel !== 'website') {
    await new Promise((r) => setTimeout(r, COALESCE_MS))
    const [newest] = await getRecentMessages(conversation.id, 1)
    if (!newest || newest.role !== 'user' || (newest.content || '').trim() !== message) {
      return { superseded: true, conversationId: conversation.id }
    }
  }

  const history = await getRecentMessages(conversation.id, config.chat.historyLimit)

  // ── Resolve the visitor's GHL identity ───────────────────────────────────
  // A website visitor is anonymous until we know their phone, so a returning /
  // active-booking client would otherwise ALWAYS look like a brand-new lead and
  // get lead answers. The moment we have a phone — passed by the widget, already
  // on the Supabase contact, or typed into the chat (and on WhatsApp the platform
  // gives it) — look them up in GHL, cache the id on the contact, and load their
  // real tags so the correct module runs (active-booking support vs. lead flow).
  let ghlContactId = contact?.ghl_contact_id || null
  if (!ghlContactId && ghlEnabled()) {
    const phone =
      visitor.phone ||
      contact?.phone ||
      findPhone(history.filter((m) => m.role === 'user').map((m) => m.content).join('  '))
    if (phone) {
      const gc = await getContactByPhone(phone)
      if (gc?.id) {
        ghlContactId = gc.id
        const ghlName =
          gc.contactName || [gc.firstName, gc.lastName].filter(Boolean).join(' ').trim() || null
        contact = { ...contact, ghl_contact_id: gc.id, name: contact?.name || ghlName }
        // Cache on the Supabase record so later turns skip the lookup (best-effort).
        updateContact(contact.id, {
          ghl_contact_id: gc.id,
          name: contact.name || ghlName,
          phone: contact.phone || gc.phone || phone,
        }).catch(() => {})
      }
    }
  }

  const [knowledge, ghlTags] = await Promise.all([
    searchKnowledge(message),
    ghlContactId && ghlEnabled() ? getContactTags(ghlContactId) : Promise.resolve([]),
  ])

  // For active-booking clients, pull their upcoming appointment fresh (read-only)
  // so the support module can greet with the date/time + fast-help window.
  let appointment = null
  if (ghlContactId && ghlEnabled() && classifyContact(ghlTags, contact) === 'active_booking') {
    appointment = await getUpcomingAppointment(ghlContactId)
  }

  const system = buildSystemPrompt({ contact, knowledge, channel, ghlTags, appointment })
  const userTexts = history.filter((m) => m.role === 'user').slice(-3).map((m) => m.content).reverse()
  return {
    conversationId: conversation.id,
    contact,
    userTexts,
    system,
    messages: toChatMessages(history),
  }
}

// Run the tool-call loop: returns the final chat-completion response.
// `convo` includes the system message as its first entry.
async function resolveTools(first, { convo, tools, ctx }) {
  let response = first
  let messages = convo
  for (let round = 0; round < 2; round++) {
    const choice = response.choices?.[0]
    if (choice?.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) break
    messages = [...messages, choice.message] // assistant turn carrying the tool_calls
    for (const tc of choice.message.tool_calls) {
      const result = await runTool(tc.function.name, parseArgs(tc.function.arguments), ctx)
      messages = [...messages, { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) }]
    }
    response = await openai.chat.completions.create({
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
      messages,
      tools,
    })
  }
  return response
}

// Non-streaming: returns the full reply at once (with tool support).
export async function handleChat(args) {
  const prep = await prepareTurn(args)
  if (prep.empty) return { conversationId: prep.conversationId, reply: EMPTY_REPLY }
  // Superseded by a newer message in the same burst — stay silent; the newest
  // message's turn sends one reply covering everything.
  if (prep.superseded) return { conversationId: prep.conversationId, reply: null, superseded: true }

  const tools = toolsFor(args.channel || 'website')
  const convo = [{ role: 'system', content: prep.system }, ...prep.messages]
  // Debug: log EXACTLY what goes to the model (set LOG_LLM_IO=1) — the message
  // array (history + latest user turn) + the system-prompt tail.
  if (process.env.LOG_LLM_IO) {
    console.log('\n───── MESSAGES → OPENAI (' + prep.messages.length + ' turns) ─────')
    console.log(JSON.stringify(prep.messages, null, 2))
    console.log('───── SYSTEM PROMPT tail ─────\n' + prep.system.slice(-600) + '\n──────────────────────────────\n')
  }
  let reply
  let errorDetail = null
  try {
    const first = await openai.chat.completions.create({
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
      messages: convo,
      tools,
    })
    const final = await resolveTools(first, {
      convo,
      tools,
      ctx: { contact: prep.contact, conversationId: prep.conversationId, userTexts: prep.userTexts },
    })
    reply = textOf(final) || "I'm here — could you say that again?"
    await addMessage(prep.conversationId, 'bot', reply, { model: config.openai.model })
  } catch (err) {
    console.error('OpenAI error:', err.status, err.message)
    errorDetail = `${err.status || ''} ${err.message || err}`.trim()
    reply = ERROR_REPLY
    await addMessage(prep.conversationId, 'bot', reply, { error: err.message })
  }

  await touchConversation(prep.conversationId)
  await extractAndSave(prep.conversationId, prep.contact)
  return { conversationId: prep.conversationId, reply, error: errorDetail }
}

// Streaming: async generator yielding { delta } tokens, then { done, conversationId }.
export async function* streamChat(args) {
  const prep = await prepareTurn(args)
  if (prep.empty) {
    yield { delta: EMPTY_REPLY }
    yield { done: true, conversationId: prep.conversationId }
    return
  }
  if (prep.superseded) {
    yield { done: true, conversationId: prep.conversationId, superseded: true }
    return
  }

  const tools = toolsFor(args.channel || 'website')
  const ctx = { contact: prep.contact, conversationId: prep.conversationId, userTexts: prep.userTexts }
  let full = ''
  try {
    let convo = [{ role: 'system', content: prep.system }, ...prep.messages]
    // Up to 3 passes: a tool round ends the stream, so we re-stream the follow-up.
    for (let round = 0; round < 3; round++) {
      const stream = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
        messages: convo,
        tools,
        stream: true,
      })
      // OpenAI streams tool calls in fragments (partial `function.arguments`);
      // accumulate them by index alongside any streamed text.
      const toolCalls = []
      let assistantText = ''
      let finish = null
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0]
        if (!choice) continue
        const d = choice.delta || {}
        if (d.content) {
          full += d.content
          assistantText += d.content
          yield { delta: d.content }
        }
        for (const tcd of d.tool_calls || []) {
          const i = tcd.index
          toolCalls[i] ||= { id: '', type: 'function', function: { name: '', arguments: '' } }
          if (tcd.id) toolCalls[i].id = tcd.id
          if (tcd.function?.name) toolCalls[i].function.name += tcd.function.name
          if (tcd.function?.arguments) toolCalls[i].function.arguments += tcd.function.arguments
        }
        if (choice.finish_reason) finish = choice.finish_reason
      }
      if (finish !== 'tool_calls' || !toolCalls.length) break // final text streamed — done

      convo = [...convo, { role: 'assistant', content: assistantText || null, tool_calls: toolCalls }]
      for (const tc of toolCalls) {
        const result = await runTool(tc.function.name, parseArgs(tc.function.arguments), ctx)
        convo = [...convo, { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) }]
      }
    }
  } catch (err) {
    console.error('OpenAI stream error:', err.message)
    if (!full) yield { delta: ERROR_REPLY }
    full = full || ERROR_REPLY
  }

  await addMessage(prep.conversationId, 'bot', full || '…', { model: config.openai.model, streamed: true })
  await touchConversation(prep.conversationId)

  yield { done: true, conversationId: prep.conversationId }
  await extractAndSave(prep.conversationId, prep.contact)
}
