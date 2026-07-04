import { useChat } from '../hooks/useChat'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import QuickOptions from './QuickOptions'

function ChatScreenContent({ messages, send, sending, error }) {
  const showOptions = messages.filter((m) => m.role === 'user').length === 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList messages={messages} sending={sending}>
        {showOptions && <QuickOptions onPick={send} disabled={sending} />}
      </MessageList>

      {error && <p className="px-5 pb-1 text-xs text-red-500">{error}</p>}

      <MessageInput onSend={send} disabled={sending} />
    </div>
  )
}

function ChatScreenWithHook() {
  const chat = useChat()
  return <ChatScreenContent {...chat} />
}

export default function ChatScreen({ chat }) {
  if (chat) return <ChatScreenContent {...chat} />
  return <ChatScreenWithHook />
}
