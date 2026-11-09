# CradleHub Web P1 — Smart Pending Booking Confirmation (N4 review handoff)

## Authority and baseline
- **Target:** CradleHub Web, existing P1 Notification Reliability. Owner explicitly approved implementation of pending booking confirmation only on 2026-11-09.
- **Verified Web base at branch creation:** `main` `1445ad3e59056a9c1cad9bbf8b80adcf9bb0139e`.
- **Isolated branch:** `fix/web-p1-pending-booking-alerts-20261109`. The draft PR supplies its exact head SHA and changed-file list.
- **Prior accepted notification changes:** N1 PR #81, N2 PR #83, N3 PR #86 were already in main at this branch creation. Preserve those. P0 Attendance PR #90, Boutique PR #76, P1 Booking Visibility PR #22 and other open work are independent and untouched.
- No merge, deployed production change, migration execution, test database transaction or production data change authorized or performed in this handoff.

## Source of truth, consumers and side effects
- Public online booking writes `bookings.status='pending_crm_confirmation'` and emits shared branch CRM `booking_created`; group orders are confirmed atomically by the existing booking RPC. Payments, staff assignments and availability are independent.
- `bookings` remains the only authoritative pending-state source; `workspace_notifications` remains a separate bell/history signal, and closing/reading a notice must not change the booking.
- Current online confirmation calls `resolveConfirmedBookingRequestAlerts` only after a committed booking transition; the new snapshot and reminder query recheck the source booking status.
- Existing CRM route and `bookingId` query parameter open the selected booking. Existing `CrmBookingsRealtimeBridge` and `BOOKINGS_CHANGED_EVENT` reconcile the UI; polling/focus provides reconnection fallback.
- `staff_schedules`, `schedule_overrides` and `resolveScheduleForStaffDay` define effective scheduled duty, including valid overnight/split shifts. This is **scheduled eligibility, not proof of live login, physical attendance or assigned intake-vs-cashier duty**.
- The Web Push service worker is `public/cradlehub-push-sw.js` (NOT retired `public/sw.js`). Prior browser/OS delivery success is NOT verified by repository inspection.

## Implemented source changes (feature OFF by default)
1. A branch-scoped, server-only, bounded pending-booking snapshot with exact count. Old overnight requests are not filtered out by today's date. A failed query fails visibly instead of claiming no work.
2. A shift-aware schedule resolver that fails closed for missing, conflicting or day-off schedules and handles previous-day overnight windows. CRM-only staff get automated reminders, not Owner/therapist accounts.
3. An existing-CRM global presenter that checks on login, every 30 seconds, on focus and on booking updates. Exactly one pending booking opens a compact actionable Sonner popup (at most once every 10 minutes per CSR/branch/booking). Multiple bookings remain in one grouped bell doorway, now labelled by the server-authoritative pending count; editing or another dialog defers the popup.
4. Existing `booking_created` database notifications remain; the new feature gates their direct on-insert push to avoid off-duty/noisy bursts. Bell items are grouped for CRM under a link to existing Needs Action. N1-N3 non-destructive semantics remain.
5. A protected `/api/notifications/pending-booking-reminders` Cron route, server-only push recipient targeting to scheduled CSR staff IDs, and branch-wide single/grouped OS push digests. Successful reminders repeat at 10 minutes (single) / 20 minutes (group); failures retry on subsequent Cron invocations. Unstaffed branches are silently queued.
6. An **unapplied SQL draft** at `docs/sql/P1_PENDING_BOOKING_PUSH_LEDGER_REVIEW_ONLY.sql`, intentionally OUTSIDE `supabase/migrations`. It proposes service-role-only atomic branch leases to avoid concurrent schedulers sending duplicates. It must be reviewed and tested separately before being authorized for live application.
7. The protected Cron endpoint is implemented, but the proposed 5-minute `vercel.json` schedule is deliberately **NOT registered** pending plan verification, tested SQL, release checks and separate release authorization. The endpoint requires both `CRON_SECRET` and `CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED=true`, and otherwise does no delivery work.

