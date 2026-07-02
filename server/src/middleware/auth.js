import { supabase } from '../lib/supabase.js'

// Protect admin endpoints. The admin panel signs in via Supabase Auth and sends
// the access token as `Authorization: Bearer <jwt>`. We validate it here.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing auth token' })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired token' })

    req.user = data.user
    next()
  } catch (err) {
    next(err)
  }
}

// Resolve the caller's role from the authoritative staff_profiles table
// (falls back to token metadata) and require an elevated role. Used to gate
// user management so only admins can create accounts / view credentials.
export async function requireAdmin(req, res, next) {
  try {
    const { data } = await supabase
      .from('staff_profiles')
      .select('role')
      .eq('id', req.user.id)
      .maybeSingle()
    const role = data?.role || req.user.user_metadata?.role || 'staff'
    if (role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    req.role = role
    next()
  } catch (err) {
    next(err)
  }
}
