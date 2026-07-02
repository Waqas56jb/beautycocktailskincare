export default function Conversations() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800">Conversations</h1>
      <p className="mt-1 text-sm text-gray-500">
        Live and past chats across all channels. Staff can review, take over, or
        let Martini continue.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm lg:col-span-1">
          <p className="mb-3 text-xs font-semibold uppercase text-gray-400">
            Inbox
          </p>
          <p className="text-sm text-gray-400">
            Conversation list (GET /api/conversations)
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase text-gray-400">
            Thread
          </p>
          <p className="text-sm text-gray-400">
            Select a conversation to view messages and memory.
          </p>
        </div>
      </div>
    </div>
  )
}
