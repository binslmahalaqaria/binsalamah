# WhatsApp link server (unofficial)

Connects the company WhatsApp to the CRM page `/admin/whatsapp` as a **linked device**
(the same mechanism as WhatsApp Web), using the open-source Baileys library.

> **Risk:** this is not an official WhatsApp API. WhatsApp may restrict or ban numbers
> that use unofficial clients. The client accepted this on 2026-10-12. The official
> alternative is the WhatsApp Business Platform (Cloud API, "coexistence" onboarding).

## Run

```bash
cd wa-server
npm install
npm start
```

It listens on `http://localhost:4100` (set `PORT` to change). The CRM reads the address
from `NEXT_PUBLIC_WA_SERVER_URL` (default `http://localhost:4100`).

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4100` | HTTP port |
| `CRM_ORIGIN` | `http://localhost:3000` | Comma-separated origins allowed to call the API (add `https://<crm domain>` in production) |
| `FIREBASE_PROJECT_ID` | read from `../.env.local` | Used to verify staff ID tokens |

## How it works

- **Several numbers ("sources")**: managers add company numbers, each employee with WhatsApp access can link their own. Each source has a default employee (sees all its chats; gets the client on "add as client") and a visibility: `team` (everyone with access; employees see only their own clients there) or `private` (owner, default employee, managers). Visibility is enforced by the server. A pre-existing single-number setup is migrated to source `company-1` on first start.
- Per-chat tags are stored on the server.

- Every API call needs the signed-in CRM user's Firebase ID token; the server verifies it
  and reads that user's own `staff` doc (must be `active`). Logout needs owner/manager.
- `data/sources.json` holds the sources; `data/sessions/<id>/auth/` each WhatsApp session and `data/sessions/<id>/store.json` its recent chats, messages and tags (text only, last 300 per chat). **Keep `data/` private**; it is git-ignored.
- Groups, status updates, and channels are ignored. Media shows as a placeholder.

## Production

Vercel cannot run this (it needs a process that stays connected). Host it on a small
always-on server (e.g. a VPS, Railway, or Render) with persistent disk for `data/`,
behind HTTPS, set `CRM_ORIGIN` to the CRM domain, and set `NEXT_PUBLIC_WA_SERVER_URL`
in Vercel to its HTTPS address.
