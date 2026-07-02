import express from 'express'
import cors from 'cors'
import { config } from './config/env.js'
import chatRoutes from './routes/chat.routes.js'
import adminRoutes from './routes/admin.routes.js'
import { notFound, errorHandler } from './middleware/error.js'

const app = express()

app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / server-to-server (no Origin header) and configured origins
      if (!origin || config.clientOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`Origin not allowed: ${origin}`))
    },
  }),
)
app.use(express.json({ limit: '1mb' }))

// Health check
app.get('/health', (req, res) => res.json({ ok: true, env: config.nodeEnv }))

// API
app.use('/api/chat', chatRoutes)
app.use('/api', adminRoutes)

// Fallbacks
app.use(notFound)
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`🍸 Martini backend running on http://localhost:${config.port}`)
  console.log(`   Model: ${config.openai.model} | Env: ${config.nodeEnv}`)
})
