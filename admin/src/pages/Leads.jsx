import { useEffect, useState } from 'react'
import { adminApi, apiError } from '../lib/api'
import { Card, PageHeader, Spinner, EmptyState, Badge } from '../components/ui'

const typeTone = {
  'New Lead': 'blue',
  'Returning Client': 'green',
  VIP: 'pink',
  'Package Client': 'olive',
}

export default function Leads() {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    adminApi.leads().then(setLeads).catch((e) => setError(apiError(e)))
  }, [])

  if (error) return <p className="text-sm text-[#c0392b]">{error}</p>
  if (!leads) return <Spinner label="Loading leads…" />

  const filtered = leads.filter((l) =>
    [l.name, l.email, l.phone, l.concern].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} contacts captured by Martini`}
        actions={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-64 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm outline-none focus:border-[#6f6433]"
          />
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf7f0] text-[#8a805d]">
              <tr>
                {['Name', 'Contact', 'Skin concern', 'Type', 'Tags', 'Channel', 'Added'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No leads found" hint="They'll appear here as Martini chats." />
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-black/[0.015]">
                    <td className="px-4 py-3 font-medium text-[#1c1a12]">{l.name || '—'}</td>
                    <td className="px-4 py-3 text-[#4a4636]">
                      <div>{l.email || '—'}</div>
                      <div className="text-xs text-[#a99f7d]">{l.phone || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[#4a4636]">{l.concern || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={typeTone[l.client_type] || 'neutral'}>{l.client_type || 'New Lead'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(l.tags || []).slice(0, 3).map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#4a4636]">{l.source || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#a99f7d]">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
