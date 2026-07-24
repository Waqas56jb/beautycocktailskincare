import { handleChat } from './chat.service.js'
import { findOrCreateChannelConversation } from './conversations.service.js'
import { getContact, updateContact } from './contacts.service.js'
import { sendGhlMessage } from './ghl.service.js'

// Map a free-form channel/type string (from GHL) to our internal channel name
// and GHL's outbound `type` code.
function normalizeChannel(raw) {
  const s = String(raw || '').toLowerCase()
  if (/whats/.test(s)) return { channel: 'whatsapp', ghlType: 'WhatsApp' }
  if (/insta|(^|[^a-z])ig([^a-z]|$)/.test(s)) return { channel: 'instagram', ghlType: 'IG' }
  if (/messenger|(^|[^a-z])fb([^a-z]|$)|facebook/.test(s)) return { channel: 'instagram', ghlType: 'FB' }
  if (/sms|text/.test(s)) return { channel: 'sms', ghlType: 'SMS' }
  return { channel: 'whatsapp', ghlType: 'WhatsApp' } // sensible default for this integration
}

// Pull a value from the payload trying several common GHL field spellings, incl.
// a nested customData object (workflow webhooks put mapped fields there).
function pick(body, keys) {
  const cd = body.customData || body.custom_data || {}
  for (const k of keys) {
    const v = body[k] ?? cd[k] ?? body.contact?.[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

// Handle an inbound WhatsApp/Instagram/SMS message that GHL forwarded to us.
// We run it through Martini and send the reply BACK through GHL, which delivers
// it to the customer on the original channel.
export async function handleGhlInbound(body = {}) {
  const contactId = pick(body, ['contactId', 'contact_id', 'id'])
  const text = pick(body, ['message', 'body', 'messageBody', 'message_body', 'text'])
  const phone = pick(body, ['phone', 'phoneNumber'])
  const name = pick(body, ['name', 'first_name', 'firstName', 'full_name', 'fullName'])
  const conversationId = pick(body, ['conversationId', 'conversation_id'])
  const { channel, ghlType } = normalizeChannel(
    pick(body, ['channel', 'messageType', 'message_type', 'type']),
  )

  const message = String(text || '').trim()
  if (!contactId || !message) return { skipped: 'missing_contact_or_message' }

  // Tie this thread to a stable Supabase conversation keyed by the GHL contact,
  // and stamp the GHL contact id so the bot loads their tags (active_booking,
  // package, etc.) and greets returning clients by name.
  const conv = await findOrCreateChannelConversation({ channel, externalId: contactId })
  const contact = await getContact(conv.contact_id)
  const patch = {}
  if (contact && contact.ghl_contact_id !== contactId) patch.ghl_contact_id = contactId
  if (contact && !contact.phone && phone) patch.phone = phone
  if (contact && !contact.name && name) patch.name = name
  if (contact && Object.keys(patch).length) await updateContact(contact.id, patch).catch(() => {})

  const { reply } = await handleChat({ conversationId: conv.id, text: message, channel })
  if (reply) await sendGhlMessage({ contactId, conversationId, message: reply, type: ghlType })

  return { replied: Boolean(reply), channel, conversationId: conv.id }
}
