// Create an admin user in Supabase Auth (+ a staff_profiles row).
// Usage: node scripts/create-admin.js <email> <password> [full_name]
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const [email, password, fullName = 'Admin'] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/create-admin.js <email> <password> [full_name]')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

// 1. Create (or find) the auth user, email pre-confirmed so they can log in now.
let userId
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role: 'admin' },
})

if (error) {
  if (/already been registered|already exists/i.test(error.message)) {
    console.log('ℹ️  User already exists — looking it up...')
    const { data: list } = await supabase.auth.admin.listUsers()
    userId = list?.users?.find((u) => u.email === email)?.id
  } else {
    console.error('❌ createUser failed:', error.message)
    process.exit(1)
  }
} else {
  userId = data.user.id
  console.log('✅ Auth user created:', email)
}

// 2. Upsert a staff profile (role = admin).
if (userId) {
  const { error: pErr } = await supabase
    .from('staff_profiles')
    .upsert({ id: userId, email, full_name: fullName, role: 'admin' }, { onConflict: 'id' })
  if (pErr) console.warn('⚠️  staff_profiles upsert warning:', pErr.message)
  else console.log('✅ staff_profiles row set (role: admin)')

  const { error: cErr } = await supabase
    .from('staff_credentials')
    .upsert({ id: userId, password }, { onConflict: 'id' })
  if (cErr) console.warn('⚠️  staff_credentials upsert warning:', cErr.message)
  else console.log('✅ staff_credentials stored')
}

console.log('\nLogin at the admin panel with:')
console.log('   email:   ', email)
console.log('   password:', password)
