import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Admin auth runs through Supabase Auth. Row-level security on the tables keeps
// data locked to signed-in staff only.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
