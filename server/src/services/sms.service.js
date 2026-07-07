import { config } from '../config/env.js'
import { handleChat } from './chat.service.js'
import { sendSms, ghlEnabled } from './ghl.service.js'
import { findOrCreateChannelConversation, addMessage } from './conversations.service.js'
import { getContact, updateContact } from './contacts.service.js'

// Resolve (or create) the SMS conversation for a phone number, and make sure the
// Supabase contact carries the phone + GHL contact id (needed to send replies and
// read the client's GHL journey tags). Returns { conversation, contact }.
async function resolveSmsThread({ phone, ghlContactId, name }) {
  const externalId = String(phone || '').trim()
  const conversation = await findOrCreateChannelConversation({ channel: 'sms', externalId })
  const contact = await getContact(conversation.contact_id)

  // Backfill identity so the bot recognises them and can text back via GHL.
  const patch = {}
  if (contact && !contact.phone && externalId) patch.phone = externalId
  if (contact && ghlContactId && contact.ghl_contact_id !== ghlContactId) patch.ghl_contact_id = ghlContactId
  if (contact && name && !contact.name) patch.name = name
  if (Object.keys(patch).length) await updateContact(contact.id, patch)

  return { conversation, contact }
}

// A call came in and wasn't answered → text the caller so the bot can take over.
export async function handleMissedCall({ phone, ghlContactId, callerName } = {}) {
  if (!phone && !ghlContactId) return { skipped: 'no_contact' }
  const message = config.sms.missedCallMessage
  const { conversation } = await resolveSmsThread({ phone, ghlContactId, name: callerName })

  // Log the outbound text so the SMS thread has context for the client's reply.
  await addMessage(conversation.id, 'bot', message, { trigger: 'missed_call' })

  if (ghlEnabled() && ghlContactId) await sendSms({ contactId: ghlContactId, message })
  return { sent: true, conversationId: conversation.id }
}

// An inbound SMS from a (possibly missed-call) caller → run Martini and text back.
export async function handleInboundSms({ phone, ghlContactId, text } = {}) {
  const body = String(text || '').trim()
  if (!body) return { skipped: 'empty' }

  const { conversation } = await resolveSmsThread({ phone, ghlContactId })
  const { reply } = await handleChat({ conversationId: conversation.id, text: body, channel: 'sms' })

  if (reply && ghlEnabled() && ghlContactId) await sendSms({ contactId: ghlContactId, message: reply })
  return { replied: Boolean(reply), conversationId: conversation.id }
}
