import { openai } from '../lib/openai.js'
import { config } from '../config/env.js'
import { buildSystemPrompt } from '../lib/prompts.js'
import { searchKnowledge } from './knowledge.service.js'
import { getContact, findOrCreateContact } from './contacts.service.js'
import { extractAndSave } from './extraction.service.js'
import {
  getConversation,
  createConversation,
  addMessage,
  getRecentMessages,
  touchConversation,
} from './conversations.service.js'

const EMPTY_REPLY = "I didn't quite catch that 💛 Could you type your message again?"

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

  const [history, knowledge] = await Promise.all([
    getRecentMessages(conversation.id, config.chat.historyLimit), // last N-message memory
    searchKnowledge(message),
  ])

  const system = buildSystemPrompt({ contact, knowledge, channel })
  return { conversationId: conversation.id, contact, messages: toOpenAIMessages(system, history) }
}

// Non-streaming: returns the full reply at once.
export async function handleChat(args) {
  const prep = await prepareTurn(args)
  if (prep.empty) return { conversationId: prep.conversationId, reply: EMPTY_REPLY }

  let reply
  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: 0.6,
      max_tokens: 600,
      messages: prep.messages,
    })
    reply = completion.choices[0]?.message?.content?.trim() || "I'm here — could you say that again?"
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

  let full = ''
  try {
    const stream = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: 0.6,
      max_tokens: 600,
      stream: true,
      messages: prep.messages,
    })
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      if (delta) {
        full += delta
        yield { delta }
      }
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