## Scope exclusions and known limitations
- No automatic cancellation, booking expiration, inventory/capacity change, payment mutation, staff attendance mutation, customer SMS, Owner escalation, or unrelated notification page redesign. An unconfirmed booking continues to block availability per existing `hold-status.ts`; an automatic expiry policy requires separate owner approval and atomic availability safety review.
- Duty qualification is schedule-based. It does not prove somebody is actually at the desk or has clocked in; temporary cross-branch assistance and an intake/phone duty assignment are not yet integrated into this notification policy.
- A 5-minute Cron schedule is proposed, not installed. Its frequency must be checked against the actual Vercel plan and deployed environment before activation. No production scheduler/deployment verification is claimed.
- The draft SQL is NOT in the repository's active migration history; production activation without an approved/tested install will produce a logged RPC error and no scheduled push. Never bulk replay historical migrations.
- The lease gives at-most-one in-flight scheduler per branch, **not exactly-once device delivery** (a process crash after the Web Push endpoint responds and before lease finalization can lead to a retry; OS tag replacement mitigates UI duplication, not delivery accounting).
- The current service worker suppresses OS notifications when any same-origin visible window exists, even if it is not the assigned CRM viewer. This needs authenticated browser/device acceptance and potentially a separately reviewed acknowledgement design. Browser notification permission, valid subscription, network/OS restrictions and delivery are not guaranteed.
- Grouping in the existing bell is a presentation-only view over a bounded set of notification rows; the bookable source remains the server query. Notifications may be stale until business writer reconciliation succeeds. Do not treat bell count as the booking count.
- P1 urgency escalation for appointments approaching service time and a fallback when nobody takes duty are not implemented here. They must be evaluated for release readiness rather than implied by the reminder feature.

## Targeted checks (not executed in this GitHub connector-only session)
- From an authorized checkout of the exact branch with Node 24 / pnpm 10.33.2:
  - `git diff --check <verified-base>...HEAD`
  - `pnpm exec vitest run tests/lib/notifications/pending-booking-policy.test.ts tests/app/pending-booking-reminders-route.test.ts tests/lib/notifications/notification-presentation-policy.test.ts tests/lib/notifications/push-delivery-targeting.test.ts tests/lib/notifications/n3-popup-contract.test.ts`
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm exec vitest run`
  - `pnpm build`
- **Isolated TEST DB only:** apply reviewed draft SQL manually after explicit environment classification and review. Check anon/authenticated cannot execute claim/finish/reset, service-role can, and simultaneous claims allow exactly one lease. Verify stale lease recovery, empty queue reset, no direct booking/attendance/payment mutation, and inactive-branch isolation.
- **Authenticated browser:** two CSR accounts and two Main computers, SM branch isolation, off-shift/overnight/login, schedule overrides/day-off/overnight/split shifts, editing payment form, disabled feature, new+old booking, multiple pending then one remaining, service confirmed by other CSR, offline/reconnect, duplicate tabs, logout/login on shared desktop, direct booking links.
- **Device and push:** permission and push subscription, closed PWA/browser, stale subscription, device offline, failed push/lease retry, active unrelated window suppression, grouped OS push, renewal, payment-ready and therapist notification regression.
- **Operational:** Cron plan compatibility, secret handling, scheduler invocation and errors, metrics showing actual attempts/deliveries, no misrouted Owner notices, no stale tasks hiding a truly pending request.

## Evidence and decision
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE:** existing source and recorded earlier PRs show notification, shift, booking and push code; they do NOT establish live functionality of this change.
- Verified in this task: source inspection, exact accepted branch base at creation, successful isolated GitHub file commits, and PR diff metadata after publication. A GitHub Vercel status showed success, but authenticated Vercel deployment inspection identified the PR preview as **CANCELED (ignored build step)**, not a successful build or running preview. All runtime tests above, database operations, browser/device checks, compiled build checks, and live production behavior are **NOT VERIFIED**.
- **Review status: CORRECTION REQUIRED / DRAFT; DO NOT MERGE OR DEPLOY.** Complete quality gates, reconcile blockers, independent review, then explicit owner release approval.
- **Rollback:** feature flag OFF immediately disables new CRM presenter and protected Cron work; an eventual deployed release could revert this isolated P1 branch. If an explicitly authorized SQL installation later occurs, retain ledger/history until a separate migration rollback plan is reviewed. Do not use `db push --include-all`.
