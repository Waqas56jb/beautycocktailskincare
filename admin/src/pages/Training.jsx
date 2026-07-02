const sources = [
  'FAQs',
  'Privacy policy',
  'Facial terms of service',
  'Package terms of service',
  'Prices',
  'Instagram conversation history',
]

export default function Training() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800">Training</h1>
      <p className="mt-1 text-sm text-gray-500">
        Knowledge sources Martini uses to answer. Add documents, prices and
        policies here to update the bot's brain.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sources.map((s) => (
          <div
            key={s}
            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-gray-800">{s}</p>
              <p className="text-xs text-gray-400">Not configured</p>
            </div>
            <button className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700">
              Manage
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
