import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/leads', label: 'Leads' },
  { to: '/conversations', label: 'Conversations' },
  { to: '/training', label: 'Training' },
  { to: '/settings', label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
      <div className="px-5 py-6">
        <p className="text-lg font-bold text-pink-600">Beauty Cocktail</p>
        <p className="text-xs text-gray-400">Admin Panel</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-pink-50 text-pink-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
