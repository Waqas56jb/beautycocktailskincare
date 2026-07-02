import { brand } from '../lib/brand'

// Brand mark: black circle with the serif initial, optional online dot.
export default function Avatar({ size = 44, online = false, ringColor }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full bg-[#111] ring-2 ring-white/85"
        style={ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
      >
        <span
          className="font-display font-bold text-white"
          style={{ fontSize: Math.round(size * 0.44), lineHeight: 1 }}
        >
          {brand.letter}
        </span>
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#3fbf5f] ring-2 ring-[#4a441f]" />
      )}
    </div>
  )
}
