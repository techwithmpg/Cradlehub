# Web P1 Notification Reliability — N4 popover TypeScript build correction (2026-11-09)

## Target and authority
- Target: CradleHub **Web** P1 Smart Booking Confirmation / existing Notification Reliability. No Desktop work.
- Incident: Vercel build log supplied by Owner: main `77a5555`, Next 16.2.4 compiled, TypeScript failed at `src/components/features/notifications/notification-bell.tsx:367` because `pendingCrmCount` was not declared by `NotificationBellDropdown`'s underlying `NotificationPopover` Props.
- Verified accepted main during inspection: `77a5555c79d7b44573cb2ec18a61d3b78f99e4a4`. `main` compare identical at initial branch creation.
- Review branch: `fix/web-p1-pending-booking-popover-props-20261109`. Do not merge, push to main or deploy merely to fix a build log. Independent review and Owner approval are required.

## Read-only root cause / consumers / ownership
- `notification-bell.tsx` passes `pendingCrmCount` through alias `notification-bell-dropdown.tsx`.
- `notification-popover.tsx` is the actual recipient, and its Props type omitted the count. The current grouping had relied on `workspace_notifications` rows, even though those are not the authoritative pending-booking queue.
- Server `bookings.status='pending_crm_confirmation'` is the source of truth. Authenticated branch-scoped snapshot `getCrmPendingBookingSnapshotAction` supplies the live count and on-duty schedule eligibility.
- `CrmPendingBookingAlert` owns single-request popup behavior; `NotificationPopover` owns grouped bell presentation. The split must be preserved.
- Other roles, account sessions, existing notification read/dismiss operations, payment/booking writes, and service-start popups are outside this correction.

## Exact scoped correction
1. `src/components/features/notifications/notification-popover.tsx`: declare optional nullable `pendingCrmCount`; show a grouped Needs Action doorway only for an integer count greater than one, with Smart Booking enabled for CRM. Grouping remains presentation-only; stored notices remain untouched.
2. `src/components/features/notifications/notification-bell.tsx`: pass zero when the authenticated CRM snapshot is missing or the CSR is off-duty; suppress overnight grouped prompts while preserving notification history.
3. `tests/lib/notifications/pending-booking-popover-contract.test.ts`: source contracts for caller/receiver, grouping gate, deep-link destination, and non-destructive notice handling.

## Exact checks and evidence
- VERIFIED: GitHub repository file reads at main `77a5555c...`, alias resolution, exact source anchor checks before commit, isolated branch creation and subsequent GitHub compare.
- NOT EXECUTED in this connector-only environment: `pnpm type-check`, `pnpm exec vitest run tests/lib/notifications/pending-booking-popover-contract.test.ts tests/lib/notifications/pending-booking-policy.test.ts tests/lib/notifications/n3-popup-contract.test.ts`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `git diff --check`; run on verified checkout with Node 24 / pnpm 10.33.2.
- NOT VERIFIED: authenticated dual-CSR browser test, live single/2+ queue behavior, shift handovers, actual Web Push, TEST DB, Vercel production deployment/commit. This scope does not claim to correct all N4 release blockers.
- REPOSITORY-RECORDED PRODUCTION EVIDENCE: GitHub code and merged PR history only. Owner-supplied Vercel log is a failed build, not successful production deployment.

## Acceptance and rollback
- Build must pass TypeScript through Next production build, and focused contract checks must pass.
- Single pending booking still gets its existing popup; multiple current pending bookings display one count-labeled Needs Action link, even if no `booking_created` notification row is present.
- Off-duty and disabled-feature views never show an N4 grouped prompt. Other roles retain notification presentation, no data mutation.
- On branch, revert the scoped two component changes and one test if the correction is rejected. No SQL, migrations, notification or booking records need rollback.

**Review decision: CORRECTION REQUIRED** until checks and independent review pass. No merge or deployment authorized.
