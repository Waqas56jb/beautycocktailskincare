// Seed the knowledge base with Beauty Cocktail's real business info + policies.
// Idempotent: clears prior 'policy' rows, then re-inserts.
// Usage: node scripts/seed-knowledge.js
import 'dotenv/config'
import { supabase } from '../src/lib/supabase.js'
import { addKnowledge } from '../src/services/knowledge.service.js'

const SOURCE = 'policy' // allowed by knowledge_base.source CHECK constraint

const CHUNKS = [
  {
    title: 'Location, contact, hours, parking, accessibility',
    content:
      'Beauty Cocktail Skincare is a licensed, women-only, appointment-only skincare studio in Surrey, BC. Address: 6388 120 St, Surrey, BC V3X 3K1. Phone: 249-496-4181. Email: beautycocktailsalonn@gmail.com. Directions/map: https://share.google/bB4Qfq9SDT3rb1XYZ. ' +
      'Business hours: Monday to Sunday, 11:00 AM to 7:00 PM. Appointments requested before 11 AM or after 7 PM are treated as a special request and may cost an extra $50 on the booking. ' +
      'Parking: there is plenty of free public parking in the plaza.',
  },
  {
    title: 'Arrival help & late arrivals',
    content:
      'Only give the entry/arrival instructions when the client has a CONFIRMED booking that is happening very soon (today / within about 1-2 hours) — e.g. they say they have arrived or are on their way. Then: "We are inside Urban Cave — please enter from the front side on 120 Street, have a seat, and we will get you shortly." ' +
      'If someone just asks for directions or the address and does NOT have an imminent confirmed booking, share the address and Google map link only, and mention that full directions and entry instructions will be included in the reminder we send on the morning of their appointment. Do NOT give the "enter from the front / have a seat" instructions prematurely. ' +
      'Late arrivals: up to 15 minutes late is okay. If they will be MORE than 15 minutes late, mention the policy — more than 15 minutes late counts as the session being used, but we may still help with the leftover time slot if possible.',
  },
  {
    title: 'Wheelchair accessibility',
    content:
      'Wheelchair accessibility: our place IS wheelchair accessible if someone wants to come in and wait. However, we do not perform facials on people who are in a wheelchair. Always respond to this kindly and compassionately.',
  },
  {
    title: 'Facials — pricing, timing, cheapest option, massage',
    content:
      'Facials start from $120 and onwards (always say "onwards", never a single fixed price, even on a second ask). Facials take about 50 to 60 minutes and every facial includes a consultation for free. ' +
      'For individual named facial services and their prices, share this link: https://beautycocktailskincare.com/services/facials . ' +
      'Cheapest option if a client finds facials costly: a Clean-up for 30 minutes which includes steaming, extraction, and a face pack only (it does NOT include the massage, cleansing, etc. that full facials have). Do NOT invent a Clean-up price — if asked the exact price, share the facials link above. ' +
      'A facial massage, if asked, includes the neck, face, and scalp only.',
  },
  {
    title: 'Waxing — services, prices, durations, Brazilian details',
    content:
      'Waxing is a SEPARATE category from brows. For exact/full waxing prices, share this link: https://beautycocktailskincare.com/services/waxing . ' +
      'Guide prices (from website): full body from $155 (about 1.5 hours); Brazilian from $55 (about 20 min) — a Brazilian wax DOES include the buttocks (state this definitively, never "generally" or "typically"); legs from $55 (half leg and full leg are the SAME price, about 30 min); arms from $30 (half arm and full arm are the SAME price, about 20 min); underarm from $15 (about 5 min); belly from $15; back from $30. ' +
      'Minimum to book any appointment is $50 total — small items like underarm or brows are add-ons, not standalone bookings.',
  },
  {
    title: 'Brows, dermaplaning, add-ons',
    content:
      'Brows: $10 — this is a BROW service (add-on), NOT waxing. The $50 minimum booking applies (pair it with a facial or larger service). ' +
      'Dermaplaning: $79 for 30 minutes — available as an add-on or as an individual service. ' +
      'Dark circles: treated as an add-on for $35 — note that if dark circles are hereditary they cannot be removed, but we can help improve their appearance (be honest about this).',
  },
  {
    title: 'Advanced treatments — peels, microblading, laser (what we do / do not)',
    content:
      'We DO offer chemical peels, microblading, and laser skincare treatments. If asked whether we do any of these, say yes — but also mention that after an in-person skin analysis we determine whether your skin qualifies/needs it. ' +
      'We do NOT do laser hair removal. We do NOT treat psoriasis. For dark circles, see the add-on note (hereditary ones cannot be removed, only improved).',
  },
  {
    title: 'Consultation — how it works, focus, fee',
    content:
      'Every facial session begins with a consultation and skin analysis, and the consultation is FREE when booked with a facial. A standalone consultation (on its own, without a facial) has a $50 fee for 20 minutes. ' +
      'Do NOT mention the consultation fee unless the client specifically asks about it. The main focus should be a facial session (which includes the consultation) — not pushing a standalone paid consultation. Only if the client insists on just a consultation should you present the standalone consultation option and its fee.',
  },
  {
    title: 'Skin concerns — what we can work with',
    content:
      'We can work with clients who are pregnant, breastfeeding, or diabetic — yes to all. We can also work with clients on accutane, tretinoin, or with a fragrance allergy — please have them note it in the allergy section of the booking form. ' +
      'For any skin concern (acne, pigmentation, dullness, dryness, dark spots, rosacea, etc.), do not diagnose or prescribe a specific facial in chat — reassure them and recommend an in-person skin analysis to guide the right facial.',
  },
  {
    title: 'Gender policy',
    content:
      'Beauty Cocktail is a women-only studio. We accept women only. If anyone else asks — including men, or anyone identifying as trans or non-binary — kindly explain that at the moment we only accept women. Be warm and respectful.',
  },
  {
    title: 'Payments, e-transfer, installments',
    content:
      'A $50 non-refundable deposit is required to book; the remaining balance is due on the day of service. Accepted payments: cash, credit/debit card, approved digital payments, and e-transfer. ' +
      'Installments: NOT available for a single session. Installments are only for package clients (or if you buy a package): per policy, half is paid upfront and the rest is paid as the sessions go on.',
  },
  {
    title: 'Deposit, cancellation, rescheduling policy',
    content:
      'Deposit: $50 non-refundable, applied as credit toward your service; not transferable, no cash value. ' +
      'Cancellation: more than 24h notice — deposit forfeited but no new deposit needed to rebook; less than 24h notice, no-shows, or arriving 15+ min late — deposit forfeited AND a new $50 deposit required. ' +
      'Rescheduling: 12+ hours notice — deposit carries forward; less than 12h notice — deposit forfeited and new $50 deposit required. Rescheduling allowed a maximum of 2 times per booking.',
  },
  {
    title: 'Packages, subscriptions, loyalty',
    content:
      'Prepaid packages are valid for the duration stated at purchase; unused sessions do not roll over and expire with no refund; sessions are non-transferable. ' +
      'Facial subscriptions: semi-annual and annual; cancelling before 3 months (semi-annual) or 6 months (annual) incurs a $50 cancellation fee; no refunds for partially used periods; after cancelling you must wait 6 months to rejoin. ' +
      'Loyalty points are earned on eligible purchases and can be redeemed once the balance exceeds $50; non-transferable, no cash value.',
  },
  {
    title: 'Gift cards & booking for someone else',
    content:
      'We offer gift cards. You can buy a gift card from us and, if booking for someone else as a gift, book their appointment here with the deposit and send them the gift card you purchased. (Ask the team / JT for help completing a gift card purchase.)',
  },
  {
    title: 'Offers, deals, reviews, before/after photos',
    content:
      'For current offers and deals, share this link: https://beautycocktailskincare.com/services/offers . ' +
      'For reviews/testimonials, direct them to our Google profile. For before-and-after photos and client testimonials, direct them to our Instagram: https://www.instagram.com/beautycocktail_skincare_surrey . ' +
      'We cannot share before/after photos directly in chat due to privacy/confidentiality policy. Policies (privacy, terms, package): https://www.beautycocktailskincare.com/privacy-policy .',
  },
  {
    title: 'Health, safety, minors, privacy',
    content:
      'Clients must disclose allergies/medical conditions/skin sensitivities before treatment (note allergies in the booking form). We are not liable for reactions from undisclosed conditions. Under-18s only with verified parental/guardian consent. Personal info is used only for scheduling, loyalty, and opted-in promotions; never sold; client photos used only for treatment planning unless separate consent is given.',
  },
]

const run = async () => {
  console.log(`Clearing existing '${SOURCE}' rows...`)
  const { error: delErr } = await supabase.from('knowledge_base').delete().eq('source', SOURCE)
  if (delErr) console.warn('delete warning:', delErr.message)

  for (const c of CHUNKS) {
    try {
      await addKnowledge({ source: SOURCE, title: c.title, content: c.content, metadata: { doc: 'business' } })
      console.log('  ✅', c.title)
    } catch (e) {
      console.error('  ❌', c.title, '—', e.message)
    }
  }
  const { count } = await supabase.from('knowledge_base').select('*', { count: 'exact', head: true })
  console.log(`\nDone. knowledge_base now has ${count} rows.`)
}

run()
