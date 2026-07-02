import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { adminApi, apiError } from '../lib/api'
import { Card, PageHeader, Spinner, EmptyState, Badge, Button, Modal, Field, Input } from '../components/ui'

export default function Users() {
  const { user } = useOutletContext()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [reveal, setReveal] = useState({}) // id -> bool
  const [createOpen, setCreateOpen] = useState(false)
  const [pwTarget, setPwTarget] = useState(null) // user being password-changed

  const load = () => adminApi.users().then(setUsers).catch((e) => setError(apiError(e)))
  useEffect(() => {
    load()
  }, [])

  const onDelete = async (u) => {
    if (!confirm(`Delete admin user ${u.email}? This cannot be undone.`)) return
    try {
      await adminApi.deleteUser(u.id)
      load()
    } catch (e) {
      alert(apiError(e))
    }
  }

  if (error) return <p className="text-sm text-[#c0392b]">{error}</p>
  if (!users) return <Spinner label="Loading users…" />

  return (
    <div>
      <PageHeader
        title="Admin Users"
        subtitle="Staff who can sign into this panel"
        actions={<Button onClick={() => setCreateOpen(true)}>+ Add admin user</Button>}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf7f0] text-[#8a805d]">
              <tr>
                {['Name', 'Email', 'Password', 'Role', 'Last sign-in', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No users" />
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-black/[0.015]">
                    <td className="px-4 py-3 font-medium text-[#1c1a12]">
                      {u.full_name || '—'}
                      {u.id === user?.id && <span className="ml-2 text-xs text-[#a99f7d]">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-[#4a4636]">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-black/[0.05] px-2 py-0.5 text-xs tabular-nums text-[#4a4636]">
                          {u.password ? (reveal[u.id] ? u.password : '••••••••') : '—'}
                        </code>
                        {u.password && (
                          <button
                            onClick={() => setReveal((r) => ({ ...r, [u.id]: !r[u.id] }))}
                            className="text-xs text-[#6f6433] hover:underline"
                          >
                            {reveal[u.id] ? 'hide' : 'show'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="olive">{u.role}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#a99f7d]">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'never'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => setPwTarget(u)} className="text-xs font-medium text-[#6f6433] hover:underline">
                        Change password
                      </button>
                      {u.id !== user?.id && (
                        <button onClick={() => onDelete(u)} className="ml-3 text-xs font-medium text-[#c0392b] hover:underline">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-[#a99f7d]">
        Note: stored passwords are shown here at your request for team convenience. For stronger security,
        consider disabling password viewing and using resets instead.
      </p>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} onDone={load} />}
      {pwTarget && <PasswordModal target={pwTarget} onClose={() => setPwTarget(null)} onDone={load} />}
    </div>
  )
}

function CreateUserModal({ onClose, onDone }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'admin' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await adminApi.createUser(form)
      onDone()
      onClose()
    } catch (e2) {
      setErr(apiError(e2))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add admin user">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <Input value={form.full_name} onChange={set('full_name')} placeholder="Jane Doe" />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={set('email')} placeholder="jane@email.com" />
        </Field>
        <Field label="Password" hint="Share this with the new user; they can change it later.">
          <Input required minLength={6} value={form.password} onChange={set('password')} placeholder="••••••••" />
        </Field>
        {err && <p className="text-sm text-[#c0392b]">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PasswordModal({ target, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await adminApi.setUserPassword(target.id, password)
      onDone()
      onClose()
    } catch (e2) {
      setErr(apiError(e2))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Change password — ${target.email}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <Input required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {err && <p className="text-sm text-[#c0392b]">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
