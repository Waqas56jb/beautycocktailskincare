import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Settings,
  LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const allLinks = [
  { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/conversations', label: 'Conversations', icon: MessagesSquare },
  { to: '/users', label: 'Admin Users', icon: ShieldCheck, adminOnly: true },
  { to: '/training', label: 'Training', icon: Sparkles },
  { to: '/account', label: 'My Account', icon: Settings },
]

export default function Sidebar({ user, isAdmin }) {
  const links = allLinks.filter((l) => !l.adminOnly || isAdmin)

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-[#4c451f] to-[#26210f] text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 font-serif text-xl font-bold ring-1 ring-white/15">
          B
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Beauty Cocktail</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Admin Suite</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {links.map(({ to, label, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-white/12 text-white' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-[#e6d9a8] transition-all ${
                    isActive ? 'w-1' : 'w-0'
                  }`}
                />
                <Icon size={18} strokeWidth={2} className={isActive ? 'text-[#e6d9a8]' : 'text-white/55 group-hover:text-white'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-3">
        <div className="mb-1 flex items-center gap-3 px-2 py-1.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold uppercase ring-1 ring-white/15">
            {(user?.email || '?').charAt(0)}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-white">{user?.email}</p>
            <p className="text-[11px] capitalize text-white/45">{isAdmin ? 'admin' : 'staff'}</p>
          </div>
        </div>
        <button
          onClick={() => supabase?.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <LogOut size={18} strokeWidth={2} className="text-white/55" />
          Log out
        </button>
      </div>
    </aside>
  )
}
