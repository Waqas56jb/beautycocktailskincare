import { useEffect, useState } from 'react'
import { adminApi, apiError } from '../lib/api'
import { Card, PageHeader, Spinner, EmptyState, Badge } from '../components/ui'

export default function Conversations() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  useEffect(() => {
    adminApi
      .conversations()
      .then((c) => {
        setList(c)
        if (c[0]) select(c[0])
      })
      .catch((e) => setError(apiError(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = (c) => {
    setActive(c)
    setLoadingMsgs(true)
    adminApi
      .messages(c.id)
      .then(setMessages)
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoadingMsgs(false))
  }

  if (error) return <p className="text-sm text-[#c0392b]">{error}</p>
  if (!list) return <Spinner label="Loading conversations…" />

  return (
    <div>
      <PageHeader title="Conversations" subtitle={`${list.length} chats across all channels`} />

      <div className="grid h-[calc(100vh-220px)] grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Inbox */}
        <Card className="flex flex-col overflow-hidden">
          <div className="overflow-y-auto">
            {list.length === 0 ? (
              <EmptyState title="No conversations yet" />
            ) : (
              list.map((c) => {
                const name = c.contacts?.name || c.contacts?.phone || c.contacts?.email || 'Guest'
                return (
                  <button
                    key={c.id}
                    onClick={() => select(c)}
                    className={`flex w-full flex-col items-start gap-1 border-b border-black/5 px-4 py-3 text-left transition ${
                      active?.id === c.id ? 'bg-[#6f6433]/8' : 'hover:bg-black/[0.02]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium text-[#1c1a12]">{name}</span>
                      <Badge tone={c.status === 'open' ? 'green' : 'neutral'}>{c.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#a99f7d]">
                      <Badge tone="olive">{c.channel}</Badge>
                      <span>{new Date(c.last_message_at).toLocaleString()}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </Card>

        {/* Thread */}
        <Card className="flex flex-col overflow-hidden lg:col-span-2">
          {!active ? (
            <EmptyState title="Select a conversation" hint="Choose a chat on the left to read the thread." />
          ) : loadingMsgs ? (
            <Spinner label="Loading messages…" />
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'rounded-bl-md bg-[#f1ece1] text-[#2b2820]'
                        : 'rounded-br-md bg-[#4a441f] text-white'
                    }`}
                  >
                    {m.content}
                    <div className={`mt-1 text-[10px] ${m.role === 'user' ? 'text-[#a99f7d]' : 'text-white/50'}`}>
                      {m.role === 'bot' ? 'Martini' : m.role} · {new Date(m.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
