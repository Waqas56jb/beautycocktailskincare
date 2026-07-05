// CLI test harness: runs client-feedback scenarios against the local server.
// Usage: node scripts/test-chat.js [scenarioIndex]
const BASE = process.env.CHAT_URL || 'http://localhost:4000/api/chat'

async function send(conversationId, text) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, text, channel: 'website' }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

const SCENARIOS = [
  {
    name: 'Welcome: women-based + email/phone/concern once',
    turns: ['Hi', 'I have acne problem'],
  },
  {
    name: 'Wax prices: butt cheeks / Brazilian definitive',
    turns: ['Do you wax butt cheeks', 'What does a Brazilian wax include?'],
  },
  {
    name: 'Wax prices: half leg / half arm / underarm',
    turns: ['How much is half leg wax', 'And half arm?', 'Underarm wax price?'],
  },
  {
    name: 'Bikini wax (not on menu -> link, no invention)',
    turns: ['How much is bikini wax'],
  },
  {
    name: 'Facial price: onwards every time + named facial -> link',
    turns: ['How much is a facial?', 'Ok but how much exactly? tell me again', 'How much is HydraFacial?'],
  },
  {
    name: 'Friends: one after another, female, individual forms',
    turns: ['Can I bring my friend for a facial too? We want it together'],
  },
  {
    name: 'Booking: dates not time, confirm date then form',
    turns: ['I want to book a facial', 'Glowing skin, just want a facial', 'My number is 6045551234', 'Tomorrow works'],
  },
  {
    name: 'Unknown answer -> no making up, hand off',
    turns: ['Do you do laser hair removal with the new IPL machine? what is the price'],
  },
  {
    name: 'Dermaplaning: $79, 30 min, add-on or individual',
    turns: ['How much is dermaplaning? Can I book only dermaplaning?'],
  },
]

const only = process.argv[2] !== undefined ? Number(process.argv[2]) : null

const run = async () => {
  for (let i = 0; i < SCENARIOS.length; i++) {
    if (only !== null && i !== only) continue
    const s = SCENARIOS[i]
    console.log(`\n${'='.repeat(70)}\n[${i}] ${s.name}\n${'='.repeat(70)}`)
    let convId = null
    for (const t of s.turns) {
      const { conversationId, reply } = await send(convId, t)
      convId = conversationId
      console.log(`\n  USER: ${t}\n  BOT : ${reply.replace(/\n/g, '\n        ')}`)
    }
  }
}

run().catch((e) => {
  console.error('Test failed:', e.message)
  process.exit(1)
})
