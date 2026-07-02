// Small inline SVG icons so the UI stays crisp at any size (no icon lib needed).

export function SparkleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.9 5.6a4 4 0 0 0 2.5 2.5L22 12l-5.6 1.9a4 4 0 0 0-2.5 2.5L12 22l-1.9-5.6a4 4 0 0 0-2.5-2.5L2 12l5.6-1.9a4 4 0 0 0 2.5-2.5L12 2z" />
    </svg>
  )
}

export function ArrowUpIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

export function CloseIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}
