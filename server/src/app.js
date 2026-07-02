import 'dotenv/config' // loads .env locally; on Vercel, env vars come from the dashboard
import express from 'express'
import cors from 'cors'
import { config } from './config/env.js'
import chatRoutes from './routes/chat.routes.js'
import adminRoutes from './routes/admin.routes.js'
import { notFound, errorHandler } from './middleware/error.js'

// Build the Express app WITHOUT calling listen(), so it can run both as a
// long-lived local server (src/index.js) and as a Vercel serverless function
// (api/index.js).
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

export default app
