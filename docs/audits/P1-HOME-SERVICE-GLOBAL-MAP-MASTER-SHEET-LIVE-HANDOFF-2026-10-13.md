# P1 Home Service Full Map and Master Sheet live read handoff

**Verdict: CORRECTION REQUIRED before merge.** The repository correction passes focused tests and the LOCAL placeholder build. An authenticated browser run and live Sheet timing were unavailable, so the requested operational release evidence is incomplete.

## Authority and Git state

- Owner task: 2026-10-13 P1 Home Service global map and Master Sheet live read correction.
- Accepted `origin/main` base: `d8afcf52fa66f6e35a0f5226808badc93c6093a4`.
- Branch: `fix/p1-home-service-global-map-master-sheet-live`.
- Implementation commit: `11134810fe1588b4d68889f6e0ecf95ccf45ff0c`.
- Scope: 20 application and regression-test files covering the CRM Full Map dataset, destination pins, Master Sheet source date, active read, and freshness control. The Sheet parser, schema, migrations, RLS, authentication, payment, booking creation, and operational mutations were not changed.

## Root causes and corrections

- **Home Service Full Map:** the CRM page loaded `getDispatchData({ date: today })`, and the workspace passed that same Today result into Full Map. A future October 16 booking could appear in Upcoming while the map received no row. Full Map now loads a distinct `active_map` query on opening. It is scoped to the authorized branch and Home Service delivery, excludes terminal booking and progress statuses, paginates the open workload, and has no date or arbitrary future horizon. Today and Upcoming query paths remain dated. Customer pins use valid saved booking coordinates without requiring a driver snapshot; staff pins use branch-scoped snapshots matched to the assigned driver. Existing map bounds and selection behavior remain.
- **Master Sheet:** the source switch copied the selected CradleHub date into Master Sheet even when it was outside the current and previous weekly Sheet window. The switch now selects the Manila business date when needed and carries the canonical CradleHub date back on return. Supported dates stay selected. The parser and read-only projection were unchanged. The Sheet hook now polls only when the CRM Master Sheet source is selected, refreshes on focus and reconnect, supports manual Refresh, and retains the current date's previous result during background revalidation. A checked-time indicator uses `observedAt`. Existing unavailable, forbidden, empty, and outside-window states remain distinct.

## Verification

- Focused dispatch, destination, source-switch, Sheet service/reader/parser/projection, and refresh tests: **11 files, 82 tests passed** on final code.
- Full TypeScript check: **PASS**.
- Scoped ESLint: **PASS**.
- Scoped Prettier: **PASS**.
- `git diff --check` and staged diff check: **PASS**.
- Optimized Next.js build with **LOCAL placeholder** Supabase URL and keys: **PASS**, including TypeScript and 153 static pages.
- LOCAL unauthenticated route checks: `/crm/dispatch` redirected to `/login` with HTTP 307; `/api/crm/master-sheet/references?date=2026-10-13` returned HTTP 403 with `Cache-Control: private, no-store`. This verifies the unauthenticated gate, not the authenticated feature.
- Synthetic October 13 records from an October 9–15 tab projected as read-only booking and payment references. Actual live October 13 workbook records were **not read** in this task.

## Polling and timing evidence

- Polling interval: **60 seconds**, only while CRM Master Sheet is selected; hidden pages do not poll. This conservative interval accounts for the existing Google reader's 15-second metadata timeout followed by two parallel 15-second tab-read timeouts. Other Sheet consumers retain non-polling behavior.
- The existing server log records authorization, Google auth, metadata, tab read, parse, projection, response size, and total times for an authorized read. **Actual phase and endpoint milliseconds: NOT MEASURED** because there was no authenticated local Sheet session. The interval must be reviewed against observed timings before merge.

## Release boundary and next action

- Database target for build and route checks: **LOCAL placeholder**. No database connection or mutation was made. The configured production booking and Google workbook evidence in the owner brief was not independently reread. No production operational data, Google Sheet row, schema, Auth, RLS, or service-role credential was changed.
- Authenticated CRM browser verification of due and future pins, terminal exclusions, current-day Sheet rows, passive refresh, focus/reconnect refresh, and observed timing: **NOT VERIFIED**. No safe authenticated LOCAL, TEST, or STAGING fixture was available here.
- Production impact if later released: CRM Full Map reads all branch-open Home Service bookings and the CRM Master Sheet view issues read-only Google requests at most once per active 60-second interval plus focus/reconnect/manual requests. Google API usage and large open workloads require authenticated performance evidence.
- Rollback: revert the implementation and handoff commits after review; no database rollback or Sheet data repair is required.
- Next permitted action: independent code review and authorized authenticated read-only verification in a classified environment, then owner release decision. **No merge, production deployment, push to `main`, or production data mutation is authorized by this handoff.**
