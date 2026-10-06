# CradleHub Web — final daily operations simulation

**Verdict: FAIL — CRITICAL OPERATIONAL FAILURE.** Read-only production catalog inspection found two P0 release blockers. The broad simulation stopped when they were confirmed. No production or database mutation was performed.

## Authority and target

- Owner brief: final daily operations simulation, read-only production inspection, and a narrow review branch for confirmed P0/P1 defects.
- Accepted baseline and `origin/main`: `130060a0f8b6b877fab79a7945df706aabee3d5c` after `git fetch origin --prune`. The starting tree was clean on `main`.
- Vercel production alias `cradlehub.vercel.app`: READY deployment for that exact SHA, ready at 2026-10-06 01:14:28 UTC.
- Database target: **PRODUCTION** Supabase project `lsrbwqhvzjfpiabeolkv`, matched to the configured URL and repository production record. No LOCAL, TEST, or STAGING database was identified.
- Review branch: `fix/p0-booking-progress-rpc-access`, created from the accepted baseline. The final implementation HEAD is recorded in the handoff response.

## Confirmed blockers

| ID | Severity | Evidence | Impact and correction boundary |
| --- | --- | --- | --- |
| OPS-P0-01 | P0 booking integrity | Production `create_booking_order_atomic` function definition inserts every public online order line as `confirmed` and returns `confirmed`. Current deployed `online-booking.ts` calls it and tells customers the request awaits CRM review. Production lacks `confirm_online_booking_order_atomic`; migration history lacks `20261005043621`. | A new online request would skip CRM confirmation, and the expected atomic confirmation action cannot run. No order was created after the verified deployment ready time, so no post-deployment order impact was observed in that table. The existing migration must be reviewed, safely applied through a separately authorized release, and verified against a positively identified target. |
| OPS-P0-02 | P0 authorization / booking integrity | Production `update_booking_progress(uuid,text)` is `SECURITY DEFINER`, executable by `anon` and `authenticated`, and has no caller identity or assignment check. It updates booking state by supplied UUID. No mutating probe was attempted. | Direct Data API callers can bypass the staff Server Function's authorization. The review branch changes the authorized Server Function to call via its server-only service-role client and drafts a follow-on migration that revokes `PUBLIC`, `anon`, and `authenticated` execution while granting `service_role`. This correction is **not applied or runtime verified**. |

The missing booking-confirmation migration also contains travel readiness checks for the progress RPC, but does not revoke its direct caller grants. Both changes require coordinated review and database release. Neither can be declared repaired from repository tests.

## Daily operations matrix

Result applies to the full scenario, not a passing subcheck. `BLOCKED` means the production action required an authenticated staff session or a forbidden production mutation; `NOT VERIFIED` means available evidence did not exercise the requested behavior. Local tests and aggregate database checks are stated separately and do not stand in for a live staff workflow.

