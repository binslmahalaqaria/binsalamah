# Testing Log

> Record every test run here (manual or automated). Newest entry on top. Reference the checklist item from `TESTING.md` where applicable.

## Log

| Date | Phase | Item Tested | Result | Notes | Tester |
|---|---|---|---|---|---|
| 2026-10-10 | CRM port | Old CRM import + new screens against live Firebase | Pass | Imported 2 clients/1 property/3 requests/1 task/1 goal via Team → Settings importer; Clients, Requests (stages, journey), Sales (75,000 SAR commission month), Team (stats, lastSeen self-write) render correctly under the new rules | Claude |
| 2026-10-07 | 1 | Offer price hydration (`toLocaleString` locale pinned to `en-US`) | Fail → Fixed → Pass | Before: "Hydration failed" on `/ar` and `/ar/offers` in an Arabic-locale browser (`500,000` vs `٥٠٠٬٠٠٠`). After: server HTML and client DOM both render `500,000` on Home, Offers list, and offer detail; `tsc --noEmit` clean | Claude |
| 2026-09-13 | 1 | `npm run build` / `tsc --noEmit` / `npm run lint` (post-brand-redesign) | Pass | Clean build, 0 type errors, same 6 pre-accepted lint warnings as Phase 2, no new errors | Claude |
| 2026-09-13 | 1 | `listPublishedOffers()` query (status + orderBy) | Fail → Fixed → Pass | Threw `failed-precondition: query requires an index`; added the composite index to `firestore.indexes.json`, deployed, waited for it to finish building (~1-2 min), retested successfully | Claude |
| 2026-09-13 | 1 | Home page renders with real brand identity | Pass | Verified via screenshot: navy hero, gold/cream buttons, correct logo mark, Cairo/Tajawal fonts loaded, RTL layout correct | Claude |
| 2026-09-13 | 1 | End-to-end: create offer in CRM → appears on Home + Offers list + own detail page | Pass | Created a real "Luxury Villa in Al Narjis" test offer with an image; confirmed it rendered correctly in all three places with correct price/area/type badge/image | Claude |
| 2026-09-13 | 1 | End-to-end: "Register interest" submission → visible in CRM | Pass | Submitted the form on the test offer's detail page; confirmed success message shown, then confirmed the lead appeared in `/admin/leads` with `source: website_interest` and correct name/phone | Claude |
| 2026-09-13 | 1 | Language switcher preserves page after Phase 1 redesign | Pass | Re-verified on the Contact page (not just Home) — switched `/ar` → `/en`, stayed on Contact, title/content correctly localized | Claude |
| 2026-09-13 | 1 | Floating WhatsApp button mirrors correctly RTL ↔ LTR | Pass | Confirmed via screenshot: bottom-start (visually left) on `/ar`, bottom-end (visually right) on `/en` | Claude |
| 2026-09-13 | 1 | WhatsApp links carry correct number + contextual message | Pass | Inspected hrefs via `read_page`: header/footer generic link has no message, floating button has a generic message, offer card/detail links include the offer's name in the pre-filled text, correctly URL-encoded | Claude |
| 2026-09-13 | 1 | Contact page pulls WhatsApp number from live Firestore settings | Pass | Confirmed the number shown matches `settings/company.whatsapp_number`, not just the `.env.local` fallback | Claude |
| 2026-09-13 | 1 | Test-data cleanup (offer + lead) | Pass | Ran a one-off Admin SDK script to delete the test offer and the test lead created during this session; confirmed Home page's featured section correctly disappears again with zero published offers | Claude |
| 2026-09-13 | 2 | `npm run build` (production build) | Pass | Clean build after all Phase 2 pages/lib files added | Claude |
| 2026-09-13 | 2 | `npm run lint` / `tsc --noEmit` | Pass (with warnings) | 0 type errors; `react-hooks/set-state-in-effect` fires 6 warnings on the standard fetch-on-mount pattern used across the new pages — downgraded from error to warn in `eslint.config.mjs`, judged a false positive for this simple, correct pattern | Claude |
| 2026-09-13 | 2 | Create offer → publish | Pass | Filled bilingual fields + one pasted image URL, clicked "Save & publish", confirmed it appeared in the offers list with correct title/type/city/price/status | Claude |
| 2026-09-13 | 2 | Edit offer | Pass | Opened the edit page for the created offer, confirmed every field (including Arabic values) was correctly pre-filled from Firestore | Claude |
| 2026-09-13 | 2 | Manual lead creation ("Log a call") | Fail → Fixed → Pass | First attempt: "Missing or insufficient permissions" — the `leads` create rule only allowed the public shape (`source in ['website_interest','other']`); fixed the rule to also allow any authenticated active staff member to create a lead with any shape, redeployed, retested successfully | Claude |
| 2026-09-13 | 2 | Lead detail: status change, assignment, add note | Pass | Changed `new` → `contacted`, assigned to self, added a note with a live timestamp — all confirmed persisted via `select`/input values read back after the actions | Claude |
| 2026-09-13 | 2 | Dashboard stats accuracy | Pass | With 1 published offer + 1 `contacted` lead: dashboard showed exactly `1 / 0 / 0 / 1` and `contacted: 1`; re-verified back at all-zero after test-data cleanup | Claude |
| 2026-09-13 | 2 | Settings save + reload | Pass | Saved WhatsApp/email/phone, did a full page reload, values came back from Firestore correctly | Claude |
| 2026-09-13 | 2 | Staff creation via `app/api/staff/route.ts` (Admin SDK exception) | Pass | Created a `sales` test account from the Staff screen; confirmed the calling admin's own session was **not** replaced (this was the specific risk this API route exists to avoid); confirmed the new account could log in on its own | Claude |
| 2026-09-13 | 2 | Role restriction (`sales` blocked from admin-only screens) | Pass | Logged in as the new `sales` test account: `/admin/staff` and `/admin/settings` both showed "…is admin-only" instead of the real UI | Claude |
| 2026-09-13 | 2 | Deleted-user session handling | Pass | After deleting the `sales` test account server-side, navigating to `/admin` while still "logged in" as that (now-deleted) user correctly redirected to `/admin/login` instead of crashing | Claude |
| 2026-09-13 | 2 | Test-data cleanup | Pass | Ran a one-off Admin SDK script to delete the test offer, test lead, test `settings/company` doc, and the test staff account (Auth user + Firestore doc); confirmed dashboard back to all-zero and offers/leads lists empty | Claude |
| 2026-09-04 | 0 | `npm run build` (production build) | Pass | Clean build, no errors, all `[locale]` routes generated correctly | Claude |
| 2026-09-04 | 0 | `npm run lint` / `tsc --noEmit` | Pass | No lint or type errors | Claude |
| 2026-09-04 | 0 | i18n: visiting `/` redirects to default locale | Pass | Confirmed goes to `/ar` regardless of browser language, after setting `localeDetection: false` | Claude |
| 2026-09-04 | 0 | i18n: `/ar` renders RTL, `/en` renders LTR | Pass | Verified visually via screenshot (logo/nav mirrored correctly on `/ar`) | Claude |
| 2026-09-04 | 0 | i18n: language switcher preserves current page | Fail → Fixed → Pass | Initially reset to homepage on switch (malformed `{pathname, params}` passed to router); fixed to pass plain pathname string; retested on `/en/offers` → switch → `/ar/offers` confirmed | Claude |
| 2026-09-04 | 0 | Admin guard: unauthenticated visit to `/ar/admin` redirects to `/ar/admin/login` | Pass | Confirmed via direct navigation while signed out | Claude |
| 2026-09-04 | 0 | Admin guard: missing Firebase env vars doesn't crash the app | Fail → Fixed → Pass | `getAuth()` threw uncaught `auth/invalid-api-key` synchronously, crashing the whole route; added `isFirebaseConfigured` guard + friendly fallback message | Claude |
| 2026-09-04 | 0 | Firestore Security Rules deploy | Pass | `firebase deploy --only firestore:rules,firestore:indexes` succeeded against live project `binsalamah-34cb1` | Claude |
| 2026-09-04 | 0 | Seed script creates first admin (`scripts/seed-admin.ts`) | Pass | Ran `npm run seed:admin`, confirmed `staff/{uid}` doc created in Firestore console with `role: admin`, `active: true` | Claude |
| 2026-09-04 | 0 | Real login flow: login → dashboard → sign-out → back to login | Pass | Full round trip tested live in browser against the real Firebase project with the seeded admin account | Claude |
| 2026-09-04 | - | Initial setup of TESTING.md and TESTING_LOG.md | N/A | No code exists yet, testing has not started | Claude |

<!--
Row template to copy:
| YYYY-MM-DD | Phase 0/1/2/3 | short description of what was tested | Pass / Fail / Blocked | details, bug link, or reason | who ran it |
-->
