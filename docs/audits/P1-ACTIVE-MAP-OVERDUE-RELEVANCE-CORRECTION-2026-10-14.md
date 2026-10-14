# PR #24 Active Map overdue relevance correction handoff

**Verdict: PASS for the source correction. Release remains CORRECTION REQUIRED pending independent re-review and classified authenticated runtime verification.**

## Authority and Git

- Owner instruction: correct the final P1 `active_map` source/data contract on the existing PR #24 branch, validate, and stop before merge or production deployment.
- Accepted `origin/main`: `d8afcf52fa66f6e35a0f5226808badc93c6093a4`.
- Reviewed starting HEAD: `77cdf5565fae912762b9973fe1c10bd30451474d`.
- Branch: `fix/p1-future-bookings-map-master-sheet-integration`.
- Correction implementation commit: `b673ac87`.
- Scope: `src/lib/home-service/active-map.ts`, `src/lib/queries/dispatch-queries.ts`, `src/components/features/dispatch/dispatch-live-map-tab.tsx`, and their two Active Map test files. No Master Sheet implementation, migration, RLS, Auth, payment, or operational-data changes.

## Active Map rule

- The server computes the current Asia/Manila branch business date when `active_map` is requested, even if the original CRM page date has become stale.
- A branch-scoped Home Service booking must have a status in `CRM_OPERATIONAL_BOOKING_STATUSES` and progress other than `completed` or `no_show`.
- It is map-relevant if `booking_date >= businessDate`; otherwise, an overdue booking must have `travel_started`, `arrived`, or `session_started` progress, or the repository's canonical `in_progress` booking status. Past `not_started` rows with `confirmed` or `pending_payment` are excluded.
- The shared helper builds the database relevance filter and applies the same predicate to server results and client map/list eligibility. Filtering occurs in Supabase before the existing 500-row page ranges; the server predicate is a second guard. There is no future horizon. Customer pins do not depend on Driver GPS.

## Verification actually run

- Broader PR #24 Bookings, Home Service, Cradle Flow, Sheet, dispatch and related API suite: **74 files passed, 475 tests passed, 2 files/tests skipped**. Excluded the unrelated `.claude` archival worktree.
- Focused Active Map regression suite after the final fixture addition: **2 files, 7 tests passed**. Covers due/future/active overdue inclusion; stale overdue, terminal status and terminal progress exclusion; branch scope; customer GPS without Driver GPS; no future horizon; and 501 qualifying rows across two pages.
- `pnpm type-check`: **PASS**.
- Scoped ESLint: **PASS**.
- Scoped Prettier: **PASS**.
- `git diff --check`: **PASS** (Windows LF/CRLF advisories only).
- Optimized Next.js 16.2.4 build on Node 24 with **LOCAL placeholder** Supabase and DATABASE_URL values: **PASS**, including TypeScript and 153 static pages.

## Limits and next gate

- No production record was read or mutated in this correction. The owner-provided Main Spa counts are review evidence, not an independently repeated database query.
- No authenticated TEST/STAGING runtime or connected-workbook read was performed. Master Sheet source was unchanged; the owner's connected-workbook evidence says October 14 has no date section, so `available_empty` can be truthful.
- Next permitted action: independent re-review of this PR head, then classified authenticated read-only runtime verification and an owner release decision. **Do not merge or deploy production from this correction task.**
