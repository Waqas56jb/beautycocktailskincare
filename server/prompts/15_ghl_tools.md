# 15 — GHL & Tool Integration Notes

Reference for how Martini's tool calls map to GoHighLevel and other systems.
This is implementation guidance for the backend + a description of tools Martini
may call (see `19_tool_calling_rules.md` for *when*).

## GoHighLevel (GHL)
- **Contacts:** create/update by **phone number** (primary link key).
- **Tags:** apply journey/service/concern tags (see `14`).
- **Pipeline / opportunity:** move stages (Lead → Booked → Deposit Paid → …).
- **Custom fields:** concern, source, campaign, referral, etc.
- **Forms:** the booking + deposit form is a GHL form (current booking method).
- **Calendar:** appointment availability + booking.

NEEDS (to wire): GHL API key, Location ID, pipeline IDs + stage IDs, form ID(s),
calendar ID(s), custom-field IDs, deposit/payment verification method.

## Supabase
- App database of record for conversations, messages, leads, memory summaries,
  and the training knowledge base (RAG). Server uses the **service_role** key.

## OpenAI
- LLM for Martini's responses + embeddings for RAG over the knowledge base and
  Instagram exports.

## Channels
- Instagram DMs, WhatsApp, website chat — normalized into one conversation model.
NEEDS: Instagram/WhatsApp connection method (GHL channels vs. direct API).

## Available tools (conceptual — final names set in code)
- `searchKnowledge(query)` → RAG over website/FAQ/policies/products/IG history.
- `getPricing(service)` → authoritative price (never guess).
- `getAvailability(dates)` / `bookAppointment(slot)` → calendar.
- `sendBookingForm(contact)` → GHL deposit form.
- `verifyDeposit(contact)` → confirm $50 paid.
- `upsertContact(fields)` / `applyTags(tags)` / `setStage(stage)` → GHL/CRM.
- `scheduleFollowUp(when, template)` → follow-up engine.
- `handoffToHuman(reason)` → notify staff (see `25`).
