import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { listContacts, updateContact } from '../services/contacts.service.js'
import { listConversations, getRecentMessages } from '../services/conversations.service.js'
import { addKnowledge } from '../services/knowledge.service.js'

const router = Router()

// Everything here requires a valid admin session.
router.use(requireAuth)

// --- Leads -----------------------------------------------------------------
router.get('/leads', async (req, res, next) => {
  try {
    res.json({ leads: await listContacts({ limit: Number(req.query.limit) || 100 }) })
  } catch (err) {
    next(err)
  }
})

router.patch('/leads/:id', async (req, res, next) => {
  try {
    res.json({ lead: await updateContact(req.params.id, req.body || {}) })
  } catch (err) {
    next(err)
  }
})

// --- Conversations ---------------------------------------------------------
router.get('/conversations', async (req, res, next) => {
  try {
    res.json({ conversations: await listConversations({ limit: Number(req.query.limit) || 50 }) })
  } catch (err) {
    next(err)
  }
})

router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    res.json({ messages: await getRecentMessages(req.params.id, 200) })
  } catch (err) {
    next(err)
  }
})

// --- Training / knowledge base --------------------------------------------
router.post('/knowledge', async (req, res, next) => {
  try {
    const { source, title, content, metadata } = req.body || {}
    if (!content) return res.status(400).json({ error: 'content is required' })
    res.json({ knowledge: await addKnowledge({ source, title, content, metadata }) })
  } catch (err) {
    next(err)
  }
})

export default router
