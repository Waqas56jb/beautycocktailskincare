// Vercel serverless entrypoint. An Express app is a (req, res) handler, so
// exporting it here lets Vercel invoke it as a serverless function.
import app from '../src/app.js'

export default app
