import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { colors, CATEGORICAL } from '../lib/theme'

const axisTick = { fill: colors.muted, fontSize: 12 }

function TooltipBox({ active, payload, label, labelKey }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-black/5 bg-white px-3 py-2 shadow-lg">
      {label != null && <p className="mb-1 text-xs font-medium text-[#8a805d]">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-[#4a4636]">{p.name || p.payload?.[labelKey]}</span>
          <span className="ml-auto font-semibold tabular-nums text-[#1c1a12]">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// Leads over time — single series, brand olive area
export function LeadsAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.brand} stopOpacity={0.28} />
            <stop offset="100%" stopColor={colors.brand} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.grid }} interval="preserveStartEnd" />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: colors.brand, strokeOpacity: 0.25 }} />
        <Area
          type="monotone"
          dataKey="leads"
          name="Leads"
          stroke={colors.brand}
          strokeWidth={2}
          fill="url(#leadFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Conversations by channel — categorical bars
export function ChannelBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="channel" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="value" name="Conversations" radius={[4, 4, 0, 0]} maxBarSize={54}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Client types — donut with legend (identity never color-alone)
export function ClientTypeDonut({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Tooltip content={<TooltipBox labelKey="type" />} />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: colors.sub }}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="type"
          innerRadius={52}
          outerRadius={82}
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

// Booking funnel — horizontal bars
export function FunnelBar({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={colors.grid} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" tick={axisTick} tickLine={false} axisLine={false} width={92} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="value" name="Contacts" radius={[0, 4, 4, 0]} maxBarSize={34}>
          {data.map((_, i) => (
            <Cell key={i} fill={[colors.brand, '#2a78d6', '#0ca30c'][i % 3]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
