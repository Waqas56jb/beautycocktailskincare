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
// it to the customer on the SAME channel. `forcedChannel` is set by the
// channel-specific endpoints (/ghl/whatsapp, /ghl/instagram) so the reply always
// goes back on the right channel regardless of what the payload says; when null
// (the generic /ghl/inbound endpoint) we detect the channel from the payload.
export async function handleGhlInbound(body = {}, forcedChannel = null) {
  const contactId = pick(body, ['contactId', 'contact_id', 'id'])
  const text = pick(body, ['message', 'body', 'messageBody', 'message_body', 'text'])
  const phone = pick(body, ['phone', 'phoneNumber'])
  const name = pick(body, ['name', 'first_name', 'firstName', 'full_name', 'fullName'])
  const conversationId = pick(body, ['conversationId', 'conversation_id'])
  const { channel, ghlType } = normalizeChannel(
    forcedChannel || pick(body, ['channel', 'messageType', 'message_type', 'type']),
  )

  const message = String(text || '').trim()

  // Debug: log the RAW payload GHL sent + what we extracted (set LOG_GHL_INBOUND=1),
  // so we can confirm the real user message is arriving in the right field.
  if (process.env.LOG_GHL_INBOUND) {
    console.log('\n═════ GHL INBOUND RAW ═════\n' + JSON.stringify(body, null, 2))
    console.log('extracted →', JSON.stringify({ contactId, message, phone, name, channel: forcedChannel || channel }) + '\n═══════════════════════════')
  }

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

  // Two delivery paths (either works):
  //  1) We push the reply straight to GHL (needs the Conversations Messages scope
  //     on the token). Result is reported in `sent` for debugging.
  //  2) GHL's workflow reads `reply` from THIS response and sends it with a
  //     native "Send Message" action — no extra token scope required.
  let sent = { skipped: 'no_reply' }
  if (reply) {
    sent = await sendGhlMessage({ contactId, conversationId, message: reply, type: ghlType })
    if (sent?.error) console.error('GHL reply send failed:', sent.status, sent.error)
  }

  return { replied: Boolean(reply), reply: reply || null, channel, conversationId: conv.id, sent }
}
