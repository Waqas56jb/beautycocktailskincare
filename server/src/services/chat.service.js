import { openai } from '../lib/openai.js'
import { config } from '../config/env.js'
import { buildSystemPrompt } from '../lib/prompts.js'
import { searchKnowledge } from './knowledge.service.js'
import { getContact, findOrCreateContact } from './contacts.service.js'
import {
  getConversation,
  createConversation,
  addMessage,
  getRecentMessages,
  touchConversation,
} from './conversations.service.js'

// Map our stored roles to the OpenAI chat roles.
function toOpenAIMessages(system, history) {
  const mapped = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant', // bot/agent -> assistant
    content: m.content,
  }))
  return [{ role: 'system', content: system }, ...mapped]
}

/**
 * Handle one inbound chat message end-to-end:
 * resolve contact + conversation → persist user msg → RAG → build prompt →
 * call OpenAI → persist bot msg → return reply.
 */
export async function handleChat({ conversationId, text, visitor = {}, channel = 'website' }) {
  const message = String(text || '').trim()
  // Empty / non-text inbound (e.g. a sticker or blank from IG/WhatsApp): degrade
  // gracefully instead of erroring, so channel bridges never break.
  if (!message) {
    return {
      conversationId: conversationId || null,
      reply: "I didn't quite catch that 💛 Could you type your message again?",
    }
  }

  // 1. Resolve conversation + contact (memory)
  let conversation = conversationId ? await getConversation(conversationId) : null
  let contact = conversation?.contact_id ? await getContact(conversation.contact_id) : null

  if (!contact) {
    contact = await findOrCreateContact({ ...visitor, source: visitor.source || channel })
  }
  if (!conversation) {
    conversation = await createConversation({ contactId: contact?.id, channel })
  } else if (!conversation.contact_id && contact) {
    await touchConversation(conversation.id, { contact_id: contact.id })
  }

  // 2. Persist the visitor's message
  await addMessage(conversation.id, 'user', message)

  // 3. Gather context: history + RAG knowledge
  const [history, knowledge] = await Promise.all([
    getRecentMessages(conversation.id, 20),
    searchKnowledge(message),
  ])

  // 4. Build the system prompt (modules + runtime context) and call the model
  const system = buildSystemPrompt({ contact, knowledge, channel })

  let reply
  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: 0.6,
      max_tokens: 600,
      messages: toOpenAIMessages(system, history),
    })
    reply = completion.choices[0]?.message?.content?.trim() || "I'm here — could you say that again?"

    // 5. Persist the bot reply (+ light metadata)
    await addMessage(conversation.id, 'bot', reply, {
      model: config.openai.model,
      usage: completion.usage,
    })
  } catch (err) {
    console.error('OpenAI error:', err.message)
    reply =
      "Sorry, I'm having a little trouble right now — please try again in a moment, or leave your details and our team will follow up. 💛"
    await addMessage(conversation.id, 'bot', reply, { error: err.message })
  }

  await touchConversation(conversation.id)

  return { conversationId: conversation.id, reply }
}
