# Deploying the server to Vercel

The backend runs on Vercel as a **serverless function** (Express is exported
from `api/index.js`; there is no long-running `listen()` in production). All
routing is handled by `vercel.json`.

## 1. Import the project
- Vercel → **Add New → Project** → import this Git repo.
- **Root Directory:** set to **`server`** ← important (click "Edit" and choose `server`).
- Framework Preset: **Other** (leave as detected). Build command / output can be
  left empty — `vercel.json` handles it.

## 2. Add Environment Variables
`.env` is gitignored and is **not** deployed. You must add these in
**Vercel → Project → Settings → Environment Variables** (Production + Preview).

Copy these keys/values (from your local `server/.env`):

| Key | Value |
|---|---|
| `OPENAI_API_KEY` | `sk-proj-…` (your key) |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `SUPABASE_URL` | `https://cqzjfjdpqmvilwwkokda.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` (server-only) |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `DATABASE_URL` | `postgresql://postgres.cqzjfjdpqmvilwwkokda:…@…pooler.supabase.com:6543/postgres` |
| `CLIENT_ORIGINS` | your deployed frontend URLs, comma-separated (see below) |
| `NODE_ENV` | `production` |

> `PORT` is **not** needed on Vercel (serverless assigns it).
> `GHL_API_KEY` / `GHL_LOCATION_ID` — add when available.

### CLIENT_ORIGINS
Set this to the exact origins of the client widget + admin panel. Current
deployed value:
```
https://beautycocktailskincare-client.vercel.app,https://beautycocktailskincare-admin.vercel.app
```
This is the CORS allow-list; requests from other origins are rejected.

## Live URLs
- Backend:  https://beautycocktailskincare-backend.vercel.app
- Client (chatbot): https://beautycocktailskincare-client.vercel.app
- Admin:    https://beautycocktailskincare-admin.vercel.app

## 3. Deploy
Click **Deploy**. When it finishes, verify:
- `https://<your-server>.vercel.app/health` → `{"ok":true,"env":"production"}`
- `POST https://<your-server>.vercel.app/api/chat` with `{"text":"hi"}` → a reply.

## 4. Point the frontends at it
In the **client** and **admin** Vercel projects, set:
```
VITE_API_URL=https://<your-server>.vercel.app
```
and redeploy them.

## Notes / troubleshooting
- **Root Directory must be `server`** — otherwise Vercel can't find `vercel.json`
  / `api/index.js` and the deploy "does nothing".
- The prompt files in `prompts/` are bundled via `vercel.json`
  (`config.includeFiles`) so Martini's brain ships with the function.
- Database migrations are **not** run on deploy. Run `npm run migrate` locally
  (or paste `schema.sql` into the Supabase SQL Editor) — already done for this
  project.
- The direct Postgres `DATABASE_URL` is only used by `scripts/migrate.js`, not by
  the serverless function (which uses the Supabase REST client).
