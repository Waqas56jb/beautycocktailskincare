// Seed the knowledge base with Beauty Cocktail's real website policies + info.
// Idempotent: clears prior 'website-policy' rows, then re-inserts.
// Usage: node scripts/seed-knowledge.js
import 'dotenv/config'
import { supabase } from '../src/lib/supabase.js'
import { addKnowledge } from '../src/services/knowledge.service.js'

const SOURCE = 'policy' // allowed by knowledge_base.source CHECK constraint

const CHUNKS = [
  {
    title: 'Location, contact & hours',
    content:
      'Beauty Cocktail Skincare is a licensed, women-focused, appointment-only skincare studio in Surrey, BC. Address: 6388 120 St, Surrey, BC V3X 3K1. Phone: 249-496-4181. Email: beautycocktailsalonn@gmail.com. Directions/map: https://share.google/bB4Qfq9SDT3rb1XYZ. By appointments only — advance booking required; walk-ins subject to availability.',
  },
  {
    title: 'Deposit policy',
    content:
      'A $50 non-refundable deposit is required to secure all bookings. The appointment is not confirmed until the deposit is received. The deposit is applied as credit toward your service on the day of the appointment. It does not hold cash value and cannot be transferred to another person or applied toward product purchases.',
  },
  {
    title: 'Cancellation policy',
    content:
      'Cancellations with more than 24 hours notice: the $50 deposit is forfeited in full, but you may rebook without paying a new deposit. Cancellations with less than 24 hours notice: the deposit is forfeited and a new $50 deposit is required to book any future appointment. No-shows: failing to attend without prior notice forfeits the deposit in full and a new deposit is required to rebook. Late arrivals of 15 minutes or more: the appointment may be cancelled, the deposit forfeited, and a new deposit required.',
  },
  {
    title: 'Rescheduling policy',
    content:
      'Rescheduling with 12 or more hours notice: the deposit carries forward to your rescheduled appointment. Rescheduling with less than 12 hours notice: the deposit is forfeited and a new $50 deposit is required. Rescheduling is permitted a maximum of two (2) times per original booking; after two reschedules the deposit is forfeited and a new deposit is required to book again, regardless of notice given.',
  },
  {
    title: 'Payment terms & refunds',
    content:
      'A $50 non-refundable deposit is paid at booking and applied toward the service total. The remaining balance is due in full on the day of service. Accepted payment methods: cash, credit/debit cards, and approved digital payment platforms. Refunds are not provided for completed services or partially used packages/subscriptions unless otherwise specified.',
  },
  {
    title: 'Packages: sessions, expiry & transfer',
    content:
      'Prepaid packages are valid for the duration specified at the time of purchase. Unused sessions do not roll over and expire after the validity period with no refund. Sessions are non-transferable and cannot be shared, gifted, or used by another person, cannot be redeemed for cash, and cannot be applied toward product purchases. All package bookings still require the $50 deposit and follow the same cancellation/rescheduling rules.',
  },
  {
    title: 'Facial subscription terms',
    content:
      'Facial subscriptions are available in semi-annual and annual durations, each including a set number of facial sessions. Unused sessions do not roll over unless stated. Subscription fees are paid in advance and are non-refundable unless specified. Cancelling before completing 3 months (semi-annual) or 6 months (annual) incurs a $50 cancellation fee. Cancellations require written notice and take effect at the end of the current period; no refunds for partially used periods or unused sessions. Subscription appointments must be rescheduled at least 24 hours in advance; late cancellations within 4 hours or no-shows mark the session as used. After cancelling, a member must wait 6 months before rejoining the same plan.',
  },
  {
    title: 'Loyalty rewards & promotions',
    content:
      'Clients earn loyalty points on eligible purchases and can redeem them once the balance exceeds $50. Loyalty points are non-transferable and cannot be exchanged for cash. Discounts, promotions, or special offers cannot be combined unless explicitly stated. If an active promotion is lower than a subscription/package session value, the difference is credited as loyalty points.',
  },
  {
    title: 'Health, safety & minors',
    content:
      'Clients must disclose any allergies, medical conditions, or skin sensitivities before treatment; Beauty Cocktail is not liable for adverse reactions from undisclosed conditions. All tools and equipment are sanitized to industry standards. Services are primarily for adults; clients under 18 may be served only with verified parental or guardian consent.',
  },
  {
    title: 'Privacy policy summary',
    content:
      'Beauty Cocktail collects personal info (name, contact, billing, skincare preferences, and — only with explicit consent — before/after photos) to schedule appointments, manage loyalty/promotions, send service notifications, and improve services. Client-submitted photos are used solely for treatment planning and are not shared or posted without separate explicit consent. Trusted third parties (GoHighLevel for CRM/booking, Stripe/Square for payments, Meta for Instagram/WhatsApp) process data under confidentiality and cannot use it for their own marketing. Data is not sold or rented. Clients can access, correct, or request deletion of their data, opt out of promotional messages anytime (service messages like reminders still apply), and withdraw photo consent. By providing a phone number, clients consent to appointment reminders and service updates via SMS/WhatsApp.',
  },
  {
    title: 'Booking & general policies',
    content:
      'All treatments are provided by a licensed esthetician and tailored to individual needs. By booking, clients confirm their health and skin information is accurate. Advance booking is required (appointment-only studio); walk-ins are subject to availability. All appointments require a $50 non-refundable deposit at booking. Beauty Cocktail may refuse service for inappropriate or disruptive behavior and may modify or discontinue services with prior notice. Liability is limited to the value of the service provided.',
  },
]

const run = async () => {
  console.log(`Clearing existing '${SOURCE}' rows...`)
  const { error: delErr } = await supabase.from('knowledge_base').delete().eq('source', SOURCE)
  if (delErr) console.warn('delete warning:', delErr.message)

  for (const c of CHUNKS) {
    try {
      await addKnowledge({ source: SOURCE, title: c.title, content: c.content, metadata: { doc: 'website' } })
      console.log('  ✅', c.title)
    } catch (e) {
      console.error('  ❌', c.title, '—', e.message)
    }
  }

  const { count } = await supabase.from('knowledge_base').select('*', { count: 'exact', head: true })
  console.log(`\nDone. knowledge_base now has ${count} rows.`)
}

run()
