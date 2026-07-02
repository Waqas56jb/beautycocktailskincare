import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout({ user }) {
  return (
    <div className="flex h-full bg-[#f6f2e9]">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">
          <Outlet context={{ user }} />
        </div>
      </main>
    </div>
  )
}
