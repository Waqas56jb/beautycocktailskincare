import { useCallback, useRef, useState } from 'react'
import { streamMessage } from '../lib/api'
import { brand } from '../lib/brand'

const WELCOME = {
  id: 'welcome',
  role: 'bot',
  text: brand.chatGreeting,
}

// Conversation state for the widget. The bot reply streams in token-by-token,
// so we append deltas to a placeholder bot message as they arrive.
export function useChat() {
  const [messages, setMessages] = useState([WELCOME])
  const [conversationId, setConversationId] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const botIdRef = useRef(0)

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      setError(null)
      setSending(true)

      const botId = `b-${++botIdRef.current}`
      setMessages((prev) => [
        ...prev,
        { id: `u-${prev.length}`, role: 'user', text: trimmed },
        { id: botId, role: 'bot', text: '' }, // placeholder that fills as it streams
      ])

      const appendToBot = (delta) =>
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: m.text + delta } : m)))

      try {
        await streamMessage(
          { conversationId, text: trimmed },
          {
            onDelta: appendToBot,
            onMeta: (evt) => {
              if (evt.conversationId) setConversationId(evt.conversationId)
              if (evt.error) setError('Something went wrong. Please try again.')
            },
          },
        )
      } catch (err) {
        console.error(err)
        setError('Something went wrong. Please try again.')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId && !m.text
              ? { ...m, text: 'Sorry, something went wrong. Please try again. 💛' }
              : m,
          ),
        )
      } finally {
        setSending(false)
      }
    },
    [conversationId, sending],
  )

  return { messages, send, sending, error }
}
