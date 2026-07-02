import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import Avatar from './Avatar'

export default function MessageList({ messages, sending, children }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, children])

  return (
    <div className="scroll-slim flex-1 space-y-4 overflow-y-auto px-4 py-5">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#4a441f] px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm">
              {m.text}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex items-end gap-2">
            <Avatar size={34} />
            <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[15px] leading-relaxed text-[#2b2820] shadow-sm ring-1 ring-black/5">
              {m.text ? (
                <div className="md-body">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              ) : (
                <TypingDots />
              )}
            </div>
          </div>
        ),
      )}
      {children}
      <div ref={bottomRef} />
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {['0ms', '150ms', '300ms'].map((d) => (
        <span
          key={d}
          className="h-2 w-2 animate-bounce rounded-full"
          style={{ animationDelay: d, backgroundColor: '#c3b58c' }}
        />
      ))}
    </span>
  )
}
