# Bin Salmah Real Estate — Company Website + Internal CRM

> **This is the permanent reference file for this project.** It is the single source of truth for the idea, decisions, architecture, data model, plan, and current status. If anything in the actual code ever conflicts with this file, **this file must be corrected immediately** so it always reflects reality, not just intentions.

## 0) Mandatory Working Protocol (read this first, every time)

1. **Before starting any task:** read this entire file, plus `TESTING.md` and `TESTING_LOG.md`, to load full context. Do not rely on memory of a previous session.
2. **While working:** if a decision is made that isn't already documented here (a new page, a new database field, a new integration, a change to a rule, a new dependency, a change of scope), write it down in the relevant section as part of the same task — not "later."
3. **Before ending any task, always do ALL of the following** (this is not optional):
   - Update the **Update Log** (bottom of this file) with: date, what changed, why, and which Roadmap items it affects.
   - Check/uncheck the relevant boxes in **Roadmap** (§7).
   - If the Firestore schema changed → update **Data Model** (§5) and **Security Rules** (§6).
   - If a new page/screen/feature was added or changed → update **Website Structure** (§8) or **CRM Structure** (§9) and the **Folder Structure** (§10).
   - If a new environment variable, service, or dependency was introduced → update **Environment & Configuration** (§11).
   - Add corresponding new test cases to `TESTING.md`, and log the test run/result in `TESTING_LOG.md`.
4. **Never let this file go stale.** A stale CLAUDE.md is treated as a bug. If you notice this file describes something the code no longer does (or vice versa), fix the file in the same task.

---

## 1) Project Overview

Bin Salmah is a real estate marketing company. It does not build properties — it receives property offers/listings from developers and property owners, and markets/showcases them to potential buyers/clients. The company currently handles client inquiries manually through WhatsApp and phone calls, with no central system to track them.

### Business Goal
Give the company two connected systems:

1. **Public Website** — a professional, simple, brand-consistent showcase of the company and the real estate offers it currently represents, so potential clients can browse offers and express interest without needing to call first.
2. **Internal CRM** — a private staff tool to (a) manage which offers are shown on the public website, and (b) track every customer lead — regardless of whether it came from the website, a WhatsApp message, or a phone call — through a simple pipeline from "new" to "closed."

### Why these two systems must share one database
An offer added by staff in the CRM must appear on the public site immediately, with no manual syncing. A client's "Register interest" submission on the website must appear as a lead in the CRM immediately, with no manual entry. This is why both systems are one Next.js codebase talking to one Firebase project, not two separate systems glued together later.

### There is no custom backend server
Firebase **is** the backend: Firestore is the database, Firebase Auth is the login system, Firebase Storage holds images. Next.js is the frontend only — pages and components call the Firebase client SDK directly (`lib/firebase.ts`); there is no Express/Node API layer in between. **Firestore Security Rules (§6) are the real authorization boundary**, not application code — every read/write permission decision must be enforced there, not just hidden behind UI. Client-confirmed decision (2026-09-04): do not introduce a custom backend server for this project.

