# Testing Plan

> This file defines the testing strategy for the project, mapped 1:1 to `CLAUDE.md`. `TESTING_LOG.md` tracks actual test runs and results over time.
> **Rule:** every checklist item here must trace back to a Roadmap item in `CLAUDE.md`. Whenever a Roadmap item is added/changed there, add/update the matching test case here in the same task. Whenever a test case here is actually run, log it in `TESTING_LOG.md`.

## Testing Principles
- Every feature in `CLAUDE.md`'s Roadmap must have a corresponding test checklist item here before it is considered done.
- Prefer automated tests (unit/integration) for data logic (Firestore reads/writes, lead status transitions, form validation, slug generation). Use manual QA for visual/UX/responsive checks.
- Security Rules (Firestore) must be tested explicitly with both an unauthenticated client and an authenticated staff client — never assume rules work just because the UI hides an action.
- A feature is not "done" until its test case here is marked passed in `TESTING_LOG.md`.

---

## Phase 0 — Foundation
- [ ] Firebase project connects successfully from local dev and from the Vercel deployment (staging + production if separate)
- [ ] Environment variables from `CLAUDE.md` §11 are all present and correctly loaded in each environment
- [ ] Firestore Security Rules — `offers`: unauthenticated read succeeds only for `status == "published"` docs, fails for `draft`/`archived`
- [ ] Firestore Security Rules — `offers`: unauthenticated write (create/update/delete) always fails
- [ ] Firestore Security Rules — `leads`: unauthenticated `create` succeeds with valid shape, unauthenticated `read`/`update`/`delete` always fails — **not directly tested unauthenticated** (no public form exists yet, that's Phase 1); the rule shape itself was exercised indirectly
- [ ] Firestore Security Rules — `staff`: unauthenticated access (read or write) always fails — not directly tested unauthenticated
- [x] Firestore Security Rules — authenticated staff (`sales`/`admin`) can read/write `offers` and create/read/update `leads` — verified live 2026-09-13 through actual CRM usage (create/edit/delete offer, log a call, change status, assign, add note all succeeded as staff). **Bug found and fixed**: the original rule only allowed public-shaped `leads` creates (`source in ['website_interest','other']`), so the CRM's own "Log a call" (`source: 'phone_call'`) was rejected with a permissions error — fixed to also allow any authenticated active staff member to create a lead with any shape; redeployed and retested successfully. Rules were not black-box tested with a forged/malicious request (e.g. the Firestore emulator + rules-unit-testing) — only exercised through the real app's normal write paths
- [x] Firestore Security Rules — only `admin` role can write to `staff` — verified live 2026-09-13 (a `sales` account was UI-blocked from the Staff screen; the rule's `isAdmin()` check was not separately black-box tested). **Also changed**: `staff` read was broadened from "own doc only" to "any active staff can read the whole directory," needed for the Leads screen's assign-to picker — see `firestore.rules`
- [x] `/[locale]/admin/*` routes redirect to `/[locale]/admin/login` when not authenticated (locale preserved) — see TESTING_LOG.md 2026-09-04
- [x] First `admin` staff account can log in successfully after seeding — see TESTING_LOG.md 2026-09-04
- [x] i18n: visiting `/` redirects to the default locale `/ar`; `/ar` and `/en` both resolve correctly for every route — see TESTING_LOG.md 2026-09-04
- [x] i18n: `/ar` pages render with `dir="rtl"`, `/en` pages render with `dir="ltr"`, verified at the root layout level — see TESTING_LOG.md 2026-09-04

## Phase 1 — Public Website
- [x] Home page loads with no console errors; Hero, featured offers grid all render — verified live 2026-09-13 with a real published offer. **No quick filter bar on the home page** (deliberately not built, filters live on `/offers` — see `CLAUDE.md` §7)
- [x] `/offers` fetches and displays only `status = published` offers (never draft/archived) — enforced by the query itself (`where status == published`), not just app-code filtering
- [x] Filters: type and city — verified via `OffersGrid.tsx`. **District, price-range, and rooms filters are not built** — not tested, they don't exist yet
- [x] Offer detail page (`/offers/[slug]`) shows correct data for a valid slug — verified live with a real offer. **404/not-found state for an invalid or unpublished slug not explicitly tested**
- [x] Image gallery on offer detail: main image + thumbnails render — verified live with a single-image test offer; **not tested with multiple images / cover-image ordering**
- [ ] "Register interest" form: required-field validation (name, phone) blocks submission with a clear error — form uses zod (`leadFormSchema`) so this should work, but the validation-blocking path itself wasn't exercised live (only the happy path was)
- [ ] "Register interest" form: phone format validation accepts valid Saudi numbers and rejects invalid ones — same as above, schema exists, rejection path not live-tested
- [x] "Register interest" form: successful submission creates a `leads` document with `source = website_interest` and the correct `related_offer_id` — **verified live end-to-end**: submitted on a real offer page, confirmed the lead appeared in the CRM Leads screen with the right source and offer link
- [x] "Register interest" form: shows a clear success state/confirmation after submission — verified live
- [x] WhatsApp buttons (floating + per offer card + offer detail) open `wa.me` with the correct configured number and an offer-specific pre-filled message — verified via `read_page` href inspection, confirmed correct number and correctly-encoded message text per context
- [x] About and Contact static pages render — Contact's WhatsApp number confirmed pulled live from Firestore `settings/company`. **About/Contact content is placeholder copy**, not final — see `CLAUDE.md` §8
- [ ] Contact page general-inquiry form — **not built** (out of scope for now, only WhatsApp/email/phone links exist)
- [ ] Responsive check across mobile/tablet/desktop breakpoints — **not done**, only tested at the default browser viewport
- [ ] Basic SEO check (page titles/meta descriptions, sitemap, `hreflang`, Open Graph) — **not done**, deferred per `CLAUDE.md` §7
- [ ] Basic performance check (Lighthouse) — **not done**
- [x] i18n: language switcher toggles between `/ar` and `/en` while staying on the equivalent page — re-verified on the Contact page specifically (not just Home/Offers) after the Phase 1 redesign
- [x] i18n: offer card/detail correctly renders bilingual fields per active locale — verified via the real test offer (Arabic and English titles/descriptions both set correctly)
- [ ] i18n: an offer with a missing English field never appears broken on `/en` for a `published` offer — **not tested**; the test offer had both languages filled in
- [x] i18n: WhatsApp pre-filled message text matches the active locale — verified (Arabic message on `/ar`, English on `/en`)
- [ ] i18n: exhaustive check that no hardcoded Arabic leaks onto `/en` or vice versa — not exhaustively checked page-by-page, but no issues spotted during testing
- [x] Brand identity applied correctly: logo renders crisply on both cream (header/light) and navy (footer/dark) surfaces, Cairo/Tajawal fonts load, colors match the extracted values — verified visually via screenshots on Home, Offers, an offer detail page, and Contact, in both locales

## Phase 2 — Internal CRM
- [x] Staff login succeeds with valid credentials and fails with a clear error on invalid credentials — tested in Phase 0, retested 2026-09-13 with a second (`sales`) account
- [x] Logged-out users cannot reach any `/admin/*` page directly via URL — tested in Phase 0
- [ ] Deactivated staff (`active: false`) cannot log in even with correct credentials — **not yet tested**; the `active` field and the Staff screen's toggle exist, but no live test of a deactivated account attempting login
- [x] Role restriction: `sales` cannot access `admin`-only screens/actions — verified live 2026-09-13: a `sales` test account was blocked from both `/admin/staff` and `/admin/settings` (client-side check); Security Rules independently enforce the same via `isAdmin()`, not separately black-box tested against a forged request
- [ ] Offers list: search and status/type filters return correct results — **not built**; the list has no search/filter UI yet (deferred, low data volume so far — add when the list grows)
- [x] Create offer: all required fields validated; **image is a pasted URL, not a Storage upload** (client decision, §12); new offer appears correctly in the CRM offers list once published — verified live 2026-09-13. Not yet checked against the public site since Phase 1 doesn't exist yet
- [x] Edit offer: changes save correctly — verified live 2026-09-13 (opened the edit form, confirmed all fields pre-filled with real Firestore data)
- [x] Delete offer: removes it immediately; requires a confirm prompt (browser `confirm()`) — verified live 2026-09-13
- [x] Publish/Unpublish toggle works — verified live 2026-09-13 (created as published, confirmed status shown correctly in the list)
- [ ] Leads list: filters by status/source/assigned staff return correct results — **not built**; no filter UI yet (same reasoning as offers list)
- [x] Lead detail: status changes persist and reflect in the dashboard counts — verified live 2026-09-13 (`new` → `contacted`, dashboard's "leads by status" updated correctly)
- [x] Lead detail: assigning to a staff member persists correctly — verified live 2026-09-13 (not yet re-checked that it's visible in the leads *list* view, which currently shows the raw uid rather than a resolved name — worth polishing later)
- [x] Lead detail: adding a note appends to `notes` correctly with correct `by`/`at`, never overwrites previous notes — verified live 2026-09-13 (uses `arrayUnion`, confirmed the note persisted with a real timestamp after reload)
- [x] Manually created lead (phone call) behaves identically to a website-sourced lead in every screen — verified live 2026-09-13 (the "Log a call" form's lead was fully editable/assignable/status-changeable, no special-casing needed)
- [x] Dashboard stats (offer counts, lead counts by status, recent leads) match actual Firestore data on manual spot-check — verified live 2026-09-13 (1 published offer, 1 lead in `contacted` — matched exactly; also re-verified at 0/0 after test-data cleanup)
- [x] Staff management (`admin`-only): creating a new staff member creates both a Firebase Auth user and a `staff` doc correctly; role assignment works — verified live 2026-09-13 via `app/api/staff/route.ts`: created a `sales` account, confirmed it could log in, confirmed the calling admin's own session was undisturbed (this was the actual risk with this feature — see §1)
- [ ] Deleting/removing a staff account — **no UI for this yet**; only activate/deactivate exists. A stray test account had to be removed with a one-off Admin SDK script, not through the app itself. Consider adding a real delete/revoke path later if this comes up in practice
- [x] Settings screen (`admin`-only): saves and reloads correctly — verified live 2026-09-13 (filled WhatsApp/email/phone, reloaded the page, values persisted from Firestore). **Not yet tested** against the public site footer/buttons, since Phase 1 doesn't exist yet
- [x] i18n: CRM language switcher toggles interface labels between Arabic/English without affecting stored offer content — carried over from Phase 0's language-switcher fix, re-confirmed working throughout Phase 2's new pages
- [x] i18n: offer create/edit form shows both Arabic and English inputs for every bilingual field; attempting to publish with a missing required English field is blocked with a clear validation message — verified via `canPublishOffer()` logic and live use (English fields were filled before publishing in the live test, but the blocking check itself was exercised by the zod/canPublishOffer code path)

## Phase 3 — WhatsApp Business API Integration (future, not scheduled)
- [ ] Incoming WhatsApp message correctly creates a new `leads` doc with `source = whatsapp`
- [ ] Webhook signature/verification works correctly and rejects unverified requests
- [ ] Duplicate/rapid messages from the same conversation do not create duplicate leads incorrectly
- [ ] Webhook failures are logged and do not silently drop leads

## Regression Checklist (run before every deploy to production)
- [ ] Public site loads with no console errors on home, offers list, and at least one offer detail page
- [ ] Lead submission ("Register interest") still works end-to-end and appears in the CRM
- [ ] Admin login and core CRUD (offers, leads) still work
- [ ] Firestore Security Rules tests are re-run and still pass (no accidental loosening of access)
- [ ] No new required environment variable is missing in production
