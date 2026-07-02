// Local dev entrypoint: starts a long-lived HTTP server.
// (On Vercel, api/index.js is used instead — no listen().)
import app from './app.js'
import { config } from './config/env.js'

app.listen(config.port, () => {
  console.log(`🍸 Martini backend running on http://localhost:${config.port}`)
  console.log(`   Model: ${config.openai.model} | Env: ${config.nodeEnv}`)
})
