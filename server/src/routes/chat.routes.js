import { Router } from 'express'
import { handleChat } from '../services/chat.service.js'

const router = Router()

// POST /api/chat  — public: called by the website widget / IG / WhatsApp bridge
// body: { conversationId?, text, visitor?: { name, phone, email, concern, ... }, channel? }
router.post('/', async (req, res, next) => {
  try {
    const { conversationId, text, visitor, channel } = req.body || {}
    const result = await handleChat({ conversationId, text, visitor, channel })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
