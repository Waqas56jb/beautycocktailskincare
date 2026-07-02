// One-off migration runner: executes schema.sql against Supabase Postgres.
// Usage: npm run migrate
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf8')

const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const dbUrl = new URL(process.env.DATABASE_URL)
const password = decodeURIComponent(dbUrl.password)

// Try direct connection first, then the session-mode pooler.
const candidates = [
  { label: 'direct', host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres' },
  { label: 'pooler-session', host: dbUrl.hostname, port: 5432, user: dbUrl.username },
]

let applied = false
for (const c of candidates) {
  const client = new pg.Client({
    host: c.host,
    port: c.port,
    user: c.user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })
  try {
    process.stdout.write(`→ connecting via ${c.label} (${c.host}:${c.port})... `)
    await client.connect()
    console.log('connected')
    await client.query(sql)
    console.log('✅ schema.sql applied successfully')
    applied = true
    await client.end()
    break
  } catch (err) {
    console.log(`failed: ${err.message}`)
    try {
      await client.end()
    } catch {
      /* ignore */
    }
  }
}

if (!applied) {
  console.error(
    '\n❌ Could not apply automatically. Open Supabase → SQL Editor and run schema.sql manually.',
  )
  process.exitCode = 1
}
