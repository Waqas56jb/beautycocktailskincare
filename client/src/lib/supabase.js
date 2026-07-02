import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only the public anon key belongs in the browser. Realtime is handy for
// streaming new bot messages into an open widget.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
