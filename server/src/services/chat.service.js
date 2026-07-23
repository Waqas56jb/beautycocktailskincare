import { anthropic, textOf } from '../lib/anthropic.js'
import { config } from '../config/env.js'
import { buildSystemPrompt, classifyContact } from '../lib/prompts.js'
import { searchKnowledge } from './knowledge.service.js'
import { getContact, findOrCreateContact } from './contacts.service.js'
import { extractAndSave } from './extraction.service.js'
import { linkContactByPhone, lookupAppointmentByPhone, getUpcomingAppointment } from './booking.service.js'
import { ghlEnabled, getContactTags } from './ghl.service.js'
import {
  getConversation,
  createConversation,
  addMessage,
  getRecentMessages,
  touchConversation,
} from './conversations.service.js'

const EMPTY_REPLY = "I didn't quite catch that 💛 Could you type your message again?"
const ERROR_REPLY =
  "Sorry, I'm having a little trouble right now — please try again in a moment, or leave your details and our team will follow up. 💛"

// Tools Claude can call. Anthropic uses `input_schema` (OpenAI used `parameters`),
// and the tool call arrives as a `tool_use` block whose `input` is already parsed.
const TOOLS = [
  {
    name: 'link_contact',
    description:
      "Connect this chat to the customer's GoHighLevel record using their phone number, and read back their live booking status (form submitted / deposit paid). Call this when you collect their phone before sending the booking link, or when they say they already filled the form/paid but you have no record of it — ask for the phone they used and pass it here.",
    input_schema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'The phone number they will use / used in the form — ideally their WhatsApp number.',
        },
        name: { type: 'string', description: 'Their name, if known.' },
        email: { type: 'string', description: 'Their email, if known.' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'lookup_appointment',
    description:
      "Look up a customer's existing/upcoming appointment by their phone number so you can tell them the date and time right here on the website. Use this whenever they ask 'when is my appointment', 'do I have a booking', 'what time am I booked', or want their appointment details — take the phone number they booked with and pass it here. Read-only: it never reschedules or cancels.",
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'The phone number they booked with.' },
      },
      required: ['phone'],
    },
  },
]

async function runTool(name, input = {}, ctx = {}) {
  if (name === 'link_contact')
    return linkContactByPhone({ contact: ctx.contact, phone: input.phone, name: input.name, email: input.email })
  if (name === 'lookup_appointment') return lookupAppointmentByPhone({ phone: input.phone })
  return { error: 'unknown_tool' }
}

// Map stored history to Anthropic messages. Claude takes the system prompt as a
// SEPARATE parameter (never a message), only knows user/assistant roles, and
// requires the first message to be from the user.
function toAnthropicMessages(history) {
  const mapped = history
    .filter((m) => (m.content || '').trim())
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
  while (mapped.length && mapped[0].role !== 'user') mapped.shift() // must start with user
  return mapped
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

  const [history, knowledge, ghlTags] = await Promise.all([
    getRecentMessages(conversation.id, config.chat.historyLimit),
    searchKnowledge(message),
    contact?.ghl_contact_id && ghlEnabled() ? getContactTags(contact.ghl_contact_id) : Promise.resolve([]),
  ])

  // For active-booking clients, pull their upcoming appointment fresh (read-only)
  // so the support module can greet with the date/time + fast-help window.
  let appointment = null
  if (contact?.ghl_contact_id && ghlEnabled() && classifyContact(ghlTags, contact) === 'active_booking') {
    appointment = await getUpcomingAppointment(contact.ghl_contact_id)
  }

  const system = buildSystemPrompt({ contact, knowledge, channel, ghlTags, appointment })
  const userTexts = history.filter((m) => m.role === 'user').slice(-3).map((m) => m.content).reverse()
  return {
    conversationId: conversation.id,
    contact,
    userTexts,
    system,
    messages: toAnthropicMessages(history),
  }
}

// Run the tool-use loop: returns the final assistant message.
async function resolveTools(first, { system, messages, tools, ctx }) {
  let response = first
  let convo = messages
  for (let round = 0; round < 2 && response.stop_reason === 'tool_use'; round++) {
    const toolUses = response.content.filter((b) => b.type === 'tool_use')
    const results = []
    for (const tu of toolUses) {
      const result = await runTool(tu.name, tu.input, ctx)
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
    }
    convo = [...convo, { role: 'assistant', content: response.content }, { role: 'user', content: results }]
    response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      system,
      messages: convo,
      tools,
    })
  }
  return response
}

// Non-streaming: returns the full reply at once (with tool support).
export async function handleChat(args) {
  const prep = await prepareTurn(args)
  if (prep.empty) return { conversationId: prep.conversationId, reply: EMPTY_REPLY }

  const tools = ghlEnabled() ? TOOLS : undefined
  let reply
  try {
    // NOTE: no `temperature` — Claude Opus 4.7+ rejects sampling params (400).
    const first = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      system: prep.system,
      messages: prep.messages,
      tools,
    })
    const final = await resolveTools(first, {
      system: prep.system,
      messages: prep.messages,
      tools,
      ctx: { contact: prep.contact, conversationId: prep.conversationId, userTexts: prep.userTexts },
    })
    reply = textOf(final) || "I'm here — could you say that again?"
    await addMessage(prep.conversationId, 'bot', reply, { model: config.anthropic.model })
  } catch (err) {
    console.error('Claude error:', err.message)
    reply = ERROR_REPLY
    await addMessage(prep.conversationId, 'bot', reply, { error: err.message })
  }

  await touchConversation(prep.conversationId)
  await extractAndSave(prep.conversationId, prep.contact)
  return { conversationId: prep.conversationId, reply }
}

// Streaming: async generator yielding { delta } tokens, then { done, conversationId }.
export async function* streamChat(args) {
  const prep = await prepareTurn(args)
  if (prep.empty) {
    yield { delta: EMPTY_REPLY }
    yield { done: true, conversationId: prep.conversationId }
    return
  }

  const tools = ghlEnabled() ? TOOLS : undefined
  const ctx = { contact: prep.contact, conversationId: prep.conversationId, userTexts: prep.userTexts }
  let full = ''
  try {
    let convo = prep.messages
    // Up to 3 passes: a tool round ends the stream, so we re-stream the follow-up.
    for (let round = 0; round < 3; round++) {
      const stream = anthropic.messages.stream({
        model: config.anthropic.model,
        max_tokens: config.anthropic.maxTokens,
        system: prep.system,
        messages: convo,
        tools,
      })
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          full += event.delta.text
          yield { delta: event.delta.text }
        }
      }
      const message = await stream.finalMessage()
      if (message.stop_reason !== 'tool_use') break // final text streamed — done

      const results = []
      for (const tu of message.content.filter((b) => b.type === 'tool_use')) {
        const result = await runTool(tu.name, tu.input, ctx)
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
      }
      convo = [...convo, { role: 'assistant', content: message.content }, { role: 'user', content: results }]
    }
  } catch (err) {
    console.error('Claude stream error:', err.message)
    if (!full) yield { delta: ERROR_REPLY }
    full = full || ERROR_REPLY
  }

  await addMessage(prep.conversationId, 'bot', full || '…', { model: config.anthropic.model, streamed: true })
  await touchConversation(prep.conversationId)

  yield { done: true, conversationId: prep.conversationId }
  await extractAndSave(prep.conversationId, prep.contact)
}
