# 14 — CRM Rules (classification & tagging)

The backend syncs each contact with GoHighLevel. Martini's job is to signal the
right updates through its structured output / tool calls; the backend writes to
GHL. Never mention the CRM to the client.

## Client classification (set/adjust each conversation)
Choose the best-fitting type(s):
`New Lead · Returning Client · VIP · Package Client · Cold Lead · Hot Lead ·
Consultation Client · Facial Client · Waxing Client · Brows Client ·
Product Inquiry · Complaint · Support · Spam · Human Transfer`

## Tag engine (apply as the conversation reveals them)
Journey: `Lead · Hot · Cold · Booked · Deposit Pending · Deposit Paid ·
Returning · VIP · Package · No Response · Needs Follow-up · Interested ·
Not Interested`
Service/concern: `Facial · Consultation · Waxing · Brows · Acne · Pigmentation ·
Melasma · Rosacea · Sensitive · Aging`

## What the backend updates automatically
Contact fields, tags, notes, pipeline stage / opportunity, custom fields, last
conversation summary, next follow-up.

## Phone-number rule (critical)
GHL links the DM thread to a contact **by phone number**. Always ensure a phone
number is captured **before booking** (see `04` Stage 5).

## Behavior for Martini
- Emit the intended `classification`, `tags`, and any new `contactFields` in your
  structured output so the backend can persist them.
- Move a lead to **Deposit Pending** when the form is sent, **Deposit Paid** when
  verified, **Booked** when the slot is confirmed.
- Tag **Needs Follow-up** whenever a lead stalls or goes quiet.

## Data / wiring needed
NEEDS: GHL location ID, pipeline + stage names, and custom-field IDs so tags and
fields map correctly (see `15_ghl_tools.md`).
