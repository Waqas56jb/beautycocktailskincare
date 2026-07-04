// One-shot: exchange the short-lived token in .env for a long-lived one, detect
// the IG business account id, and patch .env (META_ACCESS_TOKEN, META_ACCOUNT_ID,
// META_APP_SECRET). Usage: node scripts/setup-meta-token.js <APP_ID> <APP_SECRET>
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const [appId, appSecret] = process.argv.slice(2)
const short = process.env.META_ACCESS_TOKEN
const V = process.env.META_GRAPH_VERSION || 'v21.0'
const FB = process.env.META_GRAPH_BASE || 'https://graph.facebook.com'
if (!appId || !appSecret || !short) {
  console.error('Usage: node scripts/setup-meta-token.js <APP_ID> <APP_SECRET>  (short token read from .env)')
  process.exit(1)
}
const g = async (u) => {
  const r = await fetch(u)
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return d
}

const ex = await g(`${FB}/${V}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short}`)
const longToken = ex.access_token
console.log('long-lived token obtained, expires_in(days):', Math.round((ex.expires_in || 0) / 86400))

// find the IG business account id from granular scopes
const dbg = await g(`${FB}/${V}/debug_token?input_token=${longToken}&access_token=${appId}|${appSecret}`)
const igScope = (dbg.data?.granular_scopes || []).find((s) => s.scope === 'instagram_manage_messages' || s.scope === 'instagram_basic')
const igId = igScope?.target_ids?.[0] || process.env.META_ACCOUNT_ID
console.log('IG business account id:', igId)

// patch .env
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
let env = readFileSync(envPath, 'utf8')
const setVar = (k, val) => {
  const re = new RegExp(`^${k}=.*$`, 'm')
  env = re.test(env) ? env.replace(re, `${k}=${val}`) : env + `\n${k}=${val}`
}
setVar('META_ACCESS_TOKEN', longToken)
setVar('META_ACCOUNT_ID', igId)
setVar('META_APP_SECRET', appSecret)
writeFileSync(envPath, env)
console.log('✅ .env updated (META_ACCESS_TOKEN long-lived, META_ACCOUNT_ID, META_APP_SECRET)')
