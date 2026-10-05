# P1 booking confirmation and Home Service correction handoff

**Status: CORRECTION REQUIRED before merge.** The repository correction is implemented and its focused gates pass. Database and mutating browser verification remain unverified because no LOCAL, TEST, or STAGING target was positively classified. This is **REPOSITORY-RECORDED WORKING EVIDENCE**, not a production outcome.

## Authority and Git state

- Target/task: CradleHub Web P1 booking confirmation correction, authorized by the owner's 2026-10-05 migration continuation brief.
- Branch: `fix/p1-booking-confirmation-home-service`.
- Accepted `origin/main` base: `6a310021df66679d71daf753434e6c328e3181b4`; fetched and confirmed unchanged, and is the merge base.
- Start SHA: `423c2c8cd98a4a4f8f299883f7218ddfab19281e`.
- Implementation SHA: `cbd2dc52fbdb1eff853d893be51568ad01d7108c`.
- Files changed in implementation: 17, confined to the booking migration, booking/CRM/Home Service application paths, and focused tests. The previous [blocker inspection](BOOKING-CONFIRMATION-HOME-SERVICE-BLOCKER-2026-10-05.md) is retained as historical evidence.

## Implemented contract

| Area | Repository result |
| --- | --- |
| Function before | Shared `create_booking_order_atomic` inserted `confirmed` for all order service lines. |
| Function after | The same signature inserts `pending_crm_confirmation` for the public online server path, while the authorized in-house wrapper's validated `cf8_inhouse` marker plus options digest retains `confirmed`. It still creates order, attendees, and all service lines in one transaction and preserves payload hashing, idempotency, and unpaid initialization. |
| Signature | `create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB)` unchanged. |
| Origin security | The shared RPC remains `SECURITY INVOKER`, revoked from `PUBLIC`, `anon`, and `authenticated`, and executable by `service_role`. The public server action constructs its own order metadata without the in-house marker. No RLS or table grants were weakened. |
| Confirmation | New service-role-only `confirm_online_booking_order_atomic(uuid, uuid)` locks the order and sibling lines, validates branch, state, date/time, expiry, service and staff availability, and updates pending siblings in one statement. Existing overlap triggers remain in force. Replays return success without a second update. The CRM action calls this RPC for online orders. |
| Payment | Review status is independent of payment. Public creation remains unpaid; confirmation does not post payment. The managed status column comment now reflects this meaning. |
| Availability | Pending CRM review blocks the slot until an authorized outcome. Only `pending_payment` uses payment-hold expiry. SQL scheduling functions and the application hold helper agree. |
| Customer and CRM | Public success and notifications say the request was received and awaits CRM review. The existing Needs Action queue recognizes `pending_crm_confirmation`, including future bookings, and confirmation removes that status. The older single-service public action remains callable and now creates pending requests. |
| Home Service | Booking approval no longer requires driver/GPS handoff readiness. Confirmed Home Service opens the operational dispatch workspace. The handoff function now requires an already confirmed booking; assignment, driver query, Live Map/tracking, and trip flow remain. The progress RPC blocks travel/service on unconfirmed bookings and still requires therapist, driver, and valid GPS before travel starts. |
| History | No existing booking rows or historical migrations were changed. |

Migration: [20261005043621_p1_booking_confirmation_origin.sql](../../supabase/migrations/20261005043621_p1_booking_confirmation_origin.sql). No table, enum, or new review queue was added.

## Verification actually run

- Focused booking, CRM, schedule, authorization, payment isolation, and driver tests: `pnpm exec vitest run … --maxWorkers 1 --exclude .claude/**` — **15 files, 133 tests passed**. The list included BKG3 and in-house atomic contracts, CRM actions, Cradle Flow, availability holds, driver query/travel, payment command/eligibility, schedule conflicts, and workspace access.
- Broader Home Service test file: **82 passed, 1 failed**. Its existing in-spa fixture expects 200 from the Home Service only `assign_therapist` endpoint; the endpoint returns 403. The affected route and guard were not changed for this correction. This mismatch remains for separate review.
- `pnpm type-check` — **passed** after removing two corrupt, ignored `.next/dev/types` generated files. An intermediate run failed on those files, not on repository source.
- Targeted ESLint on changed TS/TSX — **0 errors, 2 warnings** for existing unused symbols (`getStaffBranchName` and `useEffect`).
- Targeted Prettier `--check` — **passed**.
- `pnpm build` — **passed** on the final implementation, including TypeScript and 150 static pages. An earlier attempt failed on the same corrupt generated route file.
- `git diff --cached --check` — **passed**. New migration received static contract inspection and test assertions. No SQL execution against a database occurred.

## Environment and release boundary

- Non-production DB target: **NONE** positively classified. Migration applied: **NO**. Mutating browser QA: **NOT VERIFIED**.
- Production DB, booking, payment, and Master Sheet mutations: **NONE**. Production verification: **NONE**.
- Merge: **NONE**. Deployment: **NONE**. Reports branch, Master Sheet integration, IAM, and Vercel were not changed.
- Working tree after the implementation commit was clean; the handoff is the only subsequent file change.
- Next permitted action: independent review and positively classified LOCAL/TEST/STAGING migration and browser verification. A separate owner gate is required for accepted merge and release.
- Rollback consideration: this is a prospective function and application contract. A release rollback would need a reviewed forward migration restoring the prior function definitions and a coordinated app revert; it should not rewrite historical booking rows. App and migration should be released together after verification, because either one alone can leave customer messaging and stored state inconsistent.
