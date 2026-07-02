import { useCallback, useState } from 'react'
import { sendMessage } from '../lib/api'
import { brand } from '../lib/brand'

const WELCOME = {
  id: 'welcome',
  role: 'bot',
  text: brand.chatGreeting,
}

// Minimal conversation state for the widget. The server owns the real
// conversation memory; we just track what to render and the conversationId.
export function useChat() {
  const [messages, setMessages] = useState([WELCOME])
  const [conversationId, setConversationId] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      setError(null)
      setSending(true)
      setMessages((prev) => [
        ...prev,
        { id: `u-${prev.length}`, role: 'user', text: trimmed },
      ])

      try {
        const res = await sendMessage({ conversationId, text: trimmed })
        if (res.conversationId) setConversationId(res.conversationId)
        setMessages((prev) => [
          ...prev,
          { id: `b-${prev.length}`, role: 'bot', text: res.reply },
        ])
      } catch (err) {
        setError('Something went wrong. Please try again.')
        console.error(err)
      } finally {
        setSending(false)
      }
    },
    [conversationId, sending],
  )

  return { messages, send, sending, error }
}
