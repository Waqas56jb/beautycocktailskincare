import { supabase } from '../lib/supabase.js'

function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

// List all admin-panel staff: auth users joined with profile + stored password.
export async function listStaff() {
  const [{ data: authData, error }, { data: profiles }, { data: creds }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('staff_profiles').select('*'),
    supabase.from('staff_credentials').select('*'),
  ])
  if (error) throw error

  const pMap = new Map((profiles || []).map((p) => [p.id, p]))
  const cMap = new Map((creds || []).map((c) => [c.id, c]))

  return (authData?.users || [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: pMap.get(u.id)?.full_name ?? u.user_metadata?.full_name ?? '',
      role: pMap.get(u.id)?.role ?? u.user_metadata?.role ?? 'staff',
      password: cMap.get(u.id)?.password ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export async function createStaff({ email, password, full_name = '', role = 'admin' }) {
  if (!email || !password) throw httpError(400, 'email and password are required')

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  })
  if (error) throw httpError(400, error.message)

  const id = data.user.id
  await supabase.from('staff_profiles').upsert({ id, email, full_name, role }, { onConflict: 'id' })
  await supabase.from('staff_credentials').upsert({ id, password }, { onConflict: 'id' })

  return { id, email, full_name, role, password, created_at: data.user.created_at }
}

export async function updateStaffProfile(id, { full_name, role }) {
  const patch = {}
  if (full_name !== undefined) patch.full_name = full_name
  if (role !== undefined) patch.role = role
  if (Object.keys(patch).length === 0) return { id }

  // Keep the JWT's user_metadata.role in sync (the frontend reads it), merging
  // so we don't drop other metadata like full_name.
  if (patch.role) {
    const { data: cur } = await supabase.auth.admin.getUserById(id)
    const meta = { ...(cur?.user?.user_metadata || {}), role: patch.role }
    if (patch.full_name !== undefined) meta.full_name = patch.full_name
    await supabase.auth.admin.updateUserById(id, { user_metadata: meta })
  }
  const { error } = await supabase.from('staff_profiles').update(patch).eq('id', id)
  if (error) throw error
  return { id, ...patch }
}

export async function setStaffPassword(id, password) {
  if (!password) throw httpError(400, 'password is required')
  const { error } = await supabase.auth.admin.updateUserById(id, { password })
  if (error) throw httpError(400, error.message)
  await supabase.from('staff_credentials').upsert({ id, password, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return { id }
}

export async function deleteStaff(id) {
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) throw httpError(400, error.message)
  // staff_profiles / staff_credentials cascade via FK on auth.users
  return { id }
}

// --- Self-service (the logged-in admin managing their OWN account) ---
export async function updateOwnEmail(userId, email) {
  if (!email) throw httpError(400, 'email is required')
  const { error } = await supabase.auth.admin.updateUserById(userId, { email, email_confirm: true })
  if (error) throw httpError(400, error.message)
  await supabase.from('staff_profiles').update({ email }).eq('id', userId)
  return { id: userId, email }
}

export async function updateOwnPassword(userId, password) {
  return setStaffPassword(userId, password)
}
