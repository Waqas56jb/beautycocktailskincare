import { Router } from 'express'
import { handleChat, streamChat } from '../services/chat.service.js'

const router = Router()

// POST /api/chat  — public: full reply at once (used by non-streaming clients)
router.post('/', async (req, res, next) => {
  try {
    const { conversationId, text, visitor, channel } = req.body || {}
    res.json(await handleChat({ conversationId, text, visitor, channel }))
  } catch (err) {
    next(err)
  }
})

// POST /api/chat/stream  — public: streams the reply token-by-token via SSE so
// the widget can render it live (much faster perceived response).
router.post('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  try {
    for await (const evt of streamChat(req.body || {})) {
      res.write(`data: ${JSON.stringify(evt)}\n\n`)
    }
  } catch (err) {
    console.error('stream route error:', err.message)
    res.write(`data: ${JSON.stringify({ error: 'stream_failed' })}\n\n`)
  } finally {
    res.end()
  }
})

export default router
