import { useState } from 'react'
import { ArrowUpIcon } from './icons'

export default function MessageInput({ onSend, disabled }) {
  const [value, setValue] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 px-4 pb-3 pt-2"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Write your message…"
        className="flex-1 rounded-full border border-black/5 bg-white px-5 py-3.5 text-[15px] text-[#2b2820] shadow-sm outline-none transition placeholder:text-[#b3a985] focus:border-[#cbb489]"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#cbb489] text-[#3a341a] shadow-sm transition hover:bg-[#bda574] disabled:opacity-45"
      >
        <ArrowUpIcon />
      </button>
    </form>
  )
}
