import { useEffect, useState } from 'react'
import { adminApi, apiError } from '../lib/api'
import { Card, PageHeader, Spinner } from '../components/ui'
import { LeadsAreaChart, ChannelBarChart, ClientTypeDonut, FunnelBar } from '../components/charts'

function StatTile({ label, value, delta, accent = '#6f6433' }) {
  const up = delta != null && delta >= 0
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[#8a805d]">{label}</p>
        <span className="h-8 w-1.5 rounded-full" style={{ background: accent }} />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#1c1a12]">{value}</p>
      {delta != null && (
        <p className={`mt-1 text-xs font-semibold ${up ? 'text-[#0a7a0a]' : 'text-[#c0392b]'}`}>
          {up ? '▲' : '▼'} {Math.abs(delta)}% vs last week
        </p>
      )}
    </Card>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#1c1a12]">{title}</h3>
        {subtitle && <p className="text-xs text-[#a99f7d]">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [charts, setCharts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.charts()])
      .then(([s, c]) => {
        setStats(s)
        setCharts(c)
      })
      .catch((e) => setError(apiError(e)))
  }, [])

  if (error) return <p className="text-sm text-[#c0392b]">{error}</p>
  if (!stats || !charts) return <Spinner label="Loading dashboard…" />

  const hasChannel = charts.byChannel?.length > 0
  const hasTypes = charts.byClientType?.length > 0

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Martini's activity across Instagram, WhatsApp & website chat · last 14 days"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Leads" value={stats.totalLeads} accent="#6f6433" />
        <StatTile label="New Leads (7d)" value={stats.newLeads} delta={stats.leadsDelta} accent="#2a78d6" />
        <StatTile label="Open Conversations" value={stats.openConversations} accent="#e87ba4" />
        <StatTile label="Conversion Rate" value={`${stats.conversionRate}%`} accent="#0ca30c" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Leads over time" subtitle="New contacts per day">
            <LeadsAreaChart data={charts.leadsOverTime} />
          </ChartCard>
        </div>
        <ChartCard title="Client types" subtitle="Share of contacts by segment">
          {hasTypes ? <ClientTypeDonut data={charts.byClientType} /> : <Empty />}
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Conversations by channel" subtitle="Where people reach Martini">
          {hasChannel ? <ChannelBarChart data={charts.byChannel} /> : <Empty />}
        </ChartCard>
        <ChartCard title="Booking funnel" subtitle="Leads → booked → deposit paid">
          <FunnelBar data={charts.funnel} />
        </ChartCard>
      </div>
    </div>
  )
}

function Empty() {
  return <div className="flex h-[240px] items-center justify-center text-sm text-[#a99f7d]">No data yet</div>
}
