# Web P1 Notification Reliability — pending booking scheduler integration review (2026-11-09)

## Authorization and scope
- Target: CradleHub Web, existing P1 Notification Reliability / N4 Smart Pending Booking Confirmation.
- Owner requested implementation of queued overnight booking reminders, single-booking popups, grouped notices, duty-aware delivery, push deep links and shared resolution.
- Current accepted GitHub `main` at branch creation: `3f8b2be30e72924fa5570c2a411e277b09796896`.
- Isolated branch: `fix/web-p1-pending-booking-cron-review-20261109`.
- The N4 application implementation already reached main via PR #92. This follow-up only corrects the missing deployment scheduler entry and adds a regression contract test. It does not reimplement N4 or reopen N1–N3.
- Do not merge based on tests alone. Independent reviewer and explicit owner release approval are required.

## Current source truth
- `bookings.status=pending_crm_confirmation` is the authority, not unread notification rows.
- `/crm/bookings?bookingId=...` supports direct CRM review; existing CRM realtime reconciliation and server-side snapshot backstop are reused.
- `/api/notifications/pending-booking-reminders` is already protected by `CRON_SECRET` and returns 503 while `CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED` is not `true`.
- `docs/sql/P1_PENDING_BOOKING_PUSH_LEDGER_REVIEW_ONLY.sql` is an unexecuted review-only lease proposal; no historical migration reconciliation, production SQL, or local SQLite substitute is authorized.
- At inspection, main's `vercel.json` had only `/api/agent/follow-up`. The N4 handoff claimed the five-minute entry had been added, but it was absent in main. The correction branch registers it while preserving follow-up Cron.
- Automated push currently uses scheduled CSR eligibility, **not proven live attendance, sign-in, or assigned intake responsibility**. Do not equate scheduled staff with someone seated at the desk.
- Existing push worker may suppress a notice when any same-origin tab is visible. Closed-site push and other-tab behavior remain device acceptance items.

## Changed files
1. `vercel.json` — adds `*/5 * * * *` protected pending-booking route alongside the existing daily follow-up.
2. `tests/lib/notifications/pending-booking-cron-config.test.ts` — asserts both entries, guarding against silent schedule removal.

## Required gates
- Confirm actual Vercel team plan supports a five-minute Cron and the project is linked to the right deployment. Do not infer this from repository data. A five-minute Cron may not be permitted on Hobby.
- Verify `CRON_SECRET` is set and the feature flag remains OFF until tests and owner approval.
- Run `pnpm exec vitest run tests/lib/notifications/pending-booking-cron-config.test.ts tests/app/pending-booking-reminders-route.test.ts tests/lib/notifications/pending-booking-policy.test.ts`, `pnpm type-check`, targeted lint, `pnpm format:check` with existing baseline classification, `pnpm build`, and `git diff --check` on a verified checkout.
- Isolated TEST database: review/test ledger SQL privileges, concurrent claims, stale lease recovery, retry and branch isolation, without touching actual bookings/payments.
- Authenticated TEST browser: overnight queue, one/multiple pending, cash-flow focus, two CSR computers, switch accounts, logout/login, reconnect, other CSR confirmation, branch permissions.
- Actual OS/device push: closed PWA, subscription/permissions, duplicate-worker windows, deep link after auth, failed delivery and recovery; test both Main and SM.
- Reconcile overlapping draft booking PR #91 hold-expiry proposal before any capacity or expiry implementation. No automatic expiry/cancellation was included here.

## Evidence, limitations, rollback
- Verified: read-only main/PR source inspection and branch commits through GitHub connector.
- **NOT EXECUTED:** Node/pnpm checks, Vitest, lint, format, build, TEST DB, authenticated browser, device, live scheduler, production verification.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE:** Source and PR metadata only; not live behavior or deployed commit attestation.
- Production impact: NONE from isolated branch commits; no merge/deploy/SQL/feature activation performed.
- Rollback: remove the newly added `vercel.json` Cron entry in a reviewed corrective commit if plan/cost/reliability is unsuitable; existing daily follow-up remains. Feature flag OFF blocks new reminder route in all cases.

## Review decision
CORRECTION REQUIRED / REVIEW ONLY until the above quality, duty semantics, TEST database, browser/device and release authorization gates are complete.
