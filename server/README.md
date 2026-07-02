# Beauty Cocktail Skincare — Backend (Martini)

Node.js + Express API that powers the Martini chatbot. Loads the modular prompt
framework in [`prompts/`](prompts/), stores memory + conversations in Supabase,
retrieves knowledge with pgvector (RAG), and generates replies with OpenAI.

## Stack
- **Express** (ESM) — HTTP API
- **OpenAI** — chat (`gpt-4o-mini`) + embeddings (`text-embedding-3-small`)
- **Supabase (Postgres + pgvector)** — contacts (memory), conversations,
  messages, knowledge base, follow-ups

## Setup
```bash
cd server
npm install
cp .env.example .env      # fill in real values (already done for this project)
npm run migrate           # applies schema.sql to Supabase
npm run dev               # http://localhost:4000  (auto-reloads)
```

## Environment (`.env`)
See `.env.example`. Key vars: `OPENAI_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SECRET_KEY` (server-only, bypasses RLS), `DATABASE_URL` (migrations),
`CLIENT_ORIGINS` (CORS allow-list for the widget + admin).

## Database
`schema.sql` is idempotent. Run it with `npm run migrate`, or paste it into
**Supabase → SQL Editor**. Tables: `contacts`, `conversations`, `messages`,
`knowledge_base`, `follow_ups`, `staff_profiles`. RLS is ON with no public
policies — all access goes through this backend via the secret key.

## API
| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET  | `/health` | – | health check |
| POST | `/api/chat` | – | send a visitor message, get Martini's reply |
| GET  | `/api/leads` | admin | list contacts/leads |
| PATCH| `/api/leads/:id` | admin | update a lead |
| GET  | `/api/conversations` | admin | list conversations |
| GET  | `/api/conversations/:id/messages` | admin | full thread |
| POST | `/api/knowledge` | admin | add a knowledge chunk (RAG) |
| GET  | `/api/dashboard/stats` | admin | dashboard counters |

`POST /api/chat` body:
```json
{ "conversationId": "optional-uuid", "text": "Hi!", "channel": "website",
  "visitor": { "name": "Sara", "email": "sara@x.com", "phone": "+1…", "concern": "acne" } }
```
Returns `{ "conversationId", "reply" }`. The server owns memory — pass the
returned `conversationId` on subsequent turns so Martini remembers.

Admin routes expect `Authorization: Bearer <supabase-jwt>` (the admin panel
sends the logged-in user's token).

## How a chat turn flows (`src/services/chat.service.js`)
1. Resolve/create the **contact** (memory) + **conversation**
2. Persist the user message
3. Fetch recent history + **RAG** knowledge (`match_knowledge`)
4. Assemble the system prompt from `prompts/01..19` + runtime context
5. Call OpenAI, persist the reply, return it

## Next steps
- Create an **admin user** in Supabase → Authentication (to log into the panel).
- Ingest knowledge (`POST /api/knowledge`) as the client provides services,
  pricing, policies, FAQ, and Instagram exports — this powers RAG.
- Wire **GHL** tools (booking form, deposit verification, tags) — see
  `prompts/15_ghl_tools.md`.
