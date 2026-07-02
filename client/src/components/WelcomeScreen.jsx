import Avatar from './Avatar'
import { SparkleIcon } from './icons'
import { brand } from '../lib/brand'

// The cover page — mirrors the reference: big centered mark, serif heading,
// muted intro line, and a bold pill CTA.
export default function WelcomeScreen({ onStart }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="relative mb-8">
        <span className="absolute -inset-3 rounded-full border border-[#d8ccae]" />
        <Avatar size={92} />
      </div>

      <h2 className="font-display text-[28px] font-bold leading-tight text-[#1c1a12]">
        {brand.welcomeTitle}
      </h2>

      <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-[#8a805d]">
        {brand.welcomeText}
      </p>

      <button
        onClick={onStart}
        className="mt-9 flex w-full max-w-xs items-center justify-center gap-2.5 rounded-full bg-[#111] px-8 py-4 text-[13px] font-semibold uppercase tracking-[0.15em] text-white shadow-[0_14px_34px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:bg-black active:translate-y-0"
      >
        <SparkleIcon />
        Start Conversation
      </button>
    </div>
  )
}
