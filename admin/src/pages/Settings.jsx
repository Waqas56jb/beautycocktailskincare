const integrations = [
  { name: 'GoHighLevel (GHL)', desc: 'CRM, contacts, booking form & deposit' },
  { name: 'Instagram', desc: 'DM automation for beautycocktail_skincare' },
  { name: 'WhatsApp', desc: 'Business messaging channel' },
  { name: 'Website widget', desc: 'Embed script for the site chat bubble' },
]

export default function Settings() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Connect channels and configure how Martini behaves.
      </p>

      <div className="mt-6 space-y-3">
        {integrations.map((i) => (
          <div
            key={i.name}
            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-gray-800">{i.name}</p>
              <p className="text-xs text-gray-400">{i.desc}</p>
            </div>
            <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
