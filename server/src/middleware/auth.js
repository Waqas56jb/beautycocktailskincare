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
