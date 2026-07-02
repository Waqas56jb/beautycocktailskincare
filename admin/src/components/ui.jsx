// Small reusable UI primitives shared across pages.

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl border border-black/5 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1c1a12]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#8a805d]">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    primary: 'bg-[#6f6433] text-white hover:bg-[#5a5228] shadow-sm',
    dark: 'bg-[#111] text-white hover:bg-black shadow-sm',
    ghost: 'border border-black/10 bg-white text-[#3a352a] hover:bg-black/[0.03]',
    danger: 'bg-[#d03b3b] text-white hover:bg-[#b53232] shadow-sm',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#4a4636]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[#a99f7d]">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-[#1c1a12] outline-none transition focus:border-[#6f6433] focus:ring-2 focus:ring-[#6f6433]/15 ${props.className || ''}`}
    />
  )
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-black/[0.05] text-[#4a4636]',
    olive: 'bg-[#6f6433]/12 text-[#5a5228]',
    blue: 'bg-[#2a78d6]/12 text-[#215fab]',
    green: 'bg-[#0ca30c]/12 text-[#0a7a0a]',
    pink: 'bg-[#e87ba4]/15 text-[#b64c76]',
    amber: 'bg-[#eda100]/15 text-[#9a6b00]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-[#8a805d]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#6f6433]/30 border-t-[#6f6433]" />
      {label}
    </div>
  )
}

export function EmptyState({ title, hint }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-medium text-[#4a4636]">{title}</p>
      {hint && <p className="mt-1 text-sm text-[#a99f7d]">{hint}</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1c1a12]">{title}</h2>
          <button onClick={onClose} className="text-[#a99f7d] hover:text-[#4a4636]" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
