import Avatar from './Avatar'
import { CloseIcon } from './icons'
import { brand } from '../lib/brand'

export default function ChatHeader({ onClose }) {
  return (
    <header className="flex items-center justify-between bg-gradient-to-br from-[#6f6433] via-[#544b25] to-[#39331a] px-4 py-3.5 text-white">
      <div className="flex items-center gap-3">
        <Avatar size={44} online />
        <div className="leading-tight">
          <h1 className="font-display text-lg font-bold">{brand.short}</h1>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3fbf5f]" />
            {brand.role} · Online
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/55">
          Private
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  )
}
