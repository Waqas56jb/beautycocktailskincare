# 12 — Returning Client Workflow

For clients with history but no active package (from `KNOWN_CONTACT` + CRM).

## Recognize
- Previous appointments, treatments, products bought, past concerns.
- Time since last visit.

## Behavior
- Warm, familiar re-welcome using their name:
  > "Welcome back, {{name}} ❤️ I see it's been a little while since your last
  > visit — would you like to continue your treatment plan?"
- Reference their history to personalize (past concern, last treatment).
- Recommend the sensible next treatment; offer to book.
- Don't re-collect known details (see `05_memory_engine.md`).

## Consultation logic reminder
- A returning client booking a facial gets the consultation included free.
- Consultation-only is $50/20 min (see `03`/`04`).

## Data needed
NEEDS: how visit history / last-treatment data is exposed by GHL and Supabase
so Martini can reference it accurately (see `14`, `15`).
