import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Send a visitor message to the backend, which runs it through the AI flow
// (Martini) and returns the bot's reply. `conversationId` keeps memory/context
// on the server so the bot doesn't re-ask for details it already has.
export async function sendMessage({ conversationId, text, visitor }) {
  const { data } = await api.post('/api/chat', {
    conversationId,
    text,
    visitor,
  })
  return data // { conversationId, reply, messages? }
}
