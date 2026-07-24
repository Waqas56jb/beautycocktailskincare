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

  // Claude powers the chatbot.
  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
    maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS) || 700,
  },

  // OpenAI is now ONLY used for knowledge-base embeddings (Anthropic has no
  // embeddings API). Optional — if absent/out of credit, RAG turns itself off
  // and the bot answers from its prompt modules instead.
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
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
    // GHL calendar link — the ONLY thing the bot shares when a lead wants to book.
    // The bot never books/reschedules/cancels itself; the calendar handles slots.
    // GHL booking URL for NON-package clients (no active_package tag). Verified 200.
    linkUrl:
      process.env.BOOKING_LINK_URL ||
      'https://api.leadconnectorhq.com/booking/ej7VCpt15dJsoWfLTHgT',
    // $50 deposit taken at checkout on the booking page.
    depositAmount: process.env.DEPOSIT_AMOUNT || '50',
  },

  prices: {
    // Consultation only — $50 for 20 minutes. Facial includes the consultation free.
    consultationOnly: process.env.CONSULTATION_PRICE || '50',
  },

  links: {
    website: 'https://www.beautycocktailskincare.com',
    subscription: 'https://www.beautycocktailskincare.com/subscription',
    instagram: 'https://www.instagram.com/beautycocktail_skincare_surrey',
    waxing: 'https://www.beautycocktailskincare.com/services/waxing',
    directions: 'https://share.google/bB4Qfq9SDT3rb1XYZ',
    bridal: 'https://www.beautycocktailskincare.com/services/make-up---bridal-service',
    offers: 'https://www.beautycocktailskincare.com/services/offers',
    map: 'https://maps.app.goo.gl/xMTnqg5X6gZGmwh47',
    terms: 'https://www.beautycocktailskincare.com/terms-of-service',
    termsPackage: 'https://www.beautycocktailskincare.com/terms-package',
    privacy: 'https://www.beautycocktailskincare.com/privacy-policy',
  },
  studio: {
    phone: '249-496-4181',
    locationShort: '64 Avenue & 120 Street, Surrey',
    // For active-booking clients arriving on the day.
    locationDetail: 'inside the Urban Cave — please enter from the front (Scott Road side)',
  },

  ghl: {
    apiKey: process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || '',
    // Secret GHL sends in the Authorization header when it POSTs inbound
    // WhatsApp/Instagram/SMS messages to /webhooks/ghl/inbound (empty = no auth).
    inboundSecret: process.env.GHL_INBOUND_SECRET || '',
    timezone: process.env.GHL_TIMEZONE || 'America/Vancouver',
    calendars: {
      facial: process.env.GHL_CALENDAR_FACIAL || '',
      wax: process.env.GHL_CALENDAR_WAX || '',
      package: process.env.GHL_CALENDAR_PACKAGE || '',
    },
    base: 'https://services.leadconnectorhq.com',
    version: '2021-07-28',
  },

  sms: {
    // Auto text-back sent when a call comes in and isn't answered (missed-call
    // text-back). Editable via env without a redeploy of logic. "JT" = the owner.
    missedCallMessage:
      process.env.SMS_MISSED_CALL_MESSAGE ||
      "Hi! It looks like JT is unavailable for a call right now 💛 This is Martini from Beauty Cocktail Skincare — I can help you right here over text. What can I do for you?",
    // Optional shared secret to verify GHL/Twilio webhooks (checked if set).
    webhookSecret: process.env.GHL_WEBHOOK_SECRET || '',
  },

  meta: {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    accountId: process.env.META_ACCOUNT_ID || '',
    appId: process.env.META_APP_ID || '',
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    appSecret: process.env.META_APP_SECRET || '',
    graphVersion: process.env.META_GRAPH_VERSION || 'v21.0',
    graphBase: process.env.META_GRAPH_BASE || 'https://graph.facebook.com',
  },

  // WhatsApp Cloud API (same Meta app + access token as IG; different send API).
  whatsapp: {
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    // The WhatsApp number's Phone Number ID — required to send. Messages go to
    // POST /{phoneNumberId}/messages with messaging_product: 'whatsapp'.
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  },
}
