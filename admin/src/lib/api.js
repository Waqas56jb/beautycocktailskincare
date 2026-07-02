import axios from 'axios'
import { supabase } from './supabase'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach the Supabase access token so the backend can authorize admin calls.
api.interceptors.request.use(async (config) => {
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  }
  return config
})
