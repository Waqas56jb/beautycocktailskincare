import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getStats, getCharts } from '../services/dashboard.service.js'

const router = Router()
router.use(requireAuth)

router.get('/stats', async (req, res, next) => {
  try {
    res.json(await getStats())
  } catch (err) {
    next(err)
  }
})

router.get('/charts', async (req, res, next) => {
  try {
    res.json(await getCharts())
  } catch (err) {
    next(err)
  }
})

export default router
