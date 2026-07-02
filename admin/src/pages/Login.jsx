import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL / ANON_KEY.')
      return
    }
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"
      >
        <p className="text-lg font-bold text-pink-600">Beauty Cocktail</p>
        <p className="mb-6 text-sm text-gray-400">Admin sign in</p>

        <label className="mb-1 block text-sm font-medium text-gray-600">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-pink-400"
          required
        />

        <label className="mb-1 block text-sm font-medium text-gray-600">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-pink-400"
          required
        />

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-pink-600 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
