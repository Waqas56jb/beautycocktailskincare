import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Conversations from './pages/Conversations'
import Training from './pages/Training'
import Settings from './pages/Settings'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Loading…
      </div>
    )
  }

  // Gate the whole panel behind auth. With Supabase unconfigured we still show
  // the login screen so the wiring is visible during setup.
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout user={session.user} />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="training" element={<Training />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
