const columns = ['Name', 'Email', 'Phone', 'Skin concern', 'Stage / Tag', 'Channel']

export default function Leads() {
  const leads = [] // TODO: fetch from GET /api/leads

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800">Leads</h1>
      <p className="mt-1 text-sm text-gray-500">
        Captured details and where each contact sits in the booking journey.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-4 py-3 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  No leads yet.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3">{lead.name}</td>
                  <td className="px-4 py-3">{lead.email}</td>
                  <td className="px-4 py-3">{lead.phone}</td>
                  <td className="px-4 py-3">{lead.skinConcern}</td>
                  <td className="px-4 py-3">{lead.stage}</td>
                  <td className="px-4 py-3">{lead.channel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