Two deliberate, narrow exceptions, both using the Firebase **Admin** SDK for one privileged operation each — neither is "application logic," both are unavoidable because the Firebase client SDK structurally can't do these things:
1. `scripts/seed-admin.ts` — a one-off local CLI script to bootstrap the first staff account. Never called from the website or CRM UI.
2. `app/api/staff/route.ts` — a single Next.js API route (serverless function) that creates a new staff account (Firebase Auth user + `staff` Firestore doc). Needed because the client SDK's `createUserWithEmailAndPassword` **signs in as the new user**, which would replace the calling admin's own session — there's no client-side way to create another user's account without that side effect. The route independently re-verifies that the caller's ID token belongs to an active `admin` before doing anything, so it doesn't weaken the Security-Rules-are-the-boundary model — it's the same boundary, just checked in the one place the client SDK physically cannot reach. See `lib/staff-client.ts` for how the CRM calls it.
   - **Implementation note (2026-09-13):** this route does **not** use `firebase-admin/auth` — that module unconditionally pulls in `jwks-rsa`, which does a CJS `require()` of the ESM-only `jose` package, and that interop crashes deployed Vercel functions with `ERR_REQUIRE_ESM` under Turbopack (works fine in `next dev`; also fine in `scripts/seed-admin.ts`, which runs under plain Node, not Turbopack). Excluding the package via `serverExternalPackages` in `next.config.ts` wasn't enough — the failure is inside `firebase-admin/auth`'s own `token-verifier.js`, one level too deep for that config to help with. The route instead verifies the caller's ID token by hand with a direct `jose` import (`jwtVerify` against Firebase's public JWKS, checking `iss`/`aud`), and creates the new user via the Identity Platform REST API directly, authenticated with a hand-signed JWT-bearer OAuth assertion (Node's built-in `crypto`, no `google-auth-library`). `firebase-admin/firestore` is untouched and still used normally for the `staff` doc write — only `/auth` was ever the problem. See the Update Log for the two failed intermediate attempts, kept there so this isn't rediscovered from scratch later.

### Primary Users
- **Public website visitors:** potential buyers browsing real estate offers. No login, no account.
- **CRM staff — role `sales`:** manages leads assigned to them, can view offers, cannot delete offers or manage other staff.
- **CRM staff — role `admin`:** full access — manages offers, all leads, and staff accounts.

### Non-Goals (explicitly out of scope for now — do not build unless requested)
- No online payments or transactions of any kind.
- No client-facing accounts/login on the public website (visitors never log in).
- No mobile app (responsive web only).
- No multi-tenant support (this is a single company, not a SaaS platform for multiple agencies).
- No automated WhatsApp integration yet (see Phase 3 — deferred, not scheduled).
- No advanced analytics/BI — Phase 2 dashboard is simple counts only.

---

## 2) Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Framework | **Next.js** (App Router, single project) | Serves both the public website and the CRM dashboard from one codebase via protected routes `/admin/*` |
| Database | **Firebase Firestore** | No server management, easy integration with Next.js, free tier is enough to start |
| Auth | **Firebase Auth** (email/password) | For CRM staff login only (the public website needs no login) |
| Image storage | **Firebase Storage** | For property offer images |
| Hosting | **Vercel** | Best fit for Next.js (automatic deploys, previews per PR, image optimization) |
| Styling | Tailwind CSS (default choice unless changed) | Fast to build a clean, simple UI matching a brand identity via config tokens |
| WhatsApp (now) | Direct link (`wa.me/<number>?text=...`) on "Contact us" buttons | Business API is not ready yet |
| WhatsApp (later) | WhatsApp Business API (Meta Cloud API) | To auto-convert incoming messages into a Lead inside the CRM — **future phase, not scheduled yet** |
| Repo language | **English only** — all code, comments, docs, commit messages | Explicit client instruction, even though chat/discussion with the client is in Arabic |
| Live UI language | **Bilingual (Arabic + English)** for both the public website and the CRM | Client decision (2026-09-04). Arabic is the default/primary locale (main audience is Saudi clients), English is secondary. Code/copy keys stay English per the row above; only the *rendered* UI and content are bilingual |
| i18n solution | `next-intl` (or equivalent App Router i18n library) with locale segments `/ar/...` and `/en/...` | Standard, well-supported approach for Next.js App Router bilingual routing, including RTL/LTR switching |

---

## 2b) Brand Identity (resolved 2026-09-13)

Source: client-provided PDF `بن سلمه العقارية.pdf` (a 3-page brand concept deck — cover, logo-on-color variations, concept rationale. Not a full brand book: no explicit typography/spacing/usage-rules pages, no listed hex codes — colors and the icon mark were extracted directly from the artwork, see below).

**Colors** (sampled directly from the PDF artwork, not guessed):
| Token | Hex | Role |
|---|---|---|
| Navy | `#161F28` | Primary text/dark surfaces |
| Gold | `#967E5A` | Brand accent — buttons, highlights, icon-on-dark |
| Cream | `#F8F4EB` | Primary light background |

**Fonts** (per `pdffonts` on the source PDF): the logo/deck uses **Noor** (Bold/Regular) and **BahijJanna** — both commercial Arabic type foundries, not available as web fonts / not on Google Fonts, and no license or font files were provided. Using close free alternatives instead until/unless the client provides real licensed web-font files: **Cairo** (bold/black weights) for headings and the wordmark, **Tajawal** for body text — both support Arabic + Latin, loaded via `next/font/google`. Revisit if the client can supply the actual Noor/BahijJanna web font files.

**Logo mark**: the brand PDF contains no standalone vector/transparent logo export (it's a presentation deck with the logo embedded in photo scenes) — the 3-bar geometric icon was recovered by rendering the PDF at high resolution, thresholding the flat-color mark against its (single-color) background to get a clean binary silhouette mask, then recoloring that mask. This produced pixel-accurate, fully transparent PNGs — verified by compositing over both cream and navy. **The Arabic wordmark ("بن سلمه العقارية") is rendered as live text in the Cairo font, not as an extracted image** — the source PDF's wordmark sits over a busy photo, so an extracted crop always carried background fringing (tried and rejected, see Update Log); live text is crisper, scales properly, and is accessible/SEO-friendly, at the cost of not matching the exact custom "Noor" letterforms. If the client wants the exact original wordmark, they should provide the vector source file.

Files, all in `/public/brand/`: `logo-mark-navy.png`, `logo-mark-gold.png`, `logo-mark-cream.png` (icon only, transparent, ~512px, pick the variant with contrast against wherever it's placed). Also wired up as the site's actual favicon/app icons: `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` (all derived from the gold-on-navy mark).

---

## 3) Design / Structure Reference

Analyzed a competitor site (**thiraa.sa/ar**) purely as a structural/UX reference — **not** for visual identity (our brand identity is separate and still pending, see §12). Key structural takeaways adopted for our plan:

- **Header:** Logo + nav links + a prominent "Contact us" (WhatsApp) button, collapses to a hamburger menu on mobile.
- **Hero:** Headline + short tagline + a primary CTA button (browse offers / contact us).
- **Offer filters:** by type (apartment/villa/floor...), district, price range, number of rooms. Filters are visible directly below the hero, not hidden in a menu.
- **Offer card:** image, property type tag, name, location (city - district), sold percentage (optional social-proof element), price range, area range, and two buttons:
  - **"Contact us"** → opens WhatsApp directly with a pre-filled message referencing the offer.
  - **"Register interest"** → opens a short inline form (name + phone, optionally a note) that creates a Lead in Firestore tagged with `source = website_interest` and `related_offer_id`. This is the **primary lead-generation mechanism** of the whole website — treat it as the most important interaction on the site.
- **Floating WhatsApp button**, present on every page, always visible.
- **Footer:** contact channels (emails/phone numbers, can be per department later), social links, copyright, address/map link.

> Note: thiraa.sa is Arabic-only. Our own site (and the CRM) is **bilingual (Arabic + English)** — decided 2026-09-04, see §2 and §12.

---

## 4) Information Architecture Overview

Both the public site and the CRM are bilingual (Arabic default / English secondary), so every route below is prefixed with a locale segment: `/ar/...` or `/en/...`. A visit to `/` redirects to the default locale (`/ar`). A language switcher (in header + admin nav) swaps the locale segment while staying on the same logical page.

```
Public (no auth)                          Internal / CRM (auth required)
──────────────────────                    ──────────────────────────────
/[locale]                (Home)           /[locale]/admin/login
/[locale]/offers         (Listing)        /[locale]/admin                (Dashboard)
/[locale]/offers/[slug]  (Offer detail)   /[locale]/admin/offers          (List)
/[locale]/about                           /[locale]/admin/offers/new      (Create)
/[locale]/contact                         /[locale]/admin/offers/[id]/edit(Edit)
                                           /[locale]/admin/leads           (List)
                                           /[locale]/admin/leads/[id]      (Detail / timeline)
                                           /[locale]/admin/staff           (Admin-only: manage staff)
                                           /[locale]/admin/settings        (Admin-only: company contact info, WhatsApp number)
```

`locale` is `ar` or `en`. Arabic pages render `dir="rtl"`, English pages render `dir="ltr"` — this must be handled at the root layout level, not per-component.

---

## 5) Data Model (Firestore Collections)

### `offers`
Bilingual content fields are stored as separate `_ar`/`_en` fields (not a nested object) to keep Firestore queries/rules simple. **Arabic is required for every bilingual field; English is required before an offer can be `published`** (a `draft` may have English left empty while content is prepared).

> **Composite index required:** the public site's `listPublishedOffers()` (`where status == published, orderBy updated_at desc`) needs a Firestore composite index — defined in `firestore.indexes.json` and already deployed. If a similar new query combining an equality filter with `orderBy` on a different field is added later, Firestore will throw a `failed-precondition` error with a direct link to create the needed index — add it to `firestore.indexes.json` and run `firebase deploy --only firestore:indexes` rather than only clicking the console link, so it's reproducible.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Firestore doc id (auto) |
| `title_ar` | string | required |
| `title_en` | string | required to publish, may be empty in `draft` |
| `slug` | string | auto-generated from `title_en` (or transliterated `title_ar` if English isn't set yet), must be unique, used in URL, shared across both locales |
| `type` | enum | `apartment` \| `villa` \| `floor` \| `townhouse` \| `land` \| `other` — a code value, not translated text; its display label comes from the app's i18n dictionary, not from Firestore |
| `city_ar` / `city_en` | string | required |
| `district_ar` / `district_en` | string | required |
| `price_from` | number | required, SAR (numbers are locale-agnostic, only formatted per locale in the UI) |
| `price_to` | number \| null | optional, if offer has a price range |
| `area_from` | number | required, m² |
| `area_to` | number \| null | optional |
| `rooms` | number \| null | optional |
| `bathrooms` | number \| null | optional |
| `images` | array of `{ url: string, storage_path: string, order: number }` | at least 1 required to publish |
| `cover_image` | string (url) | derived: first image by `order`, or explicitly chosen |
| `description_ar` | string | required to publish; plain text (rich text is a future nice-to-have) |
| `description_en` | string | required to publish; plain text |
| `sold_percentage` | number 0–100 \| null | optional social-proof field |
| `status` | enum | `draft` \| `published` \| `archived` |
| `featured` | boolean | optional, default `false` — used to highlight on the homepage |
| `created_at` / `updated_at` | timestamp | server timestamps |
| `created_by` / `updated_by` | string | staff uid |

### `leads`
| Field | Type | Notes |
|---|---|---|
| `id` | string | Firestore doc id (auto) |
| `customer_name` | string | required |
| `phone` | string | required, validated (Saudi format, e.g. `05XXXXXXXX` or `+9665XXXXXXXX`) |
| `email` | string \| null | optional |
| `source` | enum | `website_interest` \| `whatsapp` \| `phone_call` \| `manual` \| `other` |
| `related_offer_id` | string \| null | ref to `offers.id`, null if general inquiry |
| `message` | string \| null | optional initial note/message from the form or the call |
| `status` | enum | `new` \| `contacted` \| `interested` \| `not_interested` \| `closed_won` \| `closed_lost` |
| `assigned_to` | string \| null | staff uid |
| `notes` | array of `{ text: string, by: string (staff uid), at: timestamp }` | follow-up history, append-only |
| `created_at` / `updated_at` | timestamp | server timestamps |

### `staff`
| Field | Type | Notes |
|---|---|---|
| `id` | string | equals Firebase Auth `uid` |
| `name` | string | required |
| `email` | string | required, must match Firebase Auth account |
| `role` | enum | `admin` \| `sales` |
| `active` | boolean | default `true`; deactivated staff cannot log in (enforced in app logic + rules) |
| `created_at` | timestamp | |

### `settings` (single document at `settings/company`)
| Field | Type | Notes |
|---|---|---|
| `whatsapp_number` | string | e.g. `9665XXXXXXXX`, used for `wa.me` links site-wide |
| `contact_email` | string \| null | shown in the public site footer/contact page |
| `contact_phone` | string \| null | shown in the public site footer/contact page |
| `updated_at` | timestamp | |
| `updated_by` | string | staff uid |

### Status Lifecycle (leads)
```
new → contacted → interested → closed_won
                 → not_interested → closed_lost
```
Any status can move to `closed_lost` directly (e.g. wrong number, spam). Status changes are not required to be linear, but the UI should suggest this order.

---

## 6) Firestore Security Rules — Required Behavior

These are requirements to implement and test, not final rule syntax:

- **`offers`**
  - Public (unauthenticated): `read` allowed **only** where `status == "published"`. No public `write` under any condition.
  - Authenticated staff (`sales` or `admin`): full `read`. `create`/`update`/`delete` allowed for both roles unless a future decision restricts delete to `admin` only (currently: allowed for both — confirm with client before restricting).
- **`leads`**
  - Public (unauthenticated): `create` **only**, and only with `source in ['website_interest', 'other']`, `status == 'new'`, `assigned_to == null`, and no `notes` (used by the "Register interest" form). No public `read`, `update`, or `delete` — a visitor must never be able to see other people's leads.
  - Authenticated staff: full `create` (any source, e.g. `phone_call` for manually logged calls) + full `read`/`update`. `delete` restricted to `admin` only (leads should not be casually deletable by `sales`).
- **`staff`**
  - Public: no access at all.
  - Authenticated active staff: may `read` the full staff directory (needed for "assign to" pickers in the Leads screen).
  - `write` (create/update/delete of staff records) restricted to `admin` only. Note: creating a brand-new staff **account** (the Firebase Auth user itself) doesn't go through this Firestore rule at all — it goes through `app/api/staff/route.ts` using the Admin SDK, since the client SDK can't create another user's Auth account without replacing the caller's own session. That route independently checks the caller is an active admin before doing anything.
- **`settings`**
  - Public: `read` only (the public website needs the WhatsApp number/contact info with no login).
  - Authenticated staff: no special access. `write` restricted to `admin` only.

Any change to these rules is a security-relevant change — must be reflected here immediately, and must have a corresponding test in `TESTING.md` §"Security Rules".

---

## 7) Roadmap

> **Execution order (client decisions, 2026-09-13, updated same day): CRM first, WhatsApp deferred again.** Phase numbers below are kept as originally planned for reference. Phase 2 (Internal CRM) is done — see its section below. Phase 3 (WhatsApp) was briefly moved up ahead of Phase 1, but the client then **deferred it again**: the client's currently-used number is on the regular WhatsApp Business consumer app, and moving it to the Cloud API would disable that app on the number (Meta doesn't support running both at once) — the client hasn't yet decided whether to use a separate new number for the API or migrate the current one, see §12. **Actual build order: Phase 0 → Phase 2 → Phase 1, with Phase 3 picked up whenever the client resolves the phone-number decision** (could be before or after Phase 1, client's call).

### Phase 0 — Foundation
- [x] Create Next.js project (App Router, TypeScript, Tailwind) + connect Firebase — Firestore ✅ and Auth ✅ connected; **Storage deferred** (Firebase now requires the paid Blaze plan for Storage; client chose to postpone billing setup — see §12)
- [x] Set up i18n (`next-intl`): `[locale]` routing segment (`ar`/`en`), message dictionaries in `/messages`, `dir="rtl"`/`dir="ltr"` switching at `app/[locale]/layout.tsx`, default locale `ar` with `localeDetection: false` (a bare `/` always goes to `/ar`, never browser-language-guessed)
- [x] Implement Firestore schema per §5 (bilingual `_ar`/`_en` fields) + Security Rules per §6 — written in `firestore.rules`, deployed live via `firebase deploy --only firestore:rules,firestore:indexes`
- [x] Project structure: public routes `app/[locale]/(public)/...` and protected routes `app/[locale]/admin/...` (see §10) — implemented with placeholder content per page, to be filled in during Phase 1/2
- [x] Auth guard layout for `/[locale]/admin/*` (`app/[locale]/admin/layout.tsx` + `lib/auth-context.tsx`) — verified end-to-end in the browser: unauthenticated visit redirects to `/admin/login`, valid login reaches the dashboard, sign-out redirects back to login. Also fails gracefully (a plain message, not a crash) if Firebase env vars are missing (`isFirebaseConfigured` in `lib/firebase.ts`)
- [x] Set up Vercel deployment + environment variables — **done 2026-09-13**. Live at **https://binsalamah-chi.vercel.app**. Repo: `github.com/mohammedndw/binsalamah` (private), connected to Vercel for auto-deploy on push to `main`. All Firebase config vars set as Config in Vercel (Production + Preview); `FIREBASE_SERVICE_ACCOUNT_KEY` set as a Secret, **Production only** (deliberately not in Preview, to limit exposure of this privileged credential — see §11)
- [x] Seed script (`scripts/seed-admin.ts`, `npm run seed:admin`) — run once to create the first `admin` staff account (`modenaif126@gmail.com`), verified working via a real login in the browser

### Phase 1 — Public Website
- [x] Home page: Hero (navy, brand headline/subtitle, gold + outline CTA buttons), featured offers grid (live, up to 3 most-recently-updated published offers via `listPublishedOffers(3)`), "why choose us" 3-column section — fully bilingual, brand-styled. Quick filter bar on the home page itself was **not** built (filters live on `/offers` instead) — the roadmap's "quick filter bar" language was aspirational; revisit only if the client specifically wants filtering from the homepage
- [x] Language switcher in header — done in Phase 0, restyled to brand pill button in Phase 1, re-verified it still preserves the current page across the new pages
- [x] Offers listing page (`/offers`) — fetches all published offers (`listPublishedOffers()`), client-side filters for **type** and **city** (`components/OffersGrid.tsx`). **District, price-range, and rooms filters were not built** — deferred, add if/when the client has enough real offers for filtering to matter; the current low-volume, fetch-then-filter-client-side approach doesn't scale indefinitely but is fine for now (see §9's note on the CRM offers list for the same reasoning)
- [x] Offer detail page (`/offers/[slug]`): image + thumbnail gallery, key facts (price/area/rooms/bathrooms), description, "Contact us" (WhatsApp with an offer-specific pre-filled message) + "Register interest" form anchored at `#interest` — renders bilingual fields correctly per locale; verified live with a real offer end-to-end
- [x] "Register interest" form (`components/RegisterInterestForm.tsx`): zod-validated (`leadFormSchema`), writes via `lib/leads.ts`'s `createPublicLead()` (`source: website_interest`, `related_offer_id` set) — **verified live end-to-end**: submitted on a real offer page, confirmed the lead appeared correctly in the CRM's Leads screen immediately after
- [x] Floating WhatsApp button (`components/WhatsAppButton.tsx`'s `FloatingWhatsApp`, site-wide via the public layout) + WhatsApp buttons on offer cards and the offer detail page — pre-filled message differs per context (generic vs. offer-specific) and per locale; verified the floating button correctly flips sides between `/ar` (bottom-start) and `/en` (bottom-end)
- [x] Static pages: About (placeholder copy — real company story/mission still pending from client, see below), Contact (WhatsApp/email/phone pulled live from `settings/company` via `getPublicContactInfo()`, with an env-var fallback)
- [x] Apply brand identity — see the new §2b; implemented via `next/font/google` (Cairo + Tajawal), CSS color tokens in `app/globals.css`, the extracted logo mark assets, and real favicons. This was the big unlock for Phase 1 — see the Update Log entry for how the logo/colors were actually extracted (not guessed)
- [ ] Basic SEO (page titles/meta descriptions per locale beyond the site-wide default, sitemap, `hreflang`, Open Graph tags on offer pages) — **not done yet**, left for a later pass once real content (especially About/Contact copy and more offers) exists to write real metadata for

### Phase 2 — Internal CRM
- [x] Staff login page + session handling (Firebase Auth) — done in Phase 0, bilingual UI still plain/unstyled (real design pending §12)
- [x] Language switcher in admin nav — done in Phase 0 (CRM interface labels only; stored offer content always has both `_ar`/`_en` fields regardless of the staff member's chosen UI language)
- [x] Role-based access: `admin` vs `sales` — enforced in UI (Staff/Settings pages show "admin-only" for `sales`) and in Security Rules (`isAdmin()` in `firestore.rules`); verified live by creating a `sales` account and confirming it's blocked from both screens
- [x] Offers management: list (`app/[locale]/admin/offers/page.tsx`), create/edit (`components/admin/OfferForm.tsx`), delete, publish/unpublish toggle — all via direct Firestore client SDK calls (`lib/offers.ts`). **Image upload is via pasted URL, not Storage**, per client decision 2026-09-13 (see §12) — `lib/validators.ts`'s `canPublishOffer` only checks that at least one image URL is present, not where it's hosted
- [x] Offer create/edit form has both an Arabic and an English input for every bilingual field; "Save & publish" is blocked with a clear error until English title/city/district/description are filled and at least one image URL is added — verified live (create → publish → appears correctly in the list)
- [x] Leads management: list (`app/[locale]/admin/leads/page.tsx`) with a "Log a call" quick-create form, detail view (`app/[locale]/admin/leads/[id]/page.tsx`) with status changer, assign-to-staff dropdown, and a notes timeline — all verified live end-to-end (create → change status → assign → add note → persisted after reload)
- [x] Manual lead creation — the "Log a call" form on the leads list page, creates a lead with `source: "phone_call"`
- [x] Dashboard: published/draft offer counts, leads-by-status breakdown, total leads, recent leads list (`app/[locale]/admin/page.tsx`) — verified the numbers match actual Firestore data after creating/removing test records
- [x] Staff management screen (`admin` only, `app/[locale]/admin/staff/page.tsx`): create staff (name/email/temp password/role), change role, activate/deactivate. **Creating a new staff account required one exception to "no custom backend"** — see the new note in §1 and the `app/api/staff/route.ts` entry in §10: the Firebase client SDK can't create another user's Auth account without replacing the caller's session, so account creation goes through a minimal Admin-SDK-backed API route instead, gated on the caller being an active admin. Verified live: created a `sales` test account through this route, confirmed the admin's own session was undisturbed, and confirmed the new account could actually log in.

### Phase 3 — Advanced WhatsApp Integration (deferred again 2026-09-13 — client needs to decide on a phone number first, see §12)
- [ ] **Blocking decision:** does the client use a brand-new number for the Cloud API, or migrate their current in-use WhatsApp Business (consumer app) number? Migrating disables the regular app on that number — see §12 for the full explanation given to the client.
- [ ] Once decided: connect WhatsApp Business API (Meta Cloud API) — need credentials from client: Phone Number ID, WhatsApp Business Account ID, a **permanent** access token (via a System User, not the 24h temporary token), App Secret
- [ ] Requires a public HTTPS URL for the webhook — i.e. **Vercel deployment (Phase 0's open item) must happen before this**, Meta can't reach localhost
- [ ] Webhook endpoint to receive incoming messages, verified against the App Secret
- [ ] Auto-convert incoming messages into a `leads` doc with `source = whatsapp`
- [ ] De-duplication logic so repeated messages in the same conversation don't create duplicate leads
- [ ] Note: as scoped, this is receive-only (incoming messages → leads). It does not include sending replies through the CRM — the client would keep replying however they currently do (the regular app, if using a separate number) unless a two-way chat feature is explicitly requested later.

---

## 8) Website Structure (Public) — Page-by-Page Detail

*(This section will be filled in with final field-by-field content/copy requirements as each page is built in Phase 1. Keep it in sync with actual implementation.)*

> **Implemented in Phase 1 (2026-09-13).** Bilingual (Arabic default, English secondary) via the `[locale]` route segment — see §2, §4, §12. Fully brand-styled per §2b (Cairo/Tajawal fonts, navy/gold/cream colors, real logo). Verified live end-to-end, including a real "Register interest" submission landing correctly in the CRM.

- **Home (`/`):** Navy hero (brand headline + tagline + gold "Browse Offers" / outline "Contact Us" buttons), a live "Latest Offers" grid (up to 3, hidden entirely when there are zero published offers), a 3-column "why choose us" section (placeholder marketing copy — see About below). No quick filter bar on the home page itself (filters live on `/offers`).
- **Offers (`/offers`):** Grid of all `published` offers with client-side filters for type and city (`components/OffersGrid.tsx`). District/price-range/rooms filters not built yet (see §7). Empty state shown if there are zero published offers or none match the filters.
- **Offer detail (`/offers/[slug]`):** Image + thumbnail gallery (plain `<img>`, external URLs), title, location, type badge, price/area/rooms/bathrooms, full description, "Contact us" (WhatsApp, offer-specific pre-filled message) and "Register interest" form (`#interest` anchor, `components/RegisterInterestForm.tsx`). No "similar offers" section built.
- **About (`/about`):** Placeholder company description — **real story/mission content is still pending from the client**, this is not final copy.
- **Contact (`/contact`):** WhatsApp (live from `settings/company`, click-through), email/phone (rendered only if set in settings — currently only WhatsApp is set, see §12). No general-inquiry form, no address/map/social links — add if the client wants them.

## 9) CRM Structure (Internal) — Screen-by-Screen Detail

> **Implemented in Phase 2 (2026-09-13), functionally complete and verified live.** Visual design started the same day (also 2026-09-13, once the real brand identity existed — see §2b) and is proceeding screen by screen: shell (sidebar, login), Dashboard, Offers, Leads, and now **Staff** are fully restyled. **Only Settings remains unstyled** — it still renders plain inside the new sidebar/background. CRM interface labels (buttons, table headers, menus) are bilingual via the language switcher, independent of which locale a staff member happens to prefer — separate from offer content, which is always stored in both `_ar`/`_en` fields regardless of CRM UI language. See §5, §7.

- **Login (`/admin/login`):** Restyled — full-height navy background, centered cream card with the logo, gold submit button. Email + password, error state for invalid credentials, redirect to `/admin` on success.
- **Shell (all `/admin/*` pages, `components/admin/AdminSidebar.tsx`):** Restyled — fixed navy sidebar with the logo, icon + label nav items (gold highlight for the active route), the signed-in staff member's name and localized role at the bottom, the language switcher, and sign-out. Content area sits on a very light navy-tinted background so the white content cards (dashboard, and future restyled screens) stand out. `AdminLayout` (`app/[locale]/admin/layout.tsx`) now just composes `AdminGuard` (unchanged auth/redirect logic) with this sidebar — the old inline nav markup was extracted out.
- **Dashboard (`/admin`):** Restyled — stat cards with icons (published offers, draft offers, new leads highlighted in gold, total leads), a "leads by status" panel with colored status pills and proportional bars, and a "recent leads" card with the same status pills. Status labels come from new `LeadStatus` i18n keys (reused wherever a lead status is displayed) and `StaffRole` keys (admin/sales, used in the sidebar). Computed client-side from `listOffers()`/`listLeads()` (`lib/offers.ts`, `lib/leads.ts`) — fine at current data volume; revisit with `getCountFromServer`/aggregation queries if the collections grow large.
- **Offers list (`/admin/offers`):** Restyled 2026-09-13 — white rounded card holding the table, a thumbnail + title/city cell, colored type/status pills, and icon-only row actions (edit/publish-toggle/delete) instead of text links, plus a branded empty state (icon, message, CTA). The table wrapper uses `overflow-x-auto` with a `min-w-[640px]` table so it scrolls internally on narrow viewports instead of pushing the whole page — see the general "wide content must scroll in its own container" rule this follows. No search/filter yet — fine at current low volume, add if the list grows.
- **Offer create/edit (`/admin/offers/new`, `/admin/offers/[id]/edit`):** Restyled 2026-09-13 — the shared `components/admin/OfferForm.tsx` is now split into labeled white-card sections (Basic Info, Location, Pricing & Area, Description, Images), all inputs/labels/buttons use the brand tokens, and every user-facing string moved into new `AdminOffers`/`AdminOfferForm`/`OfferStatus` i18n keys (previously hardcoded English). Every bilingual field still has separate Arabic/English inputs. Images are a dynamic list of pasted URLs (not a Storage upload — see §12), add/remove rows freely. "Save as draft" always works; "Save & publish" is blocked client-side (`canPublishOffer` in `lib/validators.ts`) until English title/city/district/description are filled and at least one image URL exists.
- **Leads list (`/admin/leads`):** Restyled 2026-09-13 — white card table with colored source/status pills, phone rendered `dir="ltr"` so digits don't reorder inside RTL rows, and a branded empty state. **Fixed a real display bug while restyling**: the "assigned staff" column showed the raw Firebase uid instead of a name — fixed by fetching the staff list alongside leads and resolving `assigned_to` through it (same fix applied to the notes timeline on the detail page, which had the same issue for each note's `by` field). The "Log a call" inline form is now a styled white card with a Cancel button. No filters yet — add if the list grows.
- **Lead detail (`/admin/leads/[id]`):** Restyled 2026-09-13 — back link, a status pill next to the customer name, an info card (phone/source/related offer, now a link to that offer's edit page/message), status + assign-to selects in their own card, and a notes timeline showing each note with the resolved staff name (see the bug fix noted above) and a locale-aware timestamp (`toLocaleString(locale)`). Same underlying behavior as before: status/assignment write immediately on change, notes are append-only (§5).
- **Staff (`/admin/staff`, admin-only):** Restyled 2026-09-13 — white card table with an initials avatar + name/email per row, an inline role `<select>`, a status pill (Active/Inactive), and an icon-only power-toggle button (Activate/Deactivate, both direct Firestore writes — no Auth-user change needed). A `sales` staff member sees a styled restricted-access card (lock icon + message) instead of the table, matching the other empty/restricted states in the CRM. A "New staff" inline form creates the account via the `app/api/staff/route.ts` exception (see §1) — name, email, temporary password, role.
- **Settings (`/admin/settings`, admin-only):** Not yet restyled. WhatsApp number, contact email, contact phone — a single `settings/company` Firestore doc (`lib/settings.ts`), editable without a code deploy. Consumed by the public site's Contact page and WhatsApp buttons as of Phase 1.

## 10) Folder Structure (Next.js App Router — target layout)

```
/app
  /[locale]                     -> "ar" | "en", see §2/§4
    /(public)
      layout.tsx                -> sets dir="rtl"/"ltr" based on locale
      page.tsx                  -> Home
      /offers
        page.tsx                -> Listing
        /[slug]/page.tsx         -> Detail
      /about/page.tsx
      /contact/page.tsx
    /admin
      layout.tsx                -> auth guard + role check
      /login/page.tsx
      page.tsx                  -> Dashboard
      /offers
        page.tsx
        /new/page.tsx
        /[id]/edit/page.tsx
      /leads
        page.tsx
        /[id]/page.tsx
      /staff/page.tsx
      /settings/page.tsx
  /api
    /staff/route.ts              -> POST: create a staff account (Admin SDK exception, see §1)
    (WhatsApp webhook reserved here for Phase 3)
/messages
  ar.json                       -> Arabic UI strings (site + CRM)
  en.json                       -> English UI strings (site + CRM)
/lib
  firebase.ts                   -> Firebase client SDK init (db, auth, storage) + isFirebaseConfigured guard
  firebase-admin.ts             -> Admin SDK init, server-only, used only by app/api/staff/route.ts
  auth-context.tsx              -> React context: current user + staff doc + loading/configError, used by the admin layout guard
  types.ts                      -> shared TypeScript types matching §5 (bilingual fields typed explicitly, e.g. `title_ar`, `title_en`)
  validators.ts                 -> zod schemas + canPublishOffer() (lead form, offer form)
  offers.ts                     -> Firestore CRUD for `offers` (list/get/create/update/setStatus/delete) + public reads: listPublishedOffers(), getPublishedOfferBySlug()
  leads.ts                      -> Firestore CRUD for `leads` (list/get/createManual/setStatus/assign/addNote) + createPublicLead() for the public "Register interest" form
  settings.ts                   -> get/update the `settings/company` doc + getPublicContactInfo() (Firestore, falls back to env var, never throws)
  staff-client.ts               -> Firestore reads/writes for `staff` (list/setActive/setRole) + createStaffAccount() which calls the API route
/components
  admin/OfferForm.tsx           -> shared create/edit form for offers
  admin/AdminSidebar.tsx        -> branded CRM sidebar (nav, staff name/role, language switcher, sign-out)
  LanguageSwitcher.tsx          -> now takes a variant ("dark"/"light") for header vs. footer/admin placement
  Logo.tsx                      -> icon + wordmark, locale- and variant-aware (see §2b)
  OfferCard.tsx                 -> offer card (client component), used on Home and the Offers listing
  OffersGrid.tsx                -> client-side type/city filtering + grid, used by /offers
  RegisterInterestForm.tsx      -> the public lead-capture form on the offer detail page
  WhatsAppButton.tsx            -> WhatsAppLink (plain link, any surface) + FloatingWhatsApp (site-wide floating button)
/i18n
  routing.ts, navigation.ts, request.ts  -> next-intl config
/public
  brand/logo-mark-{navy,gold,cream}.png  -> extracted logo icon, transparent, see §2b
```

This reflects the actual structure as of Phase 1 — update it the moment it diverges further (e.g. a future WhatsApp webhook route, or filter/search additions to the offers pages).

## 11) Environment & Configuration

**Live Firebase project:** `binsalamah-34cb1` (console name "binsalamah"), owned by `modenaif126@gmail.com`. Firestore database created 2026-09-04 in **`me-central2` (Dammam, Saudi Arabia)** — chosen deliberately for latency, since the audience is entirely in Saudi Arabia; note this location is permanent and cannot be changed without recreating the database. Auth (Email/Password) and Firestore are live; **Storage is not yet enabled** (see §12).

| Variable | Purpose | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client config | public, safe to expose |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client config | public |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase client config | public — `binsalamah-34cb1` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase client config | public |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase client config | public |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client config | public |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Number used for `wa.me` links | **not set yet** — still empty in `.env.local`, pending the company's WhatsApp number; may move to `/admin/settings` (Firestore) once Phase 2 settings screen exists |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to a local Firebase Admin service-account JSON key | **secret** — the actual key file is `service-account.json` in the project root, git-ignored, never committed. Used locally by both `scripts/seed-admin.ts` and `app/api/staff/route.ts` (via `lib/firebase-admin.ts`'s `applicationDefault()` fallback) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | The service-account JSON as a **string**, used by `getServiceAccount()` in `app/api/staff/route.ts` (both for `firebase-admin/firestore` init and for signing the hand-rolled Google OAuth JWT-bearer assertion — see §1) | **secret** — set on Vercel as of 2026-09-13, **Production environment only** (not Preview), since there's no local file on serverless and this credential is powerful enough to be worth limiting to the one environment that actually needs it |

All of the above are already filled into `.env.local` (git-ignored) for local dev. **Not yet done:** none of these are configured in Vercel yet, since the project hasn't been deployed there (see Phase 0 Roadmap).

Update this table the moment a new secret, API key, or config value is introduced anywhere in the project.

---

## 12) Pending Decisions (need client input — do not silently assume)
- [x] ~~Final brand identity~~ — **Resolved 2026-09-13: client provided a brand concept PDF** (`بن سلمه العقارية.pdf`, 3 pages). Extracted and in use — see §2b "Brand Identity" below for full detail. Initially applied to the public website only, with the CRM staying functional-but-plain per the client's separate 2026-09-13 decision above — **superseded later that same day**: once the brand tokens existed, the client asked to start applying them to the CRM too (starting with the main dashboard shell) — see §9 for what's been restyled so far.
  - [x] ~~Naming discrepancy~~ — **Confirmed by client 2026-09-13: "بن سلمه" (Bin Salmah) is the correct company name**, matching the logo (not "بن سلامة"/"Bin Salamah", which this project had been called since the very first session — an early miscommunication, not an official alternate name). Fixed all remaining "Salamah" references in `CLAUDE.md` and `README.md` to "Salmah". **Internal technical identifiers were deliberately left unchanged**: the project folder path (`~/Desktop/binsalamah`) and the Firebase project ID (`binsalamah-34cb1`) still say "binsalamah" — renaming a Firebase project ID isn't actually possible after creation (would mean creating a whole new project and migrating data), and renaming the local folder is a cosmetic, disruptive, purely-technical change with no user-facing effect, so it's not worth doing. All user-facing copy (site content, this doc's prose, the company name wherever it's displayed) uses "Bin Salmah" / "بن سلمه" correctly.
- [x] ~~Website UI language~~ — **Resolved 2026-09-04: bilingual (Arabic + English), both the public website and the CRM.** Arabic is default/primary. See §2, §5, §7.
- [x] ~~Rentals/Lands as separate pages?~~ — **Resolved 2026-09-13: single generic "Offers" model, `type` field differentiates** (`land` is already one of the `OfferType` enum values in §5). No separate "Rentals"/"Lands" pages or collections.
- [ ] **WhatsApp Cloud API phone number decision — blocking Phase 3, deferred by client 2026-09-13.** The client's current WhatsApp number is actively used on the regular WhatsApp Business **consumer app**. Meta's Cloud API cannot run on the same number at the same time as that app — connecting a number to the Cloud API disables the regular app on it. Client was walked through two options and asked to decide, then said to leave this for later:
  - **(a) New, dedicated number for the Cloud API** (what was recommended) — current number/app keeps working exactly as today for manual chatting; the new number is used only for automated lead capture from the website/CRM.
  - **(b) Migrate the current, in-use number to the Cloud API** — loses the ability to reply manually from the phone's WhatsApp Business app on that number; as currently scoped, Phase 3 is receive-only (turns incoming messages into CRM leads) and does **not** include a way to send replies through the CRM, so option (b) would need that gap addressed too before it's workable day-to-day.
  Once decided, also need: Phone Number ID, WhatsApp Business Account ID, a permanent access token (via a Meta System User), and the App Secret. See §7 Phase 3.
- [ ] Can `sales` role delete offers, or is delete `admin`-only? (currently assumed both can, per §6 — confirm)
- [ ] **Firebase Storage upgrade (Blaze plan):** Storage still requires the pay-as-you-go Blaze plan (Google offers $300 free credit), which needs a billing account/card added by the client in the Firebase console — deferred 2026-09-04 at client's request. **Workaround shipped 2026-09-13:** the offer create/edit form takes pasted external image URLs instead of uploading to Storage (see §7/§9, `lib/types.ts`'s optional `storage_path`). Revisit if/when Storage billing is enabled — swapping in real upload later is additive, not a breaking change to the data model.
- [x] ~~Company WhatsApp number~~ — **Resolved 2026-09-13: `966115165899`.** Set in `.env.local`'s `NEXT_PUBLIC_WHATSAPP_NUMBER` and written to the live `settings/company` Firestore doc (see §5) so it's editable from the CRM Settings screen without a redeploy. Used directly for `wa.me` links — client explicitly asked for it to open the WhatsApp chat directly, no intermediate contact form step.

## 13) References
- Competitor site (structure reference only): https://thiraa.sa/ar

---

## Update Log

> Newest entry always on top. Format: Date — what changed — why — affected sections.

- **2026-09-13** — **Restyled the Staff screen**, continuing the CRM design pass — only Settings is left unstyled now. White card table with an initials-avatar per staff member, role `<select>`, an Active/Inactive status pill, and an icon-only power-toggle button. The `sales`-role restricted view is now a proper styled card (lock icon + message) instead of a plain sentence, matching the CRM's other empty/restricted states. Added `AdminStaff` i18n keys (both languages), reusing the existing `StaffRole` keys for role labels. Verified live end-to-end: created a real `sales` test account through the redesigned form (confirmed the admin's own session stayed intact — the specific risk this feature's Admin-SDK-bypass API route exists to avoid, see §1), logged in as it to confirm the new restricted-access card renders correctly for non-admins, then deleted the test account via a one-off Admin SDK script.

- **2026-09-13** — **Restyled the Leads screens** (list + detail), continuing the CRM design pass. Leads list: white card table, colored source/status pills, `dir="ltr"` phone numbers, styled "Log a call" form with a Cancel button, branded empty state. Lead detail: back link, status pill by the name, info/status/notes in their own cards, notes timestamps localized via `toLocaleString(locale)`. **Fixed a real bug, not just a styling pass**: both the leads list's "assigned to" column and the detail page's notes timeline were displaying raw Firebase uids instead of staff names — fixed by fetching the staff list alongside leads/notes and resolving uids through it in both places. Added `LeadSource`, `AdminLeads`, `AdminLeadDetail` i18n keys (both languages). Verified live end-to-end: logged a manual call, confirmed it listed correctly with the phone-call source pill, opened its detail page, changed status, assigned it to the admin account (name displayed correctly, not the uid), added a note (author name resolved correctly), then deleted the test lead via a one-off Admin SDK script. Staff/Settings screens remain unstyled, next in line.

- **2026-09-13** — **Restyled the Offers screens** (list + create/edit form), continuing the CRM design pass started earlier today. Offers list: white card table, thumbnail+title/city cell, colored type/status pills, icon-only row actions, branded empty state; fixed a real overflow bug found while testing — the table pushed the whole page horizontally on a narrow viewport instead of scrolling internally, fixed by moving `overflow-x-auto` + a `min-w` onto the table's own wrapper (the "wide content scrolls in its own container, body never scrolls horizontally" rule). Offer form: split into labeled white-card sections (Basic Info, Location, Pricing & Area, Description, Images) with consistent brand-styled inputs; moved every hardcoded English string into new `AdminOffers`/`AdminOfferForm`/`OfferStatus` i18n keys (both languages). Verified live end-to-end: created a real offer through the new form, confirmed it rendered correctly in the redesigned list (thumbnail, badges, price), toggled it to draft via the new icon button, then deleted it via a one-off Admin SDK script. Leads/Staff/Settings remain unstyled, next in line.

- **2026-09-13** — **Started CRM visual design, beginning with the main dashboard shell** (client request, same day as the Vercel deploy) — superseding the earlier same-day decision to hold off on CRM styling until brand identity existed, since it now does (§2b, from Phase 1). Restyled: the login page (navy full-bleed background, centered cream card, logo, gold button); the shared sidebar (new `components/admin/AdminSidebar.tsx` — navy background, icon nav items with a gold active-state, signed-in staff name + localized role, language switcher, sign-out — extracted out of `AdminLayout`, which now just composes it with the existing unchanged auth-guard logic); and the Dashboard page itself (icon stat cards, a colored-pill "leads by status" panel with proportional bars, a "recent leads" list using the same pills). Added `LeadStatus` and `StaffRole` i18n keys (both languages) for the status/role labels used here, reusable later on the Leads/Staff screens. Verified live in the browser in both `/ar` (RTL, sidebar on the right) and `/en` (LTR, sidebar on the left) — mirrored correctly. **Offers/Leads/Staff/Settings screens are deliberately untouched for now** — same plain style as before, sitting inside the new sidebar/background without visual clash; restyling them is the natural next step, screen by screen. See §9 for the updated screen-by-screen status.

- **2026-09-13** — **Deployed to Vercel — Phase 0's last open item is done.** Live at https://binsalamah-chi.vercel.app. Initialized git (this project had none before), created a private GitHub repo (`mohammedndw/binsalamah`), connected it to a new Vercel project, and set all env vars (Firebase config as public Config, `FIREBASE_SERVICE_ACCOUNT_KEY` as a Production-only Secret — see §11). Hit an account-mismatch snag first (the Vercel CLI's device-code login auto-approved under a stale/wrong Vercel account tied to the browser's prior session, silently creating the project under the wrong team and breaking the GitHub connection) — resolved by explicitly logging out and back in as the correct account before re-linking. **Found and fixed a real production-only bug**, not caught by any local testing: `/api/staff` (the one Admin-SDK-backed route, §1) returned 500 in production while working fine locally. Root cause: `firebase-admin/auth` unconditionally requires `jwks-rsa`, which does a CJS `require()` of the ESM-only `jose` package — Turbopack's production function bundler crashes on that interop (`ERR_REQUIRE_ESM`), while `next dev` and the plain-Node `scripts/seed-admin.ts` are unaffected. Two intermediate fixes were tried and failed: excluding `firebase-admin` via `serverExternalPackages`, then also excluding `jwks-rsa`/`jose` directly — the failure turned out to be one level deeper, inside `firebase-admin/auth`'s own `token-verifier.js`, past where that config could help. **Final fix:** rewrote `app/api/staff/route.ts` to not import `firebase-admin/auth` at all — verifies the caller's ID token by hand with a direct `jose` import (plain ESM, not the broken CJS chain) against Firebase's public JWKS, and creates the new user via the Identity Platform REST API with a hand-signed JWT-bearer OAuth assertion (Node's built-in `crypto`, no `google-auth-library`). `firebase-admin/firestore` was never affected and is untouched. Verified live end-to-end after the fix: created a test staff account on production, confirmed it could actually log in, then deleted it via a one-off Admin SDK script (also checked and confirmed no other test data — offers/leads — was left over from the earlier failed attempts, since those all failed before reaching user creation). See §1's staff-creation exception and §7's Phase 0 entry for where this is reflected.
- **2026-09-13** — Client confirmed **"بن سلمه" (Bin Salmah) is the correct company name**, resolving the naming discrepancy flagged earlier today. Fixed the last remaining "Bin Salamah"/"بن سلامة" references in `CLAUDE.md` (title, §1 opening line) and `README.md` (title) to "Bin Salmah". Confirmed no other file in the codebase still says "Salamah" (`grep` across `.md`/`.ts`/`.tsx`/`.json`, excluding `node_modules`/`.next`). Left the project folder path and Firebase project ID (`binsalamah-34cb1`) unchanged — see §12 for why. Updated §12's item to resolved. No functional/code changes.

- **2026-09-13** — **Phase 1 (Public Website) built and verified live end-to-end, including brand identity extraction.** Client provided a brand PDF (`بن سلمه العقارية.pdf`); extracted colors by sampling the actual artwork pixels (not guessed) and the logo icon by rendering the PDF at 300dpi and thresholding it into a clean binary mask (the mask approach was used because a first attempt at color-keying the wordmark lockup against its photographic/gradient background left visible fringing — rejected, documented in §2b). Wired up Cairo/Tajawal fonts, navy/gold/cream color tokens, and real favicons (`app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`). **Naming discrepancy found:** the project has been called "Bin Salamah" everywhere, but the actual logo reads "بن سلمه" (Bin Salmah) — flagged as an open question in §12, and all new on-site copy uses the logo's spelling. Built: `components/Logo.tsx`, `WhatsAppButton.tsx`, `OfferCard.tsx`, `OffersGrid.tsx`, `RegisterInterestForm.tsx`; added `listPublishedOffers()`/`getPublishedOfferBySlug()` to `lib/offers.ts`, `createPublicLead()` to `lib/leads.ts`, `getPublicContactInfo()` to `lib/settings.ts`; filled in Home/Offers/Offer-detail/About/Contact with real Firestore-backed content and full brand styling. Added a required Firestore composite index (`offers`: status + updated_at) to `firestore.indexes.json` and deployed it — the public offers query failed with `failed-precondition` until this was added; noted the general pattern in §5 so it's not a surprise next time. Client also gave the real company WhatsApp number (`966115165899`) — set in `.env.local` and written to the live `settings/company` doc — and confirmed the site model as one generic "Offers" type (no separate Rentals/Lands), resolving two more §12 items. **Verified live, not just built:** created a real offer through the CRM, confirmed it rendered correctly on the Home featured grid, the Offers listing (with working type/city filters), and its own detail page with gallery/price/description; submitted the "Register interest" form on that offer page and confirmed the resulting lead appeared correctly in the CRM's Leads screen with `source: website_interest` and the right `related_offer_id`; confirmed the language switcher preserves the page and correctly mirrors the floating WhatsApp button between `/ar` and `/en`. All test data (offer + lead) was deleted afterward via a one-off Admin SDK script. Remaining Phase 1 gaps, left as open roadmap items: no SEO metadata pass yet, no district/price/rooms filters, no "similar offers" section, About page content is still placeholder copy pending the client.

- **2026-09-13** — Client confirmed: don't invest in real visual design for the CRM yet — wait for the final brand identity (§12) rather than building an interim placeholder skin. No code changed; noted in §12 so this isn't silently attempted later.
- **2026-09-13** — **Phase 3 (WhatsApp) deferred again, same day it was moved up.** While explaining what's needed to connect the WhatsApp Business API, surfaced a real constraint to the client: their current WhatsApp number is actively used on the regular consumer app, and Meta's Cloud API can't run on the same number simultaneously — connecting it would disable the regular app there. Client was given the tradeoff (new dedicated number vs. migrating the current one, and that Phase 3 as scoped is receive-only with no reply capability) and asked to decide; client said to leave it for later. Reverted the "Phase 3 right after Phase 2" execution order from earlier today — updated §7's ordering note and Phase 3 section, and §12's pending decision (un-resolved it, with the full explanation preserved for whenever the client picks this back up). No code changes. Next: awaiting client direction — likely Phase 1 (public website) next, or revisit Phase 3 once the phone-number decision is made.

- **2026-09-13** — **Phase 2 (Internal CRM) functionally complete and verified live end-to-end against the real Firebase project.** Client decision: image upload uses pasted external URLs, not Firebase Storage, since Storage is still blocked on the deferred Blaze billing upgrade (§12) — `lib/types.ts`'s `OfferImage.storage_path` made optional to allow real uploads later without a schema change. Built: `lib/offers.ts`, `lib/leads.ts`, `lib/settings.ts`, `lib/staff-client.ts` (Firestore data-access), `components/admin/OfferForm.tsx` (shared create/edit form), and filled in all six admin pages (dashboard, offers list/new/edit, leads list/detail, staff, settings) with real Firestore-backed behavior — see §9 for what each screen actually does now. Added the `settings` Firestore collection (§5) for company WhatsApp/contact info, admin-write/public-read. **One deliberate architecture exception**, called out explicitly per client instruction to keep Firebase as the only backend: staff-account creation needed a single Admin-SDK-backed API route (`app/api/staff/route.ts`) because the client SDK can't create another user's Auth account without hijacking the caller's own session — documented in §1 and §10, gated on the caller being a verified active admin. Added `lib/firebase-admin.ts` (server-only Admin SDK init, supports both a local service-account file and a `FIREBASE_SERVICE_ACCOUNT_KEY` env var for when this eventually deploys to Vercel — see §11, still not set). Fixed a real Security Rules bug found via live testing, not just code review: the original `leads` rule only allowed `create` for the public/unauthenticated shape (`source in ['website_interest', 'other']`), so the CRM's own "Log a call" feature (source `phone_call`) was rejected with "Missing or insufficient permissions" — fixed by allowing any authenticated active staff member to create a lead with any shape, in addition to the constrained public path; redeployed rules, retested, confirmed working. Also broadened `staff` read access from "own doc only" to "any active staff can read the whole directory," since the Leads screen's assign-to picker needs to list all staff. Downgraded the new `react-hooks/set-state-in-effect` ESLint rule to a warning in `eslint.config.mjs` — it flagged the ordinary "fetch on mount" pattern used by every list/detail page here as a false positive; documented why in a comment. Verified live in the browser: created and published a test offer, edited it, logged a manual lead, changed its status, assigned it, added a note, checked dashboard numbers matched, edited and reloaded settings, created a second (`sales`-role) staff account through the new API route without disturbing the admin's own session, confirmed that new account could log in and was correctly blocked from the Staff/Settings screens, then deleted all of that test data via a one-off Admin SDK cleanup script so the client's real CRM starts empty. Next up per the client's reprioritized order (§7): Phase 3 (WhatsApp Business API integration), then Phase 1 (public website).
- **2026-09-13** — Client decided to build **Phase 2 (Internal CRM) to completion before starting Phase 1 (Public Website)**. Also: client's WhatsApp Business API access is now ready, so **Phase 3 (WhatsApp integration) moves up to right after Phase 2**, before Phase 1. Updated §7 (added an execution-order note + reordered Phase 3's framing) and §12 (marked the WhatsApp-readiness pending decision resolved, but actual Meta credentials — phone number ID, access token, app secret — still need to be collected from the client when Phase 3 starts). No code changed yet; about to start Phase 2 implementation (offers CRUD, leads management, staff management, settings, dashboard).
- **2026-09-04** — **Phase 0 (Foundation) substantially complete and verified working end-to-end.** What was built: scaffolded the Next.js (App Router, TypeScript, Tailwind) project; wired up `next-intl` bilingual routing (`[locale]` = `ar`/`en`, RTL/LTR, no browser-based auto-redirect); wrote `lib/firebase.ts` (client SDK), `lib/types.ts`, `lib/validators.ts` (zod), `lib/auth-context.tsx`; built the full route skeleton for both the public site (`app/[locale]/(public)/...`) and the CRM (`app/[locale]/admin/...`) with placeholder content per §8/§9, to be filled in during Phase 1/2; wrote `firestore.rules`/`storage.rules`/`firestore.indexes.json`/`firebase.json` matching §6; wrote `scripts/seed-admin.ts` + `npm run seed:admin`. Renamed `middleware.ts` → `proxy.ts` per a Next.js 16 breaking change (middleware convention renamed to Proxy) found via the auto-generated `AGENTS.md` — see that file for the underlying warning; it's committed as-is because it's regenerated automatically by `next dev` if removed. Fixed two real bugs found via live browser testing, not just a build check: (1) the language switcher was passing a malformed `{pathname, params}` object to next-intl's router, so it always reset to the homepage instead of staying on the current page — fixed to pass the plain pathname string; (2) `lib/firebase.ts` called `getAuth()` unconditionally, which throws synchronously and crashes the whole `/admin` route when Firebase env vars are empty — added `isFirebaseConfigured` and made `auth` conditional, with the admin layout now showing a plain "Firebase isn't connected yet" message instead of an uncaught error. **Live infra:** created and connected a real Firebase project (`binsalamah-34cb1`) — Firestore (region `me-central2`/Dammam) and Auth (Email/Password) are live and rules are deployed (`firebase deploy --only firestore:rules,firestore:indexes`); Storage deferred because it now requires the paid Blaze plan (client chose to postpone billing setup, see §12). Created and verified the first `admin` staff login (`modenaif126@gmail.com`) through the actual browser UI: login → dashboard → sign-out → redirect back to login all confirmed working. `.env.local` and `service-account.json` are populated locally (git-ignored) but **nothing is deployed to Vercel yet** — that Phase 0 item remains open. Architecture clarified per client instruction: **there is no custom backend server** — Firebase is the entire backend (Firestore/Auth/Storage), Next.js only calls the Firebase client SDK directly; added as its own subsection in §1 and referenced from §2.
- **2026-09-04** — Client decided both the public website and the CRM must be bilingual (Arabic default, English secondary). Resolved the pending "Website UI language" decision (§12). Added: i18n solution decision (`next-intl`, `[locale]` routing) in §2; `[locale]` prefix on every route in §4; bilingual `_ar`/`_en` fields on the `offers` collection (`title`, `city`, `district`, `description`) in §5; i18n setup, language switcher, and bilingual form/content tasks across Phase 0/1/2 in §7; bilingual notes in §8/§9; `[locale]` segment and `/messages/{ar,en}.json` in the folder structure §10. Updated `TESTING.md` with i18n/bilingual test cases.
- **2026-09-04** — Expanded CLAUDE.md into a fully detailed reference: added Mandatory Working Protocol, detailed Project Overview (users, non-goals), full field-level Data Model, explicit Security Rules requirements, page/screen-by-screen breakdown of website and CRM, target folder structure, environment/config table, and an added pending decision on website UI language (Arabic/English/bilingual). Also expanded `TESTING.md` accordingly. No implementation started yet.
- **2026-09-04** — Created CLAUDE.md, TESTING.md, and TESTING_LOG.md. No implementation started yet. Decision: start with Phase 0 (Foundation), then Phase 1 (Website).
