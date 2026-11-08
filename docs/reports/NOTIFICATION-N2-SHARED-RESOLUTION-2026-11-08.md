# CradleHub Web — N2a shared post-commit notification resolution

## Scope and authority
Owner said "go on with n2" on 2026-11-08 after N1 PR #81 merged.
- Target: **Web** only, controlled stabilization P1 notification correction.
- Base: verified `main` commit `6c5b3b9f4181c0885abbd241853fc8e6f095cec3`.
- Review branch: `fix/web-p1-notification-n2-shared-resolution-20261108`.
- Other drafts/working tracks (including Boutique B1 PR #76 and Attendance P0 PR #82) are not merged, edited or authorized by N2.

## Verified repository findings
- Public booking creation creates a shared branch CRM `booking_created` notification requiring action. `confirmCrmBooking` did not close it on successful single/order confirmation.
- Payment confirmation already closes `payment_pending` alerts and must not be equated with booking confirmation. Assigned service notifications must remain until their appropriate workflow transition.
- CRM Attendance resolves `attendance_exceptions`, but the owning writer did not close the staff question, CRM response or corresponding follow-up and technical escalation tasks.
- One staff-schedule-exception resolver broadly closed all CRM exceptions for a booking even though each independent warning has its own dedupe key.
- N1 realtime bell already removes a notification when its shared row moves to resolved; N2 only needs to cause the correct authoritative post-commit transitions.

## Implementation / evidence
- New isolated server-owned post-commit reconciliation helper with exact branch, entity, workspace and type scoping.
- Online atomic confirmation clears CRM booking review alerts for primary+changed booking IDs only **after** the successful RPC; ordinary and idempotent single-booking confirmations also reconcile after verified success.
- Attendance exception updates only OPEN rows within the authorized branch and demands a returned updated row before closing associated alerts/tasks. Independent prevention-verification tasks remain open.
- Staff schedule exception resolution matches exact dedupe key; other warnings are left intact.
- Best-effort cleanup failures are logged, not misreported as failed customer bookings or attendance updates.
- Focused Vitest tests cover exact selectors, multi-booking dedupe, safe error boundaries and call-site sequencing.

## Known limitations — required further work
- No universal cross-recipient acknowledgment or exclusive atomic CSR task claim is added. A shared branch notification row synchronizes its status after authoritative resolution, but multi-session browser tests are still REQUIRED.
- If notification cleanup fails transiently after the business commit, old alerts can persist until a separately approved reconciliation/retry mechanism exists; no guaranteed transactional coupling is claimed.
- Other workflows (booking cancellation/group partial cancellation, payment line variants, staff changes, dispatch, alternate Attendance correction entrypoints) must be individually traced before changing their resolution semantics.
- No new notification UI, modal redesign, dedicated page removal, cron activation, push-outbox creation, automatic staff acknowledgment, Auth/RLS, schema, migrations, production SQL, or deployments.
- Does not automatically complete workflow tasks just because a recipient reads a message.
- Production is **NOT VERIFIED**. Repository code and PR info are only code evidence.

## Release gates
**CORRECTION REQUIRED for release until verified.**
- Tests **NOT EXECUTED** in GitHub connector context. On clean authorized worktree with Node 24/pnpm 10.33.2 run:
  `git diff --check`; `pnpm type-check`; `pnpm lint`; `pnpm exec vitest run tests/lib/notifications/shared-resolution.test.ts tests/lib/notifications/n2-action-hook-contract.test.ts tests/lib/notifications/workspace-notification-push-dedupe.test.ts tests/lib/notifications/workflow-task-lifecycle.test.ts tests/lib/bookings/staff-schedule-exception.test.ts`; `pnpm exec vitest run`; `pnpm build`.
- LOCAL/TEST authentic CSR A and CSR B concurrent: booking notification visible to both; confirmed once; both bells clear; failed confirm leaves it. Concurrent attendance exception resolution succeeds once; all corresponding alerts/tasks close; independent prevention follow-up stays open.
- Verify branch B cannot read/resolve branch A alerts; staff and owner subscriptions not unexpectedly notified; payment and therapist assignments persist as appropriate.
- Confirm notification creation/closure on disconnect/reconnect and fresh login, with no phantom success or duplicate booking.
- Independent reviewer must inspect changed files/base/head, test output, browser/database evidence and authorizations; no merge or deployment without owner approval. Rollback: revert review commit; no SQL rollback.
