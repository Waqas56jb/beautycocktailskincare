import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  listStaff,
  createStaff,
  updateStaffProfile,
  setStaffPassword,
  deleteStaff,
  updateOwnEmail,
  updateOwnPassword,
} from '../services/users.service.js'

const router = Router()
router.use(requireAuth)

// --- Staff / admin user management ---
router.get('/', async (req, res, next) => {
  try {
    res.json({ users: await listStaff() })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { email, password, full_name, role } = req.body || {}
    res.json({ user: await createStaff({ email, password, full_name, role }) })
  } catch (err) {
    next(err)
  }
})

// --- Current admin's own account (MUST come before the /:id routes so "me"
//     isn't captured as an :id param) ---
router.patch('/me/email', async (req, res, next) => {
  try {
    res.json({ user: await updateOwnEmail(req.user.id, req.body?.email) })
  } catch (err) {
    next(err)
  }
})

router.patch('/me/password', async (req, res, next) => {
  try {
    await updateOwnPassword(req.user.id, req.body?.password)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const { full_name, role } = req.body || {}
    res.json({ user: await updateStaffProfile(req.params.id, { full_name, role }) })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/password', async (req, res, next) => {
  try {
    await setStaffPassword(req.params.id, req.body?.password)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    // guard: don't let an admin delete their own logged-in account
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: "You can't delete your own account while logged in." })
    await deleteStaff(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
