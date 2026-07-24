// Verify the cancel/reschedule policy-window logic. Part 1 is offline (synthetic
// appointment times, so we can cover the under-12h case). Part 2 is live against a
// real active_booking contact — pass their WhatsApp number as the first arg.
import { buildSystemPrompt } from '../src/lib/prompts.js'
import { getUpcomingAppointment } from '../src/services/booking.service.js'
import { handleChat } from '../src/services/chat.service.js'

function check(label, cond) {
  console.log(`  ${cond ? '✅' : '❌'} ${label}`)
  if (!cond) process.exitCode = 1
}

const TAGS = ['tag_active_booking', 'tag_facial_appt']
const mk = (minsUntil) => ({
  when: 'Monday, August 10 at 1:00 PM',
  status: 'confirmed',
  fastHelp: minsUntil <= 30,
  minsUntil,
  hoursUntil: Math.floor(minsUntil / 60),
  rescheduleWindowOpen: minsUntil >= 12 * 60,
  cancelWindowOpen: minsUntil >= 24 * 60,
})

console.log('── PART 1 — POLICY WINDOW rendering across time windows ──\n')
for (const [label, mins] of [['1 hr away', 60], ['13 hrs away', 800], ['33 hrs away', 2000]]) {
  const sys = buildSystemPrompt({
    contact: { name: 'Test' }, knowledge: [], channel: 'website',
    ghlTags: TAGS, appointment: mk(mins),
  })
  const win = sys.split('POLICY WINDOW')[1]?.split('\n')[0] || ''
  console.log(`  [${label}] ${win.trim().slice(0, 200)}`)
  if (mins < 720) check(`  ${label}: reschedule shown TOO LATE`, /under 12 hrs/.test(win))
  else check(`  ${label}: reschedule shown within notice`, /deposit carries over/.test(win))
  if (mins < 1440) check(`  ${label}: cancel shown under-24h forfeit`, /under 24 hrs/.test(win))
  else check(`  ${label}: cancel shown within notice`, /rebook with no new deposit/.test(win))
  console.log('')
}

const PHONE = process.argv[2]
if (!PHONE) { console.log('(skip live part — no phone arg)'); process.exit() }

console.log('── PART 2 — live reschedule request (real active_booking contact) ──\n')
const appt = await getUpcomingAppointment(
  (await import('../src/services/ghl.service.js')).getContactByPhone
    ? (await (await import('../src/services/ghl.service.js')).getContactByPhone(PHONE))?.id
    : null,
)
console.log('  live appointment fields:', JSON.stringify(appt), '\n')

const r = await handleChat({ text: 'can I reschedule my appointment?', visitor: { phone: PHONE }, channel: 'website' })
console.log('  Q: can I reschedule my appointment?')
console.log('  A:', r.reply, '\n')
check('confirms the appointment date/time', /august 10|1:00 pm/i.test(r.reply))
check('mentions a team member / someone will help (hand off)', /team member|someone|our team|help you out|reach out/i.test(r.reply))
check('does NOT claim it rescheduled itself', !/i(?:'ve| have) rescheduled|done|changed your appointment to/i.test(r.reply))

const c = await handleChat({ text: 'actually can I just cancel it?', visitor: { phone: PHONE }, channel: 'website' })
console.log('  Q: actually can I just cancel it?')
console.log('  A:', c.reply, '\n')
check('offers reschedule first / mentions deposit', /reschedule|deposit/i.test(c.reply))

console.log('\nDone.')
