-- ============================================================================
-- Beauty Cocktail Skincare — Supabase schema
-- Run in Supabase → SQL Editor (or: psql "$DATABASE_URL" -f schema.sql)
-- Safe to re-run (idempotent).
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;      -- embeddings for RAG

-- updated_at helper ----------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- contacts  (leads + clients = the bot's long-term memory per person)
-- ============================================================================
create table if not exists contacts (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- identity
  name                  text,
  phone                 text,                 -- GHL links the DM to a contact by phone
  email                 text,
  gender                text,
  birthday              date,

  -- skincare profile
  concern               text,
  previous_treatments   text,
  products_bought       text,
  package               text,
  membership            text,

  -- booking / money
  booked_date           timestamptz,
  cancelled_date        timestamptz,
  deposit_paid          boolean not null default false,
  deposit_amount        numeric(10,2),
  payment_status        text,                 -- e.g. none | pending | paid

  -- classification (see prompts/14_crm_rules.md)
  client_type           text not null default 'New Lead',
  tags                  text[] not null default '{}',

  -- attribution
  source                text,                 -- website | instagram | whatsapp | ad | ...
  referral              text,
  campaign              text,

  -- internal
  notes                 text,
  conversation_summary  text,
  ghl_contact_id        text,
  custom_fields         jsonb not null default '{}'::jsonb
);

-- One contact per phone / email when present (allows many NULLs)
create unique index if not exists contacts_phone_key on contacts (phone) where phone is not null;
create unique index if not exists contacts_email_key on contacts (lower(email)) where email is not null;
create index if not exists contacts_client_type_idx on contacts (client_type);
create index if not exists contacts_tags_idx on contacts using gin (tags);
create index if not exists contacts_ghl_idx on contacts (ghl_contact_id);

drop trigger if exists trg_contacts_updated on contacts;
create trigger trg_contacts_updated before update on contacts
  for each row execute function set_updated_at();

-- ============================================================================
-- conversations
-- ============================================================================
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid references contacts(id) on delete set null,
  channel         text not null default 'website'
                    check (channel in ('website','instagram','whatsapp','facebook')),
  status          text not null default 'open'
                    check (status in ('open','closed','needs_human')),
  assigned_to     uuid,                 -- staff auth.users id, when a human takes over
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists conversations_contact_idx on conversations (contact_id);
create index if not exists conversations_status_idx on conversations (status);
create index if not exists conversations_last_msg_idx on conversations (last_message_at desc);

drop trigger if exists trg_conversations_updated on conversations;
create trigger trg_conversations_updated before update on conversations
  for each row execute function set_updated_at();

-- ============================================================================
-- messages
-- ============================================================================
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user','bot','agent','system')),
  content         text not null,
  meta            jsonb not null default '{}'::jsonb,   -- tokens, model, tool calls, etc.
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id, created_at);

-- ============================================================================
-- knowledge_base  (RAG: website pages, FAQ, policies, products, IG history, notes)
-- text-embedding-3-small => 1536 dimensions
-- ============================================================================
create table if not exists knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'note'
                check (source in ('website','faq','policy','product','pricing',
                                  'instagram','conversation','note')),
  title       text,
  content     text not null,
  embedding   vector(1536),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists knowledge_source_idx on knowledge_base (source);
-- Approximate nearest-neighbour index (cosine). Build after you have some rows.
create index if not exists knowledge_embedding_idx on knowledge_base
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

drop trigger if exists trg_knowledge_updated on knowledge_base;
create trigger trg_knowledge_updated before update on knowledge_base
  for each row execute function set_updated_at();

-- Vector similarity search used by the backend (searchKnowledge)
create or replace function match_knowledge (
  query_embedding vector(1536),
  match_count int default 5,
  similarity_threshold float default 0.2
)
returns table (
  id uuid,
  source text,
  title text,
  content text,
  similarity float
)
language sql stable as $$
  select
    kb.id,
    kb.source,
    kb.title,
    kb.content,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where kb.embedding is not null
    and 1 - (kb.embedding <=> query_embedding) > similarity_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================================
-- follow_ups  (follow-up engine — prompts/13)
-- ============================================================================
create table if not exists follow_ups (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references contacts(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  due_at          timestamptz not null,
  template        text,
  reason          text,
  status          text not null default 'pending'
                    check (status in ('pending','sent','cancelled')),
  created_at      timestamptz not null default now()
);

create index if not exists follow_ups_due_idx on follow_ups (status, due_at);
create index if not exists follow_ups_contact_idx on follow_ups (contact_id);

-- ============================================================================
-- staff_profiles  (admin panel users; linked to Supabase Auth)
-- ============================================================================
create table if not exists staff_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'staff' check (role in ('staff','admin','owner')),
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- staff_credentials  (admin-panel convenience: lets an admin view/reset the
-- password they set for a staff account. Stored plaintext BY REQUEST — service
-- key only, RLS denies all. For higher security, disable password viewing and
-- rely on Supabase's hashed auth + password resets instead.)
-- ============================================================================
create table if not exists staff_credentials (
  id          uuid primary key references auth.users(id) on delete cascade,
  password    text,
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- All app data is accessed through the backend using the SECRET (service) key,
-- which bypasses RLS. We enable RLS with NO permissive policies so the
-- publishable/anon key CANNOT read these tables directly from the browser.
-- Staff read their own profile row (used by the admin panel after login).
-- ============================================================================
alter table contacts        enable row level security;
alter table conversations   enable row level security;
alter table messages        enable row level security;
alter table knowledge_base  enable row level security;
alter table follow_ups        enable row level security;
alter table staff_profiles    enable row level security;
alter table staff_credentials enable row level security;

drop policy if exists "staff read own profile" on staff_profiles;
create policy "staff read own profile" on staff_profiles
  for select using (auth.uid() = id);

-- ============================================================================
-- Done.
-- ============================================================================
