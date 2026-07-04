import Avatar from './Avatar'
import { SparkleIcon } from './icons'
import { brand } from '../lib/brand'

// The cover page — mirrors the reference: big centered mark, serif heading,
// muted intro line, and a bold pill CTA.
export default function WelcomeScreen({ onStart, compact = false }) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center text-center ${
        compact ? 'px-6 py-6' : 'px-8'
      }`}
    >
      <div className={`relative ${compact ? 'mb-5' : 'mb-8'}`}>
        <span
          className={`absolute rounded-full border border-[#d8ccae] ${
            compact ? '-inset-2' : '-inset-3'
          }`}
        />
        <Avatar size={compact ? 72 : 92} />
      </div>

      <h2
        className={`font-display font-bold leading-tight text-[#1c1a12] ${
          compact ? 'text-[22px]' : 'text-[28px]'
        }`}
      >
        {compact ? `Hi, I'm ${brand.botName}` : brand.welcomeTitle}
      </h2>

      <p
        className={`max-w-xs leading-relaxed text-[#8a805d] ${
          compact ? 'mt-3 text-[14px]' : 'mt-4 text-[15px]'
        }`}
      >
        {brand.welcomeText}
      </p>

      <button
        onClick={onStart}
        className={`flex w-full max-w-xs items-center justify-center gap-2.5 rounded-full bg-[#111] px-8 text-[13px] font-semibold uppercase tracking-[0.15em] text-white shadow-[0_14px_34px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:bg-black active:translate-y-0 ${
          compact ? 'mt-6 py-3.5' : 'mt-9 py-4'
        }`}
      >
        <SparkleIcon />
        Start Conversation
      </button>
    </div>
  )
}
