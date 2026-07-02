import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout({ user }) {
  const role = user?.user_metadata?.role || user?.app_metadata?.role || 'staff'
  const isAdmin = role === 'admin' || role === 'owner'

  return (
    <div className="flex h-full bg-[#f6f2e9]">
      <Sidebar user={user} isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">
          <Outlet context={{ user, isAdmin, role }} />
        </div>
      </main>
    </div>
  )
}
