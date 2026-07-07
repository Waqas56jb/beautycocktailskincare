import { openai } from '../lib/openai.js'
import { config } from '../config/env.js'
import { buildSystemPrompt } from '../lib/prompts.js'
import { searchKnowledge } from './knowledge.service.js'
import { getContact, findOrCreateContact } from './contacts.service.js'
import { extractAndSave } from './extraction.service.js'
import { checkAvailability } from './booking.service.js'
import { ghlEnabled, getContactTags } from './ghl.service.js'
import {
  getConversation,
  createConversation,
  addMessage,
  getRecentMessages,
  touchConversation,
} from './conversations.service.js'

const EMPTY_REPLY = "I didn't quite catch that 💛 Could you type your message again?"

// Tools the model can call. Only exposed when GHL is connected.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description:
        'Get REAL open appointment slots from the live calendar. Call this whenever the client wants to book or asks about availability/times, once you know the service (facial or wax). Never invent slots — always use this.',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', enum: ['facial', 'wax'], description: 'facial or wax' },
          date: {
            type: 'string',
            description:
              'OPTIONAL. If the client named a specific day, pass it as YYYY-MM-DD (e.g. "2026-07-12"), or the literal "today"/"tomorrow". This returns a focused answer for that day in `requested`. Omit if they have not named a day yet.',
          },
        },
        required: ['service'],
      },
    },
  },
]

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

async function runTool(name, args) {
  if (name === 'check_availability') return checkAvailability(args)
  return { error: 'unknown_tool' }
}

// Map our stored roles to the OpenAI chat roles.
function toOpenAIMessages(system, history) {
  const mapped = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant', // bot/agent -> assistant
    content: m.content,
  }))
  return [{ role: 'system', content: system }, ...mapped]
}

// Shared setup: resolve contact + conversation, persist the user message, gather
// context, and build the OpenAI message list. Used by both the streaming and
// non-streaming paths.
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
    getRecentMessages(conversation.id, config.chat.historyLimit), // last N-message memory
    searchKnowledge(message),
    // Live GHL journey tags (active_package, payment_failed_1/2, deposit_success…)
    contact?.ghl_contact_id && ghlEnabled() ? getContactTags(contact.ghl_contact_id) : Promise.resolve([]),
  ])

  const system = buildSystemPrompt({ contact, knowledge, channel, ghlTags })
  return { conversationId: conversation.id, contact, messages: toOpenAIMessages(system, history) }
}

// Non-streaming: returns the full reply at once (with tool support).
export async function handleChat(args) {
  const prep = await prepareTurn(args)
  if (prep.empty) return { conversationId: prep.conversationId, reply: EMPTY_REPLY }

  const tools = ghlEnabled() ? TOOLS : undefined
  let reply
  try {
    let messages = prep.messages
    let completion = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: 0.6,
      max_tokens: 600,
      messages,
      tools,
    })
    let msg = completion.choices[0]?.message
    // Resolve up to 2 rounds of tool calls.
    for (let round = 0; round < 2 && msg?.tool_calls?.length; round++) {
      const toolMsgs = []
      for (const tc of msg.tool_calls) {
        const result = await runTool(tc.function.name, safeJson(tc.function.arguments))
        toolMsgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }
      messages = [...messages, msg, ...toolMsgs]
      completion = await openai.chat.completions.create({
        model: config.openai.model,
        temperature: 0.6,
        max_tokens: 600,
        messages,
        tools,
      })
      msg = completion.choices[0]?.message
    }
    reply = msg?.content?.trim() || "I'm here — could you say that again?"
    await addMessage(prep.conversationId, 'bot', reply, { model: config.openai.model })
  } catch (err) {
    console.error('OpenAI error:', err.message)
    reply =
      "Sorry, I'm having a little trouble right now — please try again in a moment, or leave your details and our team will follow up. 💛"
    await addMessage(prep.conversationId, 'bot', reply, { error: err.message })
  }

  await touchConversation(prep.conversationId)
  await extractAndSave(prep.conversationId, prep.contact) // persist memory / lead data
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
  let full = ''
  try {
    let messages = prep.messages
    // Up to 2 tool rounds; the final round streams text to the client.
    for (let round = 0; round < 3; round++) {
      const stream = await openai.chat.completions.create({
        model: config.openai.model,
        temperature: 0.6,
        max_tokens: 600,
        stream: true,
        messages,
        tools,
      })
      const toolCalls = []
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          full += delta.content
          yield { delta: delta.content }
        }
        for (const tcd of delta?.tool_calls || []) {
          const i = tcd.index
          toolCalls[i] ||= { id: '', type: 'function', function: { name: '', arguments: '' } }
          if (tcd.id) toolCalls[i].id = tcd.id
          if (tcd.function?.name) toolCalls[i].function.name += tcd.function.name
          if (tcd.function?.arguments) toolCalls[i].function.arguments += tcd.function.arguments
        }
      }
      if (!toolCalls.length) break // final text streamed — done
      // Execute tools, append results, loop to stream the follow-up answer.
      const toolMsgs = []
      for (const tc of toolCalls) {
        const result = await runTool(tc.function.name, safeJson(tc.function.arguments))
        toolMsgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }
      messages = [...messages, { role: 'assistant', content: full || null, tool_calls: toolCalls }, ...toolMsgs]
    }
  } catch (err) {
    console.error('OpenAI stream error:', err.message)
    const fallback =
      "Sorry, I'm having a little trouble right now — please try again in a moment. 💛"
    full = full || fallback
    yield { delta: full ? '' : fallback }
  }

  await addMessage(prep.conversationId, 'bot', full || '…', { model: config.openai.model, streamed: true })
  await touchConversation(prep.conversationId)

  // Tell the client we're done (it has the reply + conversationId) BEFORE the
  // extraction step, so memory persistence never delays the next turn.
  yield { done: true, conversationId: prep.conversationId }
  await extractAndSave(prep.conversationId, prep.contact)
}
