# P1 Future Bookings, Full Map, and Master Sheet reconciliation handoff

**Verdict: CORRECTION REQUIRED before merge.** The reconciled repository candidate passes focused and build gates. Authenticated CRM runtime and current connected Sheet rows were not verified in a classified safe environment.

## Authority and Git

- Owner task: reconcile historical PR #22 and PR #23 into one draft PR; no independent merge of either source PR and no production deployment.
- Accepted `origin/main`: `d8afcf52fa66f6e35a0f5226808badc93c6093a4` (verified after `git fetch origin --prune`).
- PR #22 source: `6fc354f1954c6cafcceb78b9eb857d85ea2c2ddc`.
- PR #23 source and reconciliation starting point: `3424ce884958d86a8c2de17de73053f059c64960`.
- Branch: `fix/p1-future-bookings-map-master-sheet-integration`.
- Reconciled implementation commit: `2e5e55f0`.
- Method: compared both diffs against accepted main, applied PR #22 without an automatic commit onto PR #23, resolved four textual conflicts and reviewed overlapping auto-merges. PR #23's global `active_map` path remains independent of PR #22's bounded Upcoming path.
- Explicit conflict files: `bookings-workspace.tsx`, `crm-bookings-view.tsx`, `dispatch-data-actions.ts`, `dispatch-queries.ts`. Also reconciled the Home Service workspace's Today/Upcoming controls with its always-accessible Full Map and retained Master Sheet refresh props in the Bookings client shell.
- Scope: 41 source/test files in the implementation commit, plus this handoff. No migration, RLS, Auth, payment, Google Sheet write, or operational record mutation.

## Result by surface

- **Bookings:** Today remains date-scoped; Upcoming uses the branch-scoped canonical 14-day query with operational statuses and booking-date/start-time ordering. Future rows show their dates. Confirmation opens `/crm/bookings?tab=upcoming&bookingId=<id>`. Branch-authorized booking ID lookups resolve the actual date; errors or missing rows no longer silently fall back to Today. An exact selected future booking beyond the 14-day window is shown as a labeled deep-link exception while the normal Upcoming query stays bounded.
- **Home Service:** Today and Upcoming lists remain separate. Exact future Home Service links are branch-authorized and selected. Full Map loads a distinct date-independent, paginated `active_map` branch query from either list view. Customer destinations do not depend on Driver GPS. The map query and marker predicate both use `CRM_OPERATIONAL_BOOKING_STATUSES`: pending, pending_payment, pending_crm_confirmation, confirmed, and in_progress are eligible; cancelled, no_show, completed, and expired are excluded. Completed/no_show progress is excluded.
- **Cradle Flow:** main workflow remains Today-focused; the Upcoming capsule uses canonical future bookings. Future primary actions open the exact Bookings or Home Service context, including pending future bookings, rather than running immediate service mutations.
- **Master Sheet:** preserves PR #23's supported-window date handoff, original CradleHub date restoration, active-only 60-second polling, hidden-page pause, focus/reconnect/manual refresh, `observedAt` indicator, and read-only/unlinked projection. No parser change. Empty, unavailable, forbidden, and outside-window states remain distinct.
- **Failure truth:** affected page queries throw on failure or show an explicit refresh error while retaining previously loaded data. A failed Full Map or Upcoming query is not shown as an empty operational result.

## Verification actually run

- Combined Bookings, Home Service, Cradle Flow, Master Sheet reader/service/projection and UI tests: **53 files, 295 tests passed**. The focused command excluded the unrelated `.claude` archival worktree.
- `pnpm type-check`: **PASS**.
- Scoped ESLint on changed TS/TSX files: **PASS**.
- Scoped Prettier check: **PASS**.
- `git diff HEAD --check` and staged `git diff --cached --check`: **PASS**. Git emitted Windows LF/CRLF advisories only.
- Optimized Next.js 16.2.4 build using Node 24 and **LOCAL placeholder** Supabase URL/keys and DATABASE_URL: **PASS**; TypeScript phase passed and 153 static pages generated.
- Unit tests verify branch filters, bounded Upcoming date/status set, exact deep-link behavior, independent Full Map, all included/excluded booking and progress statuses, customer pin without Driver GPS, Master Sheet date switch and refresh configuration, and future Cradle Flow labels/paths.

## Evidence limit and release boundary

- Database target for build: **LOCAL placeholder**; no database connection or mutation was made. No Google workbook was read or written. The owner brief's connected October 13 Sheet rows were not independently reread; on October 14 they are no longer the current Manila date. Synthetic Sheet rows and projection tests passed.
- **AUTHENTICATED RUNTIME — NOT VERIFIED.** No safe authenticated LOCAL, TEST, or STAGING fixture/session was available for an end-to-end browser run of a known future booking, global pin, Cradle Flow count, or current Master Sheet rows.
- Actual Google Sheet read phase timings and active polling under live latency: **NOT MEASURED**. PR #23's 60-second interval remains pending observed performance review.
- Next permitted action: independent review of the single draft reconciliation PR, then classified authenticated read-only verification and owner release decision. **Do not merge PR #22 or PR #23 independently. Do not merge this candidate or deploy production yet.**
- Rollback if this candidate is later accepted: revert its eventual merge, including inherited PR #23 and reconciled PR #22 changes. No database or Sheet data rollback is required.
