// Centralized, validated environment config.
// Node loads .env via the --env-file flag in package.json scripts.

function required(name) {
  const value = process.env[name]
  if (!value) {
    // Throw (don't process.exit) so this surfaces as a normal error on Vercel
    // serverless instead of hard-killing the runtime.
    throw new Error(
      `Missing required env var: ${name}. Set it in .env locally or in Vercel → Project → Settings → Environment Variables.`,
    )
  }
  return value
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },

  supabase: {
    url: required('SUPABASE_URL'),
    secretKey: required('SUPABASE_SECRET_KEY'),
  },

  chat: {
    // Short-term memory: how many recent messages are fed back to the model each
    // turn (the "last N prompts" the bot remembers in-conversation).
    historyLimit: Number(process.env.CHAT_HISTORY_LIMIT) || 20,
  },

  booking: {
    // Real GHL booking + deposit form URL. If empty, the bot must NOT invent a
    // link — it says the team will send the form instead.
    formUrl: process.env.BOOKING_FORM_URL || '',
  },

  ghl: {
    apiKey: process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || '',
    timezone: process.env.GHL_TIMEZONE || 'America/Vancouver',
    calendars: {
      facial: process.env.GHL_CALENDAR_FACIAL || '',
      wax: process.env.GHL_CALENDAR_WAX || '',
      package: process.env.GHL_CALENDAR_PACKAGE || '',
    },
    base: 'https://services.leadconnectorhq.com',
    version: '2021-07-28',
  },

  meta: {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    accountId: process.env.META_ACCOUNT_ID || '',
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    appSecret: process.env.META_APP_SECRET || '',
    graphVersion: process.env.META_GRAPH_VERSION || 'v21.0',
    graphBase: process.env.META_GRAPH_BASE || 'https://graph.facebook.com',
  },
}
