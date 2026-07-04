import { config } from '../config/env.js'
import { handleChat } from './chat.service.js'
import { findOrCreateChannelConversation } from './conversations.service.js'

const { graphBase, graphVersion, accessToken } = config.meta

// Send a reply back to an Instagram user via the Meta Graph Send API.
export async function sendInstagramMessage(recipientId, text) {
  if (!accessToken) {
    console.warn('META_ACCESS_TOKEN not set — cannot send IG reply')
    return { skipped: true }
  }
  // Instagram messaging sends via the Page/IG account id (fallback to 'me').
  const target = config.meta.accountId || 'me'
  const url = `${graphBase}/${graphVersion}/${target}/messages`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message: { text },
        access_token: accessToken,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) console.error('IG send failed', res.status, JSON.stringify(data))
    return { status: res.status, data }
  } catch (err) {
    console.error('IG send error:', err.message)
    return { error: err.message }
  }
}

// Process a Meta webhook body. For each incoming text DM, run it through Martini
// and send the reply. Ignores echoes, our own messages, and non-text events.
export async function processMetaWebhook(body) {
  if (!body || !Array.isArray(body.entry)) return { processed: 0 }
  let processed = 0

  for (const entry of body.entry) {
    const events = entry.messaging || entry.standby || []
    for (const ev of events) {
      const senderId = ev.sender?.id
      const msg = ev.message
      if (!senderId || !msg) continue
      if (msg.is_echo) continue // our own outbound message echoed back — skip
      if (config.meta.accountId && senderId === config.meta.accountId) continue // from us
      const text = (msg.text || '').trim()
      if (!text) continue // skip stickers / attachments for now

      try {
        const conv = await findOrCreateChannelConversation({ channel: 'instagram', externalId: senderId })
        const { reply } = await handleChat({ conversationId: conv.id, text, channel: 'instagram' })
        if (reply) await sendInstagramMessage(senderId, reply)
        processed++
      } catch (err) {
        console.error('processMetaWebhook error:', err.message)
      }
    }
  }
  return { processed }
}
