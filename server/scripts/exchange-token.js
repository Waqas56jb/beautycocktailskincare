// Convert a short-lived Meta token → long-lived token → Page token (+ IG id).
// Instagram messaging needs the PAGE token (it does not expire).
//
// Usage:
//   node scripts/exchange-token.js <APP_ID> <APP_SECRET> [SHORT_TOKEN]
// (SHORT_TOKEN defaults to META_ACCESS_TOKEN from .env)
import 'dotenv/config'

const [appId, appSecret, shortToken = process.env.META_ACCESS_TOKEN] = process.argv.slice(2)
const V = process.env.META_GRAPH_VERSION || 'v21.0'
const BASE = process.env.META_GRAPH_BASE || 'https://graph.facebook.com'

if (!appId || !appSecret || !shortToken) {
  console.error('Usage: node scripts/exchange-token.js <APP_ID> <APP_SECRET> [SHORT_TOKEN]')
  process.exit(1)
}

const get = async (url) => {
  const r = await fetch(url)
  const data = await r.json()
  if (data.error) throw new Error(`${data.error.message} (code ${data.error.code})`)
  return data
}

try {
  // 1. short-lived → long-lived USER token
  const ex = await get(
    `${BASE}/${V}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`,
  )
  const longUserToken = ex.access_token
  console.log('\n✅ Long-lived USER token (~60 days):\n', longUserToken)
  if (ex.expires_in) console.log('   expires_in (sec):', ex.expires_in)

  // 2. list Pages this user manages → each has a non-expiring PAGE token
  const pages = await get(`${BASE}/${V}/me/accounts?fields=name,access_token,instagram_business_account&access_token=${longUserToken}`)
  if (!pages.data?.length) {
    console.log('\n⚠️ No Pages found for this user. Make sure the account manages a Facebook Page linked to the IG professional account.')
    process.exit(0)
  }

  console.log('\n✅ Pages (use the PAGE access_token for Instagram messaging):')
  for (const p of pages.data) {
    console.log(`\n  • Page: ${p.name}  (id: ${p.id})`)
    console.log(`    PAGE_TOKEN: ${p.access_token}`)
    if (p.instagram_business_account) {
      console.log(`    IG business account id: ${p.instagram_business_account.id}`)
    }
  }

  console.log('\n→ Put the PAGE_TOKEN in META_ACCESS_TOKEN and the Page id (or IG id) in META_ACCOUNT_ID.')
} catch (err) {
  console.error('\n❌ Exchange failed:', err.message)
  console.error('   Common causes: token expired, wrong App ID/Secret, or app not in the right mode.')
  process.exit(1)
}
