# WEB quick fix: completed service → CRM payment-ready modal (2026-11-08)

## Scope and baseline
- Target: Web only, accepted `main` base `be22a262b2298103a71f5cf33905f8f010dc9e89`.
- Fix branch: `fix/web-service-completion-payment-popup-20261108`.
- No Desktop changes, no production data mutation, no deployment or merge by this patch.
- This change displays a branch-scoped CRM popup **after the canonical service-completion event is persisted**, and only when payment may be outstanding and every non-cancelled line in an order is complete.
- Popup takes staff to the existing CRM booking/checkout. It never writes a payment, modifies the cash ledger, completes a session, or trusts a browser countdown.

## Verified repository/live context
- REPOSITORY-RECORDED PRODUCTION EVIDENCE: `src/app/(dashboard)/staff-portal/actions.ts` explicitly disables `autoCompleteDueSessionAction`; the timer's 'auto completes' label is not proof of completion.
- READ-ONLY LIVE DATABASE VERIFICATION (Nov 8): `public.complete_due_service_sessions` is a no-op; `public.service_auto_completion_policy` is absent; no service auto-completion cron job is active.
- Existing historical `20261103140629_guarded_service_auto_completion.sql` is intentionally review-only with a physical release fence and a two-minute grace period, requiring independent LOCAL/TEST acceptance and priced-continuation safety.
- Existing manual service completions publish `workspace_notifications` via `publishServiceTransition`.
- New UI reuses those existing completion notifications; source `auto_due` will be recognized when a separately approved server-side auto-completion release is installed.

## Pending acceptance / implementation
- Run `pnpm vitest tests/lib/bookings/service-completion-payment-ready.test.ts`, project typecheck/lint and real browser role/branch tests against LOCAL/TEST.
- Verify group orders and partial payments in the actual CRM checkout.
- Verify modal queue across another open dialog, multiple CSR devices and notification dismissal.
- Verify end-to-end actual automatic completion separately, including extension race, room turnover, notifications, payment, and cron uptime.
- No SQL was applied. **This PR does not activate automatic closure**, which requires a separate, server-authoritative and reviewed database release. Do not bypass the release fence with browser timers.
- Inspect active production schema before preparing a **new forward-only migration**; never replay the old review-only migration in bulk.
- Do not enable GitHub automatic merge until required external review and checks are configured. The repository currently reports `allow_auto_merge=false`.

## Rollback
- Revert this UI commit. Notification data and payments are not changed.
