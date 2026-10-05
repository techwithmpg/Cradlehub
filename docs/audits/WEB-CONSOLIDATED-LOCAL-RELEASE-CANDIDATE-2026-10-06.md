# Web consolidated local release candidate — 2026-10-06

**Verdict: CORRECTION REQUIRED.** This is repository evidence for an integrated local candidate, not production certification. The owner authorized consolidation and local certification on `stage/web-release-integration`, with a separate gate for any `main` merge or push.

## Branch and scope

- Accepted remote baseline: `origin/main` at `6a310021df66679d71daf753434e6c328e3181b4`.
- Starting checkout: clean `fix/p1-home-service-customer-location` at `62886b4f365d496f51fb0a088da590b5f1ac4931`.
- Starting integration branch: `4c55519ee5bb16ca000a92f35b04671911743f7a`.
- Integrated the Front Desk source and handover refinement by merge `ec3fd7ae`, P1 Home Service destination correction by merge `cbf9581b`, and separately committed navigation cleanup by merge `56c0f989`. Git ancestry confirms the source implementation commits `0be3863e`, `55ae7171`, and `62886b4f` are present. No merge conflicts occurred.
- The stage's prior booking confirmation migration and Owner Reports/Master Sheet work were already included by ancestry. No migration, Owner workspace feature, or other implementation was changed during this consolidation.

## Local work disposition

| Work | Disposition | Reason |
| --- | --- | --- |
| `stage/web-release-integration` | Included | Existing authorized candidate. |
| `fix/front-desk-booking-source-shift-handover` | Included | Committed and pushed source branch; included by merge. |
| `fix/p1-home-service-location-review` | Included for certification | Committed and pushed source branch; runtime gate remains open. |
| `fix/p1-home-service-customer-location` navigation commit | Included | Separate committed cleanup; targeted contract passes. |
| `fix/p1-cash-flow-business-date-scope` | Needs independent review; excluded | Its owner brief explicitly says repository correction passed but independent review is pending. |
| `fix/service-editor-save` and untracked hotfix report | Blocked; excluded | Its report says local browser persistence and merge gate are pending. |
| `stage/c5-sheet-assimilation-bridge` uncommitted files | Deferred; excluded | Separate Sheet assimilation work in progress, including one temporary config file. Preserved untouched. |
| `test/crm-csr-gremlin-day` untracked audit | Deferred; excluded | Audit itself says in progress. Preserved untouched. |
| PWA, historical booking, Google sitemap, and local integration branches | Unrelated or already ancestral | No acceptance evidence for adding a new Web release change. |

## Verification

- Node `v25.2.0`; repository declares Node 24. pnpm `10.33.2`.
- `pnpm type-check`: PASS.
- `pnpm build`: PASS, including TypeScript and 151 generated static pages.
- `pnpm exec vitest run --dir src --maxWorkers 1 --exclude .claude/**`: 32 files, 273 tests PASS.
- `pnpm exec vitest run --dir tests --maxWorkers 1 --exclude .claude/**`: 269 files and 2,177 tests PASS; 7 files and 11 tests FAIL; 2 skipped. Failures cover a server-only import in the agent follow-up suite, four desktop Home Service reschedule expectations with text-only address edits, direct booking action label, attendance/navigation source contracts, Cash Flow presentation count, and expired public booking date fixtures. The desktop test expects a changed text address to retain old GPS coordinates, while the new P1 server contract deliberately rejects it.
- Focused Home Service destination, dispatch navigation, Front Desk source/duty, and handover command: 7 files, 50 tests PASS.
- `pnpm lint`: FAIL, 84 errors and 38 warnings, mostly outside the newly merged files. Targeted ESLint on all 39 merged code/test files: PASS.
- `pnpm format:check`: FAIL on the Windows checkout. `core.autocrlf=true` writes CRLF while Prettier requires LF. Checking the 126 code/config Git blobs changed versus main directly with Prettier: all 126 PASS; the 39 newly merged code/test blobs also PASS.
- `git diff --check origin/main...HEAD`: PASS before this report.

## Safety and release boundary

- Local `.env.local` resolves to **PRODUCTION** Supabase project `lsrbwqhvzjfpiabeolkv`. No LOCAL, TEST, or STAGING database was positively identified. No database operation, migration application, or mutating operational E2E was performed. Mutating E2E is **BLOCKED — PRODUCTION SAFETY**.
- Browser and console behavior for this exact integrated candidate were not verified; no local server was listening on port 3000 during certification.
- The only migration difference against main is the pre-existing stage file `20261005043621_p1_booking_confirmation_origin.sql`; its live deployment state was not queried or inferred. Historical local-only migrations were not replayed or marked applied.
- No `main` merge/push, deployment, or remote integration push was performed. The remote integration branch remains at its pre-consolidation SHA because the repository test gate is red.
- Next permitted action: correct or disposition the confirmed P1 compatibility gap and repository test failures, obtain a positively identified nonproduction data target for mutating certification, rerun all gates, then normally push the reviewed stage branch if the owner brief's passing gate is met. `main` merge/push and production deployment require a separate owner gate.
- Rollback before release: move the local integration branch back to its recorded starting SHA only after preserving these merge commits and report; no database rollback is involved in this local consolidation. Any later migration rollback requires a separately reviewed forward migration and coordinated app change.
