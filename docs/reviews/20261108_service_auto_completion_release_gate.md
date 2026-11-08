# CradleHub Web — Future-Only Auto-Completion Release Gate
**REVIEW ONLY. DO NOT RUN THE ACTIVATION SQL IN PRODUCTION WITHOUT EXTERNAL REVIEW AND OWNER APPROVAL.**

## Installed candidate
- Branch: `fix/web-auto-complete-due-service-20261108`.
- New forward-only migration: `20261108190000_future_only_service_auto_completion.sql`.
- The migration creates a per-branch policy, replaces the disabled RPC, and adds a physical `CHECK (NOT enabled)` release gate.
- It does **not** activate a branch, schedule any Cron task, modify existing booking rows, or record payment.
- It does not replay historical local/review migrations.

## Required LOCAL/TEST acceptance
1. Verify the exact repository base/head, changed files, and no other active Web stage was merged.
2. Apply the candidate migration to an ISOLATED synthetic DB. Confirm the function has no effect with the physical gate.
3. In LOCAL/TEST ONLY, remove the physical gate and activate a branch with `eligible_started_after` and `activated_at` both set to the current server timestamp. Confirm existing stale sessions remain untouched.
4. Start a legitimate synthetic in-spa service AFTER activation. Use an authentic server timestamp, order, room, staff and duration snapshot.
5. At the latest authoritative `session_due_at`, execute the function and verify exactly one completion record, auto_due source, customer-stats/booking-event triggers, an appropriate utility room-turnover task, CRM/manager/staff notifications, and no financial mutation.
6. Verify due-time extension wins when correctly committed first. Verify manual completion/automatic completion race, 5 concurrent invocations, cancelled/no-show, group bookings, paid/unpaid, other branch, overnight boundaries, invalid duration, room mismatch, and missing order.
7. Verify in the REAL CRM browser: countdown becomes completed after the persisted change; CRM popup appears and leads to the existing booking/checkout; no payment is auto-collected.
8. Run active Web quality gates: TypeScript, lint, relevant Vitest, build, browser and synthetic DB tests. Record exact commands, SHA, outputs and rollback.
9. Require independent reviewer PASS and owner's explicit release approval. Tests alone do not authorize merge.

## Proposed Supabase activation (NOT EXECUTED)
Supabase Cron supports sub-minute schedules (Postgres 17). Following full acceptance:
- Install the reviewed forward-only migration once, using verified migration state.
- In a SEPARATELY approved change, drop the physical `service_auto_completion_release_gate`.
- Insert/update per-branch policy with `enabled=true` and `eligible_started_after=clock_timestamp()` and `activated_at=clock_timestamp()`, both in the same activation transaction; do NOT enable prior sessions.
- Schedule `cron.schedule('cradlehub-service-auto-completion','10 seconds','select * from public.complete_due_service_sessions(50);')` as the authorized scheduler owner.
- Verify `cron.job` and `cron.job_run_details`; test a new, authenticated synthetic booking only, not a customer booking.
- Observe booking-events, attendance recalculation, CRM notifications, payment and utility turnover for the approved rollout window.

## Emergency halt
Disable all active policies and unschedule ONLY the new auto-completion job after identifying its exact ID/name.
Do not revert previously completed booking rows, delete audit logs, or replay migrations.

## Live read-only evidence (2026-11-08)
- Existing `complete_due_service_sessions` SQL returns immediately (NO-OP).
- No `service_auto_completion_policy` table or auto-completion Cron job currently exists.
- Eleven sessions were already overdue; one preliminarily met order/room/in-spa conditions. Existing overdue sessions must NOT be bulk-closed.
- 60 recent sessions matched their authoritative due timestamp to base duration plus extension snapshot.
- Existing manual completion updates the canonical booking record and emits completion notifications.
- The Web CRM payment-ready dialog from merged PR #77 polls the existing notification table.
- Live SQL and deployed API behavior are NOT claimed verified for this candidate. No production writes were performed here.

## Status
- Implementation candidate: repository branch prepared.
- Automated tests / local PostgreSQL / real browser: NOT EXECUTED in this conversation.
- External independent review: NOT DONE.
- Production activation: NOT DONE. Verdict: CORRECTION REQUIRED until these gates close.
