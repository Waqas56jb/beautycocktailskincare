import { config } from '../config/env.js'
import { handleChat } from './chat.service.js'
import { findOrCreateChannelConversation } from './conversations.service.js'
import { getContact, updateContact } from './contacts.service.js'

const { graphBase, graphVersion, accessToken } = config.meta
const { phoneNumberId } = config.whatsapp

export function whatsappEnabled() {
  return Boolean(accessToken && phoneNumberId)
}

// Send a WhatsApp text reply via the Cloud API. Free-form text is allowed only
// within 24h of the user's last inbound message — which is always true here,
// since we only ever send in response to an incoming message.
export async function sendWhatsAppMessage(to, text) {
  if (!whatsappEnabled()) {
    console.warn('WhatsApp not configured (token / phoneNumberId) — cannot send')
    return { skipped: true }
  }
  const url = `${graphBase}/${graphVersion}/${phoneNumberId}/messages`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text, preview_url: true },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) console.error('WhatsApp send failed', res.status, JSON.stringify(data))
    return { status: res.status, data }
  } catch (err) {
    console.error('WhatsApp send error:', err.message)
    return { error: err.message }
  }
}

// Resolve (or create) the WhatsApp conversation for a sender, and backfill their
// phone + name so the bot recognises them (identity → GHL tags → the right
// module) and greets by name — mirrors the SMS thread resolver.
async function resolveThread({ from, profileName }) {
  const conversation = await findOrCreateChannelConversation({ channel: 'whatsapp', externalId: from })
  const contact = await getContact(conversation.contact_id)
  const phone = from.startsWith('+') ? from : `+${from}`
  const patch = {}
  if (contact && !contact.phone) patch.phone = phone
  if (contact && profileName && !contact.name) patch.name = profileName
  if (contact && Object.keys(patch).length) await updateContact(contact.id, patch).catch(() => {})
  return { conversation, phone }
}

// Process a WhatsApp Cloud API webhook. Shape (differs from Instagram):
//   entry[].changes[].value.messages[] = [{ from, type, text: { body } }]
//   entry[].changes[].value.contacts[] = [{ profile: { name }, wa_id }]
// `value.statuses` (delivery/read receipts) and non-text messages are ignored.
export async function processWhatsAppWebhook(body) {
  if (!body || !Array.isArray(body.entry)) return { processed: 0 }
  let processed = 0

  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      const value = change.value || {}
      const profileName = value.contacts?.[0]?.profile?.name || null
      for (const msg of value.messages || []) {
        if (msg.type !== 'text') continue // skip media / stickers / reactions for now
        const from = msg.from // sender's WhatsApp number, digits only (no '+')
        const text = (msg.text?.body || '').trim()
        if (!from || !text) continue

        try {
          const { conversation, phone } = await resolveThread({ from, profileName })
          const { reply } = await handleChat({
            conversationId: conversation.id,
            text,
            channel: 'whatsapp',
            visitor: { phone, name: profileName },
          })
          if (reply) await sendWhatsAppMessage(from, reply)
          processed++
        } catch (err) {
          console.error('processWhatsAppWebhook error:', err.message)
        }
      }
    }
  }
  return { processed }
}
