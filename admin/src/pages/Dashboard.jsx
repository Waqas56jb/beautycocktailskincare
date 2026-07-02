const stats = [
  { label: 'New leads (this week)', value: '—' },
  { label: 'Active conversations', value: '—' },
  { label: 'Booked appointments', value: '—' },
  { label: 'Deposit paid', value: '—' },
]

export default function Dashboard() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Overview of Martini's activity across Instagram, WhatsApp and website chat.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-400">
          Charts and recent activity will render here once the backend endpoints
          are wired up.
        </p>
      </div>
    </div>
  )
}
