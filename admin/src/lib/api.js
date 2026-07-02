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

// Typed helpers for every admin endpoint.
export const adminApi = {
  // dashboard
  stats: () => api.get('/api/dashboard/stats').then((r) => r.data),
  charts: () => api.get('/api/dashboard/charts').then((r) => r.data),

  // leads (chatbot contacts)
  leads: (limit = 200) => api.get('/api/leads', { params: { limit } }).then((r) => r.data.leads),
  updateLead: (id, patch) => api.patch(`/api/leads/${id}`, patch).then((r) => r.data.lead),

  // conversations
  conversations: (limit = 100) =>
    api.get('/api/conversations', { params: { limit } }).then((r) => r.data.conversations),
  messages: (id) => api.get(`/api/conversations/${id}/messages`).then((r) => r.data.messages),

  // staff / admin users
  users: () => api.get('/api/users').then((r) => r.data.users),
  createUser: (body) => api.post('/api/users', body).then((r) => r.data.user),
  setUserPassword: (id, password) =>
    api.patch(`/api/users/${id}/password`, { password }).then((r) => r.data),
  updateUser: (id, patch) => api.patch(`/api/users/${id}`, patch).then((r) => r.data.user),
  deleteUser: (id) => api.delete(`/api/users/${id}`).then((r) => r.data),

  // current admin's own account
  updateMyEmail: (email) => api.patch('/api/users/me/email', { email }).then((r) => r.data),
  updateMyPassword: (password) =>
    api.patch('/api/users/me/password', { password }).then((r) => r.data),

  // training / knowledge
  addKnowledge: (body) => api.post('/api/knowledge', body).then((r) => r.data),
}

// Normalize an axios error into a readable message.
export function apiError(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong'
}
