# Web P1 — Notification N1 lifecycle and owner relevance (review only)

## Target and authorization
Owner said "go on" on 2026-11-08 after accepting N1, notification lifecycle/ownership/relevance.
Web baseline: `c263ebf835339948d0e4d47f368eb527e1d51313` on accepted `main`.
Branch: `fix/web-p1-notification-n1-lifecycle-20261108`.
Other branches (including Boutique B1 PR #76) remain intact and unmerged; Operation Center local preview is separate.
The PR records the final head SHA after publication; this report is not production verification.

## Source-backed problems
- Updating an existing open notification reset `unread`, `created_at`, and `read_at`, causing old alerts to look new.
- A repeated workflow-task signal reset an `in_progress` task to `open`.
- Dedupe race handling could update historical rows sharing a key rather than only open rows.
- Generic high-priority/booking push signals were copied to Owner even when addressed to CRM/staff.
- The bell included resolved notification history and Owner bell used unrestricted Owner-read RLS results.

## Changes
- Metadata-only refresh for an existing open notification/task, preserving lifecycle, time and ownership.
- Status-scoped collision recovery, leaving historical resolved/completed rows untouched.
- Owner phone push only for explicit Owner-targeted notifications; existing Owner preference still controls those notifications.
- Bell snapshot excludes resolved/dismissed history. Owner bell and its realtime stream display Owner-targeted notifications; routine booking sound no longer plays for Owner.
- Owner's bell "Mark all read" only updates Owner-directed notifications. Existing RLS remains authoritative.
- Targeted regression tests.

## Unresolved dependencies and verification
**CORRECTION REQUIRED FOR RELEASE.** GitHub-source-only changes. No Vitest, tsc, lint, build, browser, real device, actual database, push provider or production execution performed.
Tests to run on the branch with approved Node 24 and pnpm 10.33.2:
`pnpm exec vitest run tests/lib/notifications/workspace-notification-push-dedupe.test.ts tests/lib/notifications/workflow-task-lifecycle.test.ts tests/lib/notifications/service-start-push-targets.test.ts tests/lib/notifications/push-delivery-targeting.test.ts tests/lib/notifications/use-workspace-notification-realtime.test.tsx`;
then `pnpm type-check`, `pnpm lint`, `pnpm test -- --run`, `pnpm build`, and `git diff --check`.
Full cross-recipient completion and claiming must be traced per authoritative booking/attendance/task action in a future approved slice; do not equate reading with resolving. A resolved task could be re-created by a new producer event that reuses the old dedupe key, and some producers need occurrence-specific keys.
This does not remove notification pages, redesign service-start modals, activate reminder cron, add durable push retries, change RLS, or mutate the database. Keep existing deep links working.
Test two CSR sessions and an Owner with shared-branch notifications, login/reconnect, resolution, payment and attendance audit, and explicit Owner escalations. The Owner may still access cross-branch records in authorized operational pages; filtering the bell does not reduce RLS privileges.
Rollback: revert this isolated commit; no SQL rollback. Independent review and explicit Owner release approval are required before merge/deployment.
