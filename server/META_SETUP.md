# Instagram (Meta) auto-reply — setup

The backend receives Instagram DMs via a Meta webhook, runs them through Martini,
and replies via the Graph API.

## Endpoints (already built)
- `GET  /webhooks/meta` — verification handshake (uses `META_VERIFY_TOKEN`).
- `POST /webhooks/meta` — receives messages → Martini → auto-reply.

Deployed URL will be: `https://<your-backend>.vercel.app/webhooks/meta`

## Environment variables (set in server/.env locally + Vercel dashboard)
| Var | What |
|---|---|
| `META_ACCESS_TOKEN` | **Long-lived Page/IG access token** (NOT a short-lived user token) |
| `META_ACCOUNT_ID` | The **Page ID / IG business account ID** used to send messages |
| `META_VERIFY_TOKEN` | Any string you choose; must match the value entered in Meta's webhook config (currently `bcs_meta_verify_2f9a7c`) |
| `META_APP_SECRET` | Optional — enables webhook signature verification |
| `META_GRAPH_VERSION` | `v21.0` |
| `META_GRAPH_BASE` | `https://graph.facebook.com` |

## Steps in the Meta App dashboard
1. **App type:** Business. Add the **Instagram** (Messaging) and/or Messenger product.
2. Connect the **Instagram professional account** (linked to a Facebook Page).
3. Get a **long-lived Page access token** with `instagram_manage_messages`,
   `instagram_basic`, `pages_messaging` (+ `pages_manage_metadata` for webhooks).
   → put it in `META_ACCESS_TOKEN`. Put the Page/IG id in `META_ACCOUNT_ID`.
4. **Webhooks** → add callback URL `https://<backend>.vercel.app/webhooks/meta`
   and Verify Token = `META_VERIFY_TOKEN`. Click Verify (must return 200).
5. **Subscribe** the Instagram object to the **`messages`** field (and `messaging_postbacks`).
6. Subscribe the Page to the app (POST `/{page-id}/subscribed_apps`).

## Current status (verified)
- ✅ **Long-lived token** obtained (~60 days) via `scripts/setup-meta-token.js` and
  saved to `.env`. Refresh before expiry by re-running with a fresh short token.
- ✅ **IG Business Account ID:** `17841459800241468` (in `META_ACCOUNT_ID`; send
  endpoint is `/{ig-id}/messages`). WhatsApp Business Account: `1919982541897242`.
- ✅ Receive → Martini → reply pipeline verified locally.
- ⛔ **Blocker: send returns `(#3) Application does not have the capability to make
  this API call`.** This is a **Meta App** setting, not code. To resolve:
  1. In the Meta App → **Instagram → API setup with Facebook login** → make sure
     **messaging** is configured and the IG account is connected.
  2. Instagram app (on phone) → the professional account must **allow access to
     messages / connected tools**.
  3. **Advanced Access** for `instagram_manage_messages` (via App Review) is needed
     to message the general public. In **Development mode** you can only message
     users who have a **role in the app** (admin/dev/tester) — good enough to test.
  4. Messages can only be sent inside the **24-hour** window after the user DMs you
     (or with an approved message tag).

## Notes / known
- The very first token shared was short-lived and has been replaced by the
  long-lived one above.
- **Human handover** (pause bot when a human replies) is NOT built yet — see the
  roadmap. Until then the bot auto-replies to every incoming DM.
- **De-dup / retries:** Meta may retry a webhook; message-id de-duplication can be
  added if duplicates appear.
- **WhatsApp:** the same pattern applies (different webhook object + send API) —
  can be added next.
