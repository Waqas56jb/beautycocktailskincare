import { Router } from 'express'
import { config } from '../config/env.js'
import { processMetaWebhook } from '../services/instagram.service.js'

const router = Router()

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

// POST /webhooks/meta — incoming Instagram/Messenger events.
// We process inline then 200 (serverless-safe); Meta tolerates a few seconds.
router.post('/meta', async (req, res) => {
  try {
    await processMetaWebhook(req.body)
  } catch (err) {
    console.error('meta webhook error:', err.message)
  }
  res.sendStatus(200)
})

export default router
