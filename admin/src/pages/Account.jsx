import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminApi, apiError } from '../lib/api'
import { Card, PageHeader, Button, Field, Input } from '../components/ui'

export default function Account() {
  const { user } = useOutletContext()

  return (
    <div>
      <PageHeader title="My Account" subtitle="Update your own sign-in details" />
      <div className="grid max-w-3xl grid-cols-1 gap-4 lg:grid-cols-2">
        <EmailCard currentEmail={user?.email} />
        <PasswordCard />
      </div>
    </div>
  )
}

function Notice({ msg }) {
  if (!msg) return null
  const ok = msg.type === 'ok'
  return (
    <p className={`text-sm ${ok ? 'text-[#0a7a0a]' : 'text-[#c0392b]'}`}>{msg.text}</p>
  )
}

function EmailCard({ currentEmail }) {
  const [email, setEmail] = useState(currentEmail || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await adminApi.updateMyEmail(email)
      // refresh the local session so the new email shows immediately
      await supabase?.auth.refreshSession()
      setMsg({ type: 'ok', text: 'Email updated. Use the new email next time you sign in.' })
    } catch (e2) {
      setMsg({ type: 'err', text: apiError(e2) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-sm font-semibold text-[#1c1a12]">Change email</h3>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Notice msg={msg} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Update email'}
        </Button>
      </form>
    </Card>
  )
}

function PasswordCard() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setMsg({ type: 'err', text: 'Passwords do not match.' })
    if (password.length < 6) return setMsg({ type: 'err', text: 'Password must be at least 6 characters.' })
    setBusy(true)
    setMsg(null)
    try {
      await adminApi.updateMyPassword(password)
      setMsg({ type: 'ok', text: 'Password updated.' })
      setPassword('')
      setConfirm('')
    } catch (e2) {
      setMsg({ type: 'err', text: apiError(e2) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-sm font-semibold text-[#1c1a12]">Change password</h3>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Notice msg={msg} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </Card>
  )
}
