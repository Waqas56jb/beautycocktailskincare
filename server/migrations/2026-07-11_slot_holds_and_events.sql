-- BC Smart Bot v1 — slot locking + event logging (run in Supabase SQL editor).
-- Safe to run more than once.

-- ── Slot holds: prevent double-booking. A hold is created at step 7 (form+deposit
--    sent) and lasts 1 hour. The partial unique index means two leads can never
--    hold the SAME slot_start at the same time.
create table if not exists slot_holds (
  id           uuid primary key default gen_random_uuid(),
  slot_start   timestamptz not null,
  slot_end     timestamptz not null,
  contact_id   text,                 -- GHL contact id
  service      text,                 -- facial | wax | facial_wax
  status       text not null default 'held'
                 check (status in ('held','confirmed','expired','released')),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

-- Only ONE active hold per slot start time.
create unique index if not exists slot_holds_one_active
  on slot_holds (slot_start)
  where status = 'held';

create index if not exists slot_holds_expires on slot_holds (expires_at) where status = 'held';

-- ── Booking events: per-step audit log for debugging + drop-off analysis.
create table if not exists booking_events (
  event_id     uuid primary key default gen_random_uuid(),
  contact_id   text,
  conversation_id uuid,
  step         text,                 -- welcome | basics | availability | slot_search | ...
  payload      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists booking_events_contact on booking_events (contact_id);
create index if not exists booking_events_step on booking_events (step);
