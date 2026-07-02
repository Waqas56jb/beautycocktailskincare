import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const links = [
  { to: '/', label: 'Dashboard', end: true, icon: '▧' },
  { to: '/leads', label: 'Leads', icon: '◔' },
  { to: '/conversations', label: 'Conversations', icon: '❝' },
  { to: '/users', label: 'Admin Users', icon: '◉' },
  { to: '/training', label: 'Training', icon: '✦' },
  { to: '/account', label: 'My Account', icon: '⚙' },
]

export default function Sidebar({ user }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gradient-to-b from-[#4c451f] to-[#2a2512] text-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-serif text-lg font-bold">
          B
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Beauty Cocktail</p>
          <p className="text-[11px] uppercase tracking-wider text-white/50">Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="w-4 text-center text-white/60">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium text-white">{user?.email}</p>
          <p className="text-[11px] text-white/50">Signed in</p>
        </div>
        <button
          onClick={() => supabase?.auth.signOut()}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <span className="w-4 text-center">⏻</span> Log out
        </button>
      </div>
    </aside>
  )
}
