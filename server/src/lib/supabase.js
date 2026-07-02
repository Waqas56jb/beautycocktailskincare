import { createClient } from '@supabase/supabase-js'
import { config } from '../config/env.js'

// Server-side client using the SECRET key. It bypasses Row Level Security, so it
// must NEVER be exposed to the browser. All DB access goes through here.
export const supabase = createClient(config.supabase.url, config.supabase.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
