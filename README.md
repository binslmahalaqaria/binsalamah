# Bin Salmah Real Estate — Website + CRM

See [`CLAUDE.md`](./CLAUDE.md) for the full project reference (architecture,
data model, roadmap, decisions). See [`TESTING.md`](./TESTING.md) /
[`TESTING_LOG.md`](./TESTING_LOG.md) for the test plan and run history.

## Stack
Next.js (App Router) + Firebase (Firestore, Auth, Storage) + `next-intl`
(bilingual Arabic/English) + Tailwind CSS. Deployed on Vercel.

## First-time setup

1. **Create a Firebase project** at https://console.firebase.google.com.
2. In the project, enable:
   - **Firestore Database** (production mode).
   - **Authentication** → Email/Password sign-in method.
   - **Storage**.
3. Add a **Web app** to the Firebase project (Project settings → General →
   Your apps) and copy its config values.
4. Copy `.env.local.example` to `.env.local` and fill in the
   `NEXT_PUBLIC_FIREBASE_*` values from step 3, plus
   `NEXT_PUBLIC_WHATSAPP_NUMBER`.
5. Install dependencies and run the dev server:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000 — it redirects to `/ar` by default.

## Deploying Firestore/Storage security rules

Requires the [Firebase CLI](https://firebase.google.com/docs/cli):
```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your Firebase project
firebase deploy --only firestore:rules,storage:rules
```
Rules live in [`firestore.rules`](./firestore.rules) and
[`storage.rules`](./storage.rules) — keep them in sync with `CLAUDE.md` §6.

## Creating the first admin (CRM) account

1. Download a service account key: Firebase console → Project settings →
   Service accounts → Generate new private key → save as
   `service-account.json` in the project root (already git-ignored).
2. Run:
   ```bash
   npm run seed:admin -- --email you@company.com --password "a-strong-password" --name "Your Name"
   ```
3. Log in at `/ar/admin/login` (or `/en/admin/login`) with those credentials.

## Deploying to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket and import it in Vercel, or run
   `vercel` from the project root.
2. In the Vercel project settings, add the same environment variables from
   `.env.local` (all `NEXT_PUBLIC_*` ones, plus `NEXT_PUBLIC_WHATSAPP_NUMBER`).
3. Deploy. No further config needed — Next.js on Vercel works out of the box.

## Project structure

See `CLAUDE.md` §10 for the full target folder layout. In short:
- `app/[locale]/(public)/...` — public website (bilingual, no auth).
- `app/[locale]/admin/...` — internal CRM (auth required, role-based).
- `lib/` — Firebase init, shared types, validators, auth context.
- `messages/{ar,en}.json` — UI translation strings.
- `firestore.rules`, `storage.rules` — security rules.