| Scenario | Evidence used | Result | Observation | Severity | Follow-up |
| --- | --- | --- | --- | --- | --- |
| A. Front Desk start of day | Production `/login`; direct `/crm/today` redirect; local Today/Cradle Flow tests | BLOCKED | Staff login and dashboard require credentials unavailable in this browser. Unauthenticated route returned to login. | — | Authenticated read-only Front Desk tour. |
| B. Booking lookup | PRODUCTION aggregate joins for 54 lines in the past 30 days | BLOCKED | No missing customer, service, staff, order, branch, or order date link in that sample; detail UI not opened. | — | Read-only staff booking inspection. |
| C. New booking wizard | Local wizard tests; production creation RPC definition | FAIL | Non-mutating component cases passed, but public final submission would store `confirmed` before CRM review. No booking submitted. | P0 | OPS-P0-01. |
| D. Multi-service | Four PRODUCTION multiline orders; local order tests | NOT VERIFIED | Three orders use sequence 1 for different attendees; one attendee has sequences 1 and 2. UI representations across modules not observed. | — | Cross-module staff review. |
| E. Booking status | PRODUCTION RPC catalog; deployed caller; local status tests | FAIL | Public order creation and confirmation contract mismatch. | P0 | OPS-P0-01. |
| F. Reschedule | Local reschedule and destination tests | BLOCKED | No production modal opened or booking changed. | — | Authenticated non-mutating modal review. |
| G. Customers | Local customer tests; database relationship check | BLOCKED | Customer UI and branch-scoped history not observed. | — | Authenticated read-only customer review. |
| H. Schedule | Local schedule test; database links | BLOCKED | Schedule UI was not observed; no booking-to-schedule visual cross-check. | — | Authenticated same-record comparison. |
| I. Attendance | PRODUCTION count: zero non-test checkins today; local feed tests | BLOCKED | No live staff feed was available to inspect. | — | Authenticated read-only feed review. |
| J. Home Service operations | One PRODUCTION Home Service line today; local dispatch tests | NOT VERIFIED | Record has therapist, driver, address, and coordinates. Live Operations/Full Map UI not opened. | — | Authenticated operations review after blocker resolution. |
| K. Home Service location | PRODUCTION aggregate: 12 recent Home Service lines with recorded address and coordinates; local destination tests | NOT VERIFIED | No rendered destination or map was inspected. | — | Compare one legitimate booking and map read-only. |
| L. Driver | PRODUCTION RPC ACL and body; local driver tests | FAIL | Direct progress RPC bypasses staff authorization. No travel transition was executed. | P0 | OPS-P0-02. |
| M. Therapist | Local lifecycle tests only | BLOCKED | Live therapist session and CRM progress were not observed. | — | Authenticated read-only same-record review. |
| N. Payment | Three PRODUCTION legacy payment transactions matched three bookings, branches, and movement amounts; local payment tests | NOT VERIFIED | No UI cross-check or service allocation test transaction. | — | Read-only booking-to-ledger comparison. |
| O. Cash Flow | Five recent PRODUCTION transactions, none today; local Cash Flow tests | BLOCKED | Today/Ledger UI not opened. Separate business-date branch remains excluded. | — | Independent review and authenticated read-only review. |
| P. Handover | PRODUCTION count: zero cash sessions today; local handover tests | BLOCKED | Reminder/Later/modal behavior not exercised live. | — | Authenticated non-mutating review. |
| Q. Master Sheet | Local review tests; route behind login | BLOCKED | Bookings-to-Master Sheet navigation and shell behavior not observed live. | — | Authenticated navigation regression check. |
| R. End of day | Read-only counts; dashboard behind login | BLOCKED | Unfinished business view not exercised. | — | Authenticated Front Desk review. |
| Cross-module consistency | PRODUCTION booking and payment aggregate joins | NOT VERIFIED | Sample joins had no listed link mismatch; no UI same-record trace. | — | Trace in-spa, Home Service, multiline, paid, unpaid records across modules. |
| Navigation | Public home/login and CRM redirect; local nav tests | NOT VERIFIED | Authenticated click path and back navigation not exercised. | — | Staff browser click audit. |
| Performance | No authenticated navigation timing or request trace | NOT VERIFIED | No basis for a performance change. | — | Measure staff routes with browser network tooling. |
| Console | Production public/login tab reported no errors or warnings | NOT VERIFIED | Private workflow console was not observable. | — | Capture during staff tour. |
| Network | No request inspection capability in the active browser tab | NOT VERIFIED | Failed request, latency, and waterfall checks were not measured. | — | Capture during staff tour. |

**Counts:** P0 2; P1 0; P2 0; P3 0. Unverified behavior is not counted as a defect.

## Verification and handoff

- Focused local run before the blocker: 19 files, 197 tests passed with `--exclude .claude/**`. An initial run without that exclusion picked up a stale duplicate test in an ignored worktree and failed on the old `Mark Booking Confirmed` label; the canonical test uses `Confirm Booking`.
- Proposed access correction: 4 focused files, 61 tests passed; `pnpm type-check` passed; `git diff --check` passed. SQL is drafted only, with no execution against any database. Targeted ESLint reports four `no-explicit-any` errors already present in the baseline driver test and one existing unused-symbol warning in the action file; the baseline test reproduces the same four errors. Prettier check is limited by this Windows checkout's CRLF convention and pre-existing formatting in the driver test.
- Production mutations: **NONE**. Database mutations: **NONE**. No booking, payment, attendance, driver, cash, or handover transition was performed.
- No merge, push, deployment, migration application, migration-history repair, or production grant change was performed.
- Next permitted action: independent review of the P0 security patch and the pre-existing booking-confirmation migration; obtain a positively identified nonproduction database to execute and verify both migrations together; then seek a separate owner gate for the coordinated production release. An authenticated read-only staff tour remains necessary after release.
- Not authorized by this task: applying migrations, mutating production records, merging or pushing `main`, or declaring owner-tour readiness.
