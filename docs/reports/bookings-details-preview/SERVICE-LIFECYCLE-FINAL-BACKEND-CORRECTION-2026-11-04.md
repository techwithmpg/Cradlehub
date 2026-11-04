# Service lifecycle final backend correction — 2026-11-04

## Verdict

**CORRECTION REQUIRED for release.** The desktop UI, guarded automatic-completion proposal, priced continuation command, and transactional start/manual-completion notifications are preserved in scoped WIP commits. The exact SQL passes synthetic LOCAL PostgreSQL tests, and the new priced command passes authenticated LOCAL Supabase Auth/PostgREST requests against a synthetic schema. The accepted full schema, scheduler, real CRM and assigned-therapist browser flow, and full cross-role reconciliation remain unverified. Nothing in this report authorizes production installation or activation.

## Branch and authority

- Worktree: `E:\cradlehub\.tmp\bookings-details-preview`.
- Branch: `fix/booking-details-preview-verification-20261103`.
- Recorded booking-details base: `b86f92587057e8dca31cf58baabf0715ee3322b0`.
- Preserved UI/notification WIP commit: `0812986647710975646868829e4f317abec87d83` (38 source/test files).
- Guarded completion WIP commit: `a0c1432d02ac74311a3b88c5a6fe1f6907a98d1a` (migration and 3 SQL fixtures).
- Backend correction WIP commit: `351a10353eb11bd19ff7608878fab550fca5a0da` (9 source/migration/test files).
- Refreshed accepted `origin/main`: `41e8001c2eef3f4c7814a74ae935944ee2fbd2cc` (11 commits newer than the branch merge base `173720a67b89bb25ee5fed4d2da26915c65295ea`). Including this report commit, the branch is 11 behind and 9 ahead. A read-only `git merge-tree` simulation exited 0 with no conflict markers; both branches edit `horizontal-booking-row.tsx` and `crm-booking-operations.ts` in separate hunks. No merge/rebase was applied.
- **PRODUCTION** Supabase was inspected read-only in the prior gate. This correction pass made no PRODUCTION database request. Disposable PostgreSQL 17 and Supabase Auth/PostgREST were **LOCAL** only; no TEST/STAGING target was used.
- No push, merge, deployment, production migration/data mutation, Cron installation, scheduler activation, or mobile booking UI work.

## Correction contents

- `20261104002009_priced_service_continuation_and_transition_delivery.sql` adds separate owner-configured positive continuation pricing for fixed services and a separate owner-configured branch treatment closing time. Neither receives a default or seeded value. Owners can revoke either configuration with an explicit null call. Extendable services use their current approved catalog increment, positive price, and maximum. Purchased service duration and original order `total_amount` remain snapshots.
- `continue_booking_service_session` requires a real authenticated active staff identity, an active in-spa started line, a canonical parent `order_id`, aligned approved increment, maximum duration, same-day due time, treatment close, an available therapist shift without blocks, and room capacity. It serializes the order and booking, checks live overlaps under the same advisory locks as the booking trigger, materializes a validated original payable only when absent, and atomically extends the due/end time, updates parent order continuation metadata, writes an immutable audit event, and appends a positive `surcharge` payable. A UUID idempotency key returns the prior committed event to the same actor on retry. The old free `extend_booking_service_session` RPC now fails closed. Legacy lines without a parent order require staff payment review; the desktop session panel shows that instruction and keeps Apply Extension disabled until release acceptance.
- The guarded auto-completion worker remains physically disabled by `CHECK (not enabled)`, has no Cron job, and now excludes missing-order legacy lines. It uses authoritative server time, two-minute grace, a future started-after cutover, row locking, and booking-line-only updates. A permitted continuation moves `session_due_at` under the same booking lock. Automatic completion retains its own atomic CRM/manager/assigned-therapist notification insert and does not write a financial table. The worker still requires full accepted-schema review before its release latch can be removed; no branch policy is enabled.
- An after-update trigger inserts start and manual-completion events into the existing `workspace_notifications` table in the booking transaction. It uses the same timestamp-based dedupe key as the web publisher; the publisher still checks all statuses so a dismissed event stays dismissed. A notification failure rolls back the transition. An installation cutover prevents historic session repairs from creating new toasts, while the existing bell's initial baseline suppresses old alerts. Realtime/reconnect and cross-CSR behavior remain browser acceptance items.
- The on-screen timer continues to tick every second from persisted `session_due_at`; no one-second database polling was added.

## Verification

| Gate | Result | Limit |
| --- | --- | --- |
| Focused Vitest, 9 suites | **69/69 passed** | Includes reminder queue, modal choices, countdown formatting, CRM RPC handling, group target, and notification dedupe. |
| TypeScript | `pnpm.cmd type-check` passed | Next.js 16.2.4 local tree. |
| Lint | Exit 0; 0 errors, 24 existing warnings | No new lint error. |
| Build | Passed; 153 static pages generated | Local build only. |
| Diff hygiene | `git diff --cached --check` passed before correction commit | Private screenshots never staged. |
| LOCAL PostgreSQL 17, exact continuation migration | Passed on fresh disposable container | Synthetic schema, not full repository schema. |
| LOCAL continuation SQL fixtures | Passed: priced fixed option, base payable plus one surcharge, order metadata, same-actor idempotency, max, old RPC rejection, no-order rejection, treatment close, shift, room, therapist conflict, unassigned staff, no financial writes on failed requests | The fixture exercises SQL contract and transaction behavior, not real application data. |
| LOCAL notification SQL fixtures | Passed: three committed manual-completion and three committed start records; start rollback left zero events; timestamp resave created no duplicate | Realtime browser and push delivery not exercised. |
| LOCAL guarded completion SQL fixture | Passed with release latch disabled, future-start cohort, exactly one eligible line after **test-only** latch removal, no-order/historical/sibling exclusions, three atomic notices and idempotent retry | Test-only latch removal was rolled back. Prior gate also passed concurrent manual completion and due-extension lock tests. |
| LOCAL Supabase Auth/PostgREST | Passed authenticated owner policy setup and CRM priced continuation/retry with two generated local Auth identities | Repository migrations were disabled; schema and rows were synthetic. This is not accepted full-schema integration. |
| Full LOCAL Supabase replay | Blocked by historical `20260430000001_staff_org_structure.sql:71`, PostgreSQL 42601 on `CREATE POLICY IF NOT EXISTS` | Historical migrations were not edited or bulk-replayed. The clean synthetic harness used an isolated project ID and was removed after testing. |
| Real CRM/therapist browser sequence | **Not verified** | No isolated TEST booking with separate assigned therapist and CRM identities; owner limited PRODUCTION checks to read-only. |

