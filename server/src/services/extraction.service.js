import { anthropic, textOf } from '../lib/anthropic.js'
import { config } from '../config/env.js'
import { updateContact } from './contacts.service.js'
import { getRecentMessages } from './conversations.service.js'
import { ghlEnabled } from './ghl.service.js'
import { syncContactToGHL } from './booking.service.js'

const SCHEMA_HINT = `Return ONLY a JSON object with these keys (use null when unknown — never guess):
{
  "name": string|null,
  "email": string|null,
  "phone": string|null,               // digits/format as given
  "gender": "female"|"male"|null,
  "concern": string|null,             // main skin concern, e.g. "acne", "cleansing", "pigmentation"
  "service_interest": string|null,    // "facial" | "consultation" | "waxing" | "brows" | other
  "consultation_type": "consultation_only"|"facial_with_consultation"|"unsure"|null,
  "preferred_dates": string|null,     // dates the client mentioned, verbatim, e.g. "July 9 2026"
  "preferred_time": "morning"|"afternoon"|"evening"|null,
  "booking_stage": "new"|"qualifying"|"scheduling"|"confirming"|"awaiting_deposit"|"booked"|"follow_up"|null,
  "client_type": "New Lead"|"Returning Client"|"VIP"|"Package Client"|"Consultation Client"|"Facial Client"|null,
  "ready_to_book": boolean|null,
  "tags": string[]                    // short CRM tags from this chat, e.g. ["Facial","Acne","Needs Follow-up"]. [] if none.
}`

// Read the conversation and persist structured CRM data onto the contact.
// Runs AFTER the reply is sent, so it never slows the user's response.
export async function extractAndSave(conversationId, contact) {
  if (!contact?.id) return
  try {
    const history = await getRecentMessages(conversationId, 30)
    if (!history.length) return
    const transcript = history
      .map((m) => `${m.role === 'user' ? 'Client' : 'Martini'}: ${m.content}`)
      .join('\n')

    // Claude: system prompt is a separate parameter; no `temperature` (rejected
    // on Opus 4.7+). We ask for bare JSON and strip any code fence defensively.
    const res = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 500,
      system:
        'You extract structured CRM data from a skincare-salon chat for GoHighLevel. Be precise and conservative — only report what the client actually stated. ' +
        SCHEMA_HINT +
        '\n\nRespond with ONLY the JSON object — no prose, no markdown code fences.',
      messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
    })

    const raw = textOf(res).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const d = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) || '{}')

    // Merge: only set a field when we learned a real value; never overwrite a
    // known value with null.
    const patch = {}
    const setIf = (key, val) => {
      if (val !== null && val !== undefined && val !== '') patch[key] = val
    }
    setIf('name', d.name)
    setIf('email', d.email)
    setIf('phone', d.phone)
    setIf('gender', d.gender)
    setIf('concern', d.concern)
    setIf('client_type', d.client_type)
    setIf('booking_stage', d.booking_stage)

    // Tags: union with what's already there.
    if (Array.isArray(d.tags) && d.tags.length) {
      patch.tags = Array.from(new Set([...(contact.tags || []), ...d.tags]))
    }

    // Softer/booking details live in custom_fields.
    const cf = { ...(contact.custom_fields || {}) }
    const setCf = (key, val) => {
      if (val !== null && val !== undefined && val !== '') cf[key] = val
    }
    setCf('service_interest', d.service_interest)
    setCf('consultation_type', d.consultation_type)
    setCf('preferred_dates', d.preferred_dates)
    setCf('preferred_time', d.preferred_time)
    if (d.ready_to_book === true) cf.ready_to_book = true
    if (Object.keys(cf).length) patch.custom_fields = cf

    if (Object.keys(patch).length) {
      await updateContact(contact.id, patch)
    }

    // Sync the lead to GHL once we have a phone number (best-effort). Stores the
    // GHL contact id back on our contact so later booking can reference it.
    const phone = patch.phone || contact.phone
    if (phone && ghlEnabled() && !contact.ghl_contact_id) {
      const ghlContact = await syncContactToGHL({
        name: patch.name || contact.name,
        phone,
        email: patch.email || contact.email,
        concern: patch.concern || contact.concern,
        tags: ['hot new lead'],
      })
      if (ghlContact?.id) {
        await updateContact(contact.id, { ghl_contact_id: ghlContact.id }).catch(() => {})
      }
    }
  } catch (err) {
    // Never let memory extraction break the chat — it's best-effort.
    console.warn('extractAndSave failed:', err.message)
  }
}
