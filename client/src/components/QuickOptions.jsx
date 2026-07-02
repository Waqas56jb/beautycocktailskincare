import { quickOptions } from '../lib/brand'

// Tappable suggestion cards shown under the first bot message.
export default function QuickOptions({ onPick, disabled }) {
  return (
    <div className="space-y-3 pt-1">
      {quickOptions.map((o) => (
        <button
          key={o.label}
          onClick={() => onPick(o.label)}
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-2xl bg-white px-5 py-4 text-left text-[15px] font-medium text-[#2b2820] shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
        >
          <span className="text-lg leading-none">{o.icon}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