## Remaining release decisions and gates

1. The Owner must enter positive fixed-service continuation prices, increments and maximums for each service that may continue, plus a true treatment closing time for each branch. No values were invented. Legacy in-service bookings without an order need a separately approved financial policy; until then they fail closed and stay outside automatic completion.
2. An isolated TEST/STAGING environment with the accepted complete schema must run the exact migrations, authenticated authorization/RLS and financial tests, payment/discount/Cash Flow regression, group and attendance checks, and concurrency races. The synthetic harness cannot prove compatibility with every production trigger and view.
3. Separate TEST CRM and assigned-therapist identities must perform the twelve-step browser/database lifecycle, CRM-initiated and simultaneous starts, reconnect, dismissed-notice retry, and due-plus-two server completion. The global dialog, cross-CSR toast, and no-refresh Completed state cannot be marked passed from current evidence.
4. Before any release, independently review the branch against updated `origin/main`, install the migrations in the approved order, configure catalog continuation prices and treatment hours, verify outstanding legacy exceptions, explicitly approve the branch start cutover, and only then prepare a separate migration to remove the physical release latch and a separately authorized scheduler installation. Keep the CRM reminder flag off until application and database acceptance agree. The current review created no production eligible cohort.

## Security, financial impact, and rollback

The new RPC grants `EXECUTE` only to `authenticated` and resolves the actor from `auth.uid()` and active staff records; direct configuration, event, and treatment-hours table access is revoked from browser roles with RLS enabled. Its surcharge is a new auditable `order_payable_items` row linked to an event; no payment receipt, discount, allocation, or purchased commercial snapshot is fabricated. The `service_auto_completion_policy` release latch remains disabled. On a future approved release, disable the branch completion policy and unschedule Cron before any rollback; retain committed booking, notification, payable, and audit history for reconciliation. Revoke the new RPC or remove the trigger only through reviewed follow-up SQL, never by bulk deleting financial rows or reopening sessions.

## Committed source inventory

The three WIP commits preserve these 47 unique source/test paths. The separate report/README and private operational PNGs under this directory are not part of those commits.

```text
src/app/(dashboard)/crm/bookings/actions.ts
src/app/(dashboard)/crm/layout.tsx
src/app/(dashboard)/crm/service-start-actions.ts
src/app/(dashboard)/layout.tsx
src/app/(dashboard)/staff-portal/actions.ts
src/components/features/bookings/animated-session-timer.module.css
src/components/features/bookings/animated-session-timer.tsx
src/components/features/bookings/booking-details-modal.tsx
src/components/features/bookings/booking-list-row.tsx
src/components/features/bookings/booking-session-workspace.tsx
src/components/features/bookings/bookings-desktop-workspace.tsx
src/components/features/bookings/bookings-modal-stack.tsx
src/components/features/bookings/bookings-workspace.tsx
src/components/features/bookings/crm-bookings-operations-grid.tsx
src/components/features/bookings/global-service-start-provider.tsx
src/components/features/bookings/horizontal-booking-row.tsx
src/components/features/bookings/service-start-action-dialog.tsx
src/components/features/crm/today/cradle-flow-complete-dialog.tsx
src/components/features/notifications/notification-bell.tsx
src/components/features/staff-portal/service-session-countdown.tsx
src/lib/bookings/animated-session-timer.ts
src/lib/bookings/bookings-workspace-filters.ts
src/lib/bookings/crm-booking-operations.ts
src/lib/bookings/selected-booking-activity.ts
src/lib/bookings/service-session.ts
src/lib/bookings/service-start-reminders.ts
src/lib/bookings/service-transition-event.ts
src/lib/bookings/service-transition-notifications.ts
src/lib/notifications/create.ts
src/lib/notifications/workflow-notifications-store.ts
supabase/migrations/20261103140629_guarded_service_auto_completion.sql
supabase/migrations/20261104002009_priced_service_continuation_and_transition_delivery.sql
tests/app/crm/booking-actions.test.ts
tests/components/bookings/global-service-start-provider.test.tsx
tests/components/bookings/horizontal-bookings-workspace.test.tsx
tests/db/service-auto-completion-assertions.sql
tests/db/service-auto-completion-base.sql
tests/db/service-auto-completion-concurrency-fixture.sql
tests/db/service-continuation-assertions.sql
tests/db/service-continuation-base.sql
tests/db/service-continuation-safety-assertions.sql
tests/lib/bookings/animated-session-timer.test.ts
tests/lib/bookings/crm-start-service-rpc-hardening.test.ts
tests/lib/bookings/service-session-countdown-format.test.ts
tests/lib/bookings/service-start-reminders.test.ts
tests/lib/bookings/service-transition-notification-once.test.ts
tests/lib/bookings/service-transition-notifications.test.ts
```
