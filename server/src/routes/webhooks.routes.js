import { Router } from 'express'
import { config } from '../config/env.js'
import { processMetaWebhook } from '../services/instagram.service.js'
import { processWhatsAppWebhook } from '../services/whatsapp.service.js'
import { handleMissedCall, handleInboundSms } from '../services/sms.service.js'

const router = Router()

// Optional shared-secret check for GHL webhooks (skipped if none configured).
function ghlAuthorized(req) {
  const secret = config.sms.webhookSecret
  if (!secret) return true
  return req.query.secret === secret || req.get('x-webhook-secret') === secret
}

// GET /webhooks/meta — Meta webhook verification handshake.
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token && token === config.meta.verifyToken) {
    return res.status(200).send(challenge)
  }
  return res.sendStatus(403)
})

// POST /webhooks/meta — incoming events. The SAME Meta app + webhook URL delivers
// both Instagram DMs and WhatsApp messages; they have different payload shapes, so
// dispatch by `object`. We process inline then 200 (serverless-safe); Meta
// tolerates a few seconds.
router.post('/meta', async (req, res) => {
  try {
    if (req.body?.object === 'whatsapp_business_account') {
      await processWhatsAppWebhook(req.body)
    } else {
      await processMetaWebhook(req.body) // instagram / messenger
    }
  } catch (err) {
    console.error('meta webhook error:', err.message)
  }
  res.sendStatus(200)
})

// POST /webhooks/ghl/missed-call — fired by a GHL workflow when a call is not
// answered. The bot texts the caller so it can take over the conversation.
router.post('/ghl/missed-call', async (req, res) => {
  if (!ghlAuthorized(req)) return res.sendStatus(403)
  const b = req.body || {}
  const contactId = b.contactId || b.contact_id || b.contact?.id
  const phone = b.phone || b.contact?.phone || b.from
  const callerName = b.first_name || b.full_name || b.name || b.contact?.firstName
  try {
    await handleMissedCall({ phone, ghlContactId: contactId, callerName })
  } catch (err) {
    console.error('missed-call webhook error:', err.message)
  }
  res.sendStatus(200)
})

// POST /webhooks/ghl — inbound SMS (GHL "InboundMessage" event). We reply as the
// bot over text. Outbound echoes and non-SMS message types are ignored.
router.post('/ghl', async (req, res) => {
  if (!ghlAuthorized(req)) return res.sendStatus(403)
  const b = req.body || {}
  const type = b.type || b.messageType || b.message?.type || ''
  const direction = b.direction || b.message?.direction || ''
  const messageType = b.messageType || b.message?.messageType || type
  const isSms = /sms/i.test(messageType)
  const isInbound = direction ? /inbound/i.test(direction) : /inbound/i.test(type)
  if (!isSms || !isInbound) return res.sendStatus(200) // ignore outbound/echoes/other

  const contactId = b.contactId || b.contact_id || b.contact?.id
  const phone = b.phone || b.from || b.contact?.phone
  const text = b.body || b.message?.body || b.message
  try {
    await handleInboundSms({ phone, ghlContactId: contactId, text })
  } catch (err) {
    console.error('ghl sms webhook error:', err.message)
  }
  res.sendStatus(200)
})

export default router
