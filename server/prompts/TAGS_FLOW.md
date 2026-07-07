# Tags, Payment & Booking Flow (client spec, Jul 7)

How the **bot** and the client's **GHL workflows** work together via tags. Applies
to **leads/clients** — NOT `active_package` clients.

Legend: 🤖 bot does it · ⚙️ GHL workflow does it (client built) · 🔜 to build · 🧩 complex/later

## The tags
| Tag | Meaning | Set by |
|---|---|---|
| `tag_skin form submitted` | online-payment Skin Eval form submitted | ⚙️ |
| `tag_skin form submitted_etransfer version` | e-transfer form submitted | 🤖 (on etransfer) |
| `payment_deposit_success` | $50 deposit confirmed | ⚙️ (online) / 🤖 (on "deposit received") |
| `payment_failed_1` | online payment failed once | ⚙️ |
| `payment_failed_2` | online payment failed twice | ⚙️ |
| `active_package` | active package client | (existing) |
| `client`, `tag_facial_client`, `tag_wax_client` | returning / showed client | ⚙️/🔜 |
| `tag_active_booking`, `tag_facial_appt`, `tag_wax_appt` | active booking | 🔜 (bot on booking) |
| `hot new lead` | new lead no info | 🤖 |
| `review_received` | left a review | ⚙️/🧩 (name match) |

## Booking requires: (form tag 4 OR 5) **AND** `payment_deposit_success`.

## Deposit flow
1. Slot agreed → 🤖 bot sends **Skin Evaluation Form** (online) link.
2. **Payment success** → ⚙️ tags `payment_deposit_success` + `tag_skin form submitted`
   → 🤖 bot sees tags → books the appointment. ✅ status: ✅ read tags; 🔜 auto-book.
3. **Payment fails 1st** → ⚙️ `payment_failed_1` → 🤖 bot asks them to **try again**.
4. **Payment fails 2nd** → ⚙️ `payment_failed_2` → 🤖 bot offers **e-transfer**: sends
   e-transfer form + e-transfer details, applies `tag_skin form submitted_etransfer version`.
5. **E-transfer paid** → staff types **"deposit received"** → 🤖 bot applies
   `payment_deposit_success` + books. 🔜
6. **No payment / no reply** → 🤖 check agreed slot; if still open, remind in 2h. 🧩
   (scheduler) After 2 days ⚙️ workflow removes `payment_failed_1/2` + etransfer tag.
   If the slot got taken → bot helps find another. 🔜

## Cancellation (non-package) — 🤖 in prompt (`09_policies.md`)
<24h → remind deposit forfeit, confirm; >12h → suggest reschedule (keep deposit);
else confirm + cancel.

## Rescheduling (non-package) — 🤖 in prompt (`09_policies.md`)
12h+ → same deposit, new slot. <12h → forfeit + new deposit → remove
`payment_deposit_success`, refill form, start over. Max **2** reschedules per
deposit (remind on 2nd; 3rd forfeits, no reschedule). 🔜 reschedule counter store.

## Booking calendar rules (bot FOLLOWS, never overrides) 🔜
Real availability only · start from **12pm** · **max 5 back-to-back** · cluster (no
gaps) · facial→facial cal, wax→wax cal · combination = **back-to-back, one person**
· blocked/personal-calendar times are respected (GHL returns them as unavailable).

## Reviews name-match 🧩 (complex — needs Google review monitoring)
Google gives no email, so GHL can't tag the reviewer. Idea: when a review posts,
compare the reviewer **name** to clients who **showed** today/yesterday; on a match
→ tag `review_received`. Needs a Google-reviews feed + matching job (separate build).

## What's built now vs next
- ✅ Bot **reads live GHL tags** each turn and reacts (package/payment_failed/deposit).
- ✅ Cancellation + rescheduling conversation rules in the prompt.
- 🔜 "deposit received" → **auto-create appointment** + booking tags + note.
- 🔜 Reschedule counter; slot re-offer if taken.
- 🧩 2-day follow-up scheduler; Google-review name matching.
