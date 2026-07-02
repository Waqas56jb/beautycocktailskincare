import { supabase } from '../lib/supabase'

export default function Topbar({ user }) {
  const signOut = () => supabase?.auth.signOut()

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {user?.email || 'Not signed in'}
        </span>
        {user && (
          <button
            onClick={signOut}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
