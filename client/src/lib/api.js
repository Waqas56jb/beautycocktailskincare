import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Non-streaming send (kept as a fallback).
export async function sendMessage({ conversationId, text, visitor }) {
  const { data } = await api.post('/api/chat', { conversationId, text, visitor })
  return data // { conversationId, reply }
}

// Streaming send — reads the SSE token stream and calls onDelta for each chunk
// and onMeta for the final { done, conversationId } / error events. This makes
// the reply appear live, which feels dramatically faster than waiting for the
// whole message.
export async function streamMessage({ conversationId, text, visitor }, { onDelta, onMeta }) {
  const res = await fetch(`${baseURL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, text, visitor }),
  })
  if (!res.ok || !res.body) throw new Error(`stream failed (${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const data = rawEvent
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('')
      if (!data) continue
      let evt
      try {
        evt = JSON.parse(data)
      } catch {
        continue
      }
      if (evt.delta) onDelta(evt.delta)
      if (evt.done || evt.conversationId || evt.error) onMeta(evt)
    }
  }
}
