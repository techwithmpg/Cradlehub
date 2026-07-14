# Attendance Operations Runbook

Last updated: 2026-07-14

This runbook describes the current Attendance operating model after `ATTENDANCE-AUTONOMY-HARDENING-001`.

Important status: Attendance is locally hardened and the main transactional scan/reset pieces are now present, but it is not production-closed until Supabase migration history is reconciled, remaining correction workflows are transactional, account-claim/challenge/reconciliation/canonical-host work is finished, and authenticated CRM/Owner plus real-phone QA are completed.

## CRM Closing Attendance Policy

For staff normalized to CRM/front desk (`crm`, legacy `csr` aliases, or
`staff_type=csr`) on a resolved Closing shift, Attendance uses the structured
branch operational close rather than the raw assigned schedule end. Defaults are:

- Physical close / earliest normal clock-out: 10:30 PM.
- Latest normal clock-out and staff reminder: 11:00 PM.
- Manager escalation: 11:30 PM.
- Hard cutoff: midnight.
- Provisional clock-out value at hard cutoff: 11:00 PM.

Before physical close is early; physical close through latest normal inclusive is
normal; later real scans are overtime. Raw schedule timestamps, including legacy
1:30 AM Closing ends, remain unchanged as scheduling evidence.

The five-minute Vercel cron calls
`/api/attendance/closing-interventions` with the existing `CRON_SECRET` convention.
The database processor locks eligible rows and writes stable intervention stages;
the server worker delivers through existing workspace notifications/tasks. Do not
label the scheduler active merely because `vercel.json` contains the cron. Confirm
`closing_intervention_last_run_at`, a clear last error, and platform cron execution.

At hard cutoff, `system_auto_close` writes the latest normal time, sets confirmation
required, leaves `clock_out_scan_event_id` null, creates the existing missing-
clock-out exception/correction evidence, and emits manager review work. A later
real QR scan before the safe business-day limit reconciles that same row through
`reconcile_provisional_attendance_clock_out`; it must not create a new clock-in.
Multiple candidates or unsafe timing preserve scan evidence and go to review.

Deployment order:

1. Reconcile Supabase migration history; do not blind-push.
2. Apply `20260714143000_attendance_fluid_operations.sql`.
3. Apply `20260714180000_attendance_crm_closing_policy.sql`.
4. Reload PostgREST and regenerate Supabase types from the resulting live schema.
5. Verify service-role-only mutation RPCs, authenticated branch reads, staff write
   denial, row locks, retry dedupe, no fake QR row, and rollback behavior.
6. Deploy the route/cron, observe a successful worker run, then run authenticated
   Owner and physical-phone CRM QA.

## Authoritative Flow

Normal Attendance scans should follow this order:

1. Resolve the public QR point and branch.
2. Resolve the device cookie and staff identity.
3. Validate branch authorization.
4. Resolve branch-local time, timezone, and attendance business date.
5. Resolve the exact schedule window and stable shift instance.
6. Resolve the current Attendance state for that shift instance.
7. Commit clock-in, clock-out, active-service-blocked, or Recovery through `public.commit_attendance_scan_transaction(...)` when the scan mutates interpreted Attendance state.
8. Persist the QR scan event, idempotent public result, and related Recovery/audit metadata.
9. Revalidate only affected Attendance/operations surfaces.

Current code owners:

- QR orchestration: `src/lib/attendance/scan-engine.ts`
- Scan intent: `src/lib/attendance/attendance-intent-engine.ts`
- Shift identity and branch-local time: `src/lib/attendance/shift-instance.ts`
- Current state/next action labels: `src/lib/attendance/attendance-state-machine.ts`
- Device registry: `src/lib/attendance/device-registry.ts`
- Device cookie secret handling: `src/lib/attendance/tokens.ts`
- Corrections: `src/lib/attendance/attendance-correction-service.ts`
- Transactional scan commit RPC: `supabase/migrations/20260712044527_attendance_transactional_scan_rpc.sql`
- Transactional selected-record reset RPC: `supabase/migrations/20260712045429_attendance_transactional_corrections_rpc.sql`

## Normal Device Connection

Expected operational result:

- A staff member scans the branch Attendance QR.
- A known active device cookie resolves to the staff profile.
- The scan continues into Attendance without CRM intervention.
- The final result is clock-in, clock-out, duplicate, blocked, or Recovery.

Operator checks:

- Confirm the staff profile is active and assigned to the branch or has an approved branch authorization.
- Confirm the device is active in CRM/Owner Attendance Devices.
- Confirm the latest successful scan is visible in the scan feed.
- If Test Mode is active, confirm the result is marked as test data.

Current limitation:

- Full first-time self-service device login/retry continuity still needs authenticated browser and phone QA before production sign-off.

## Cookie Recovery

Recoverable cases:

- Browser storage was cleared.
- Device cookie is missing.
- Browser changed but the staff identity can authenticate.
- Existing active device record has stale branch metadata.

Expected flow:

1. Staff scans the Attendance QR.
2. Device resolution fails in a recoverable way.
3. Staff authenticates through the inline Attendance login path.
4. The system links/re-recovers the device credential.
5. The original scan continues and returns the Attendance result.

Do not ask staff to:

- Choose themselves from a public staff list.
- Share a device credential.
- Send a raw device cookie.
- Keep rescanning indefinitely.

Escalate to CRM/Owner when:

- The device is lost, stolen, revoked for security, or security-blocked.
- The cookie appears to belong to another staff member.
- The staff profile is inactive or ambiguous.
- Authentication succeeds but branch authorization fails.

## Account Claiming

Target policy:

- Existing staff without `auth_user_id` should securely claim their existing staff profile through verified phone/email/approved identifier and OTP.
- The flow must never create a duplicate staff row or expose a public staff picker.

Current status:

- This task documented the policy and preserved existing Supabase Auth infrastructure, but a full OTP account-claim implementation remains a production blocker.

Required before enabling:

- Server-side rate limiting.
- Generic login/setup errors to avoid account enumeration.
- Expiring verification codes.
- Exact one-profile match by verified contact.
- Audit rows for claim attempt, success, and blocked ambiguity.
- CRM/Owner exceptional `Link Existing Staff Login` action for ambiguous or contactless staff.

## Phone Replacement

Default policy:

- One active primary Attendance phone per staff member.
- Optional approved secondary phone.
- Normal replacement can be self-service after staff authentication.
- Lost, stolen, suspicious, or security-blocked phones require authorized review.

Database support added:

- `staff_devices.device_role`
- `staff_devices.superseded_by_device_id`
- `staff_devices.security_state`
- `staff_devices.replacement_confirmed_at`
- `staff_devices.replacement_confirmed_by`

Operator flow for normal replacement:

1. Staff authenticates from the new phone.
2. Show current primary phone status.
3. Staff confirms replacement.
4. Old primary is superseded/revoked.
5. New phone becomes primary.
6. Audit the replacement and continue the scan.

Current limitation:

- Device policy fields and registry classification are ready, but the complete self-service replacement UI/transaction must still be QAed and completed before production closeout.

## Lost Or Stolen Phones

When a phone is reported lost or stolen:

1. Open CRM or Owner Attendance Devices.
2. Locate the staff member first, then the device.
3. Mark the device as lost or stolen using an authorized action.
4. Confirm `status` is no longer active and `security_state` reflects the report.
5. Confirm future scans from that device are blocked and create an actionable Recovery/security case.

Do not self-recover:

- Lost phones.
- Stolen phones.
- Security-blocked phones.
- Devices linked to another staff member.
- Devices associated with suspicious repeated login/scan attempts.

## Temporary Branch Assignments

Branch authorization should answer: is this staff member authorized to work at this QR branch now?

Allowed reasons:

- Home branch.
- Approved temporary branch assignment.
- Schedule override for another branch.
- Approved permanent transfer.
- Authorized multi-branch role.
- Owner-approved cross-branch assignment.

Stale device branch metadata:

- If the device belongs to the same staff member, the device is active, and the staff member is authorized at the scanned QR branch, the system may synchronize the device branch metadata.
- The sync should be audited as `attendance_device_branch_synchronized`.

Blocked reasons:

- Staff inactive.
- QR inactive.
- Genuine wrong QR branch.
- Identity ambiguous.
- Device lost/stolen/security-blocked.
- Device belongs to another staff member.

## Test Mode

When Test Mode is enabled:

- CRM and Owner Attendance must show a persistent banner.
- Test scans stay separate from live records.
- Diagnostics and scan results must clearly report `is_test`.
- Payroll, availability, and normal live Attendance summaries must exclude test records.

Return to Live Mode:

1. Verify the branch.
2. Confirm who enabled Test Mode and why.
3. Use an authorized Return to Live Mode action.
4. Audit the action.
5. Verify the next scan is live data.

Current limitation:

- Test Mode separation exists in the data path, but final banner/action QA remains pending.

## Recovery Review

Recovery should contain one active case per actionable issue, not one issue per refresh.

Deduplication support added:

- `attendance_exceptions.dedupe_key`
- `attendance_exceptions.occurrence_count`
- `attendance_exceptions.first_detected_at`
- `attendance_exceptions.last_detected_at`
- `attendance_exceptions.latest_scan_event_id`
- `attendance_exceptions.related_checkin_ids`
- `attendance_exceptions.recommended_action`
- `attendance_exceptions.priority`

Review steps:

1. Open CRM or Owner Attendance Recovery.
2. Select a Recovery case.
3. Inspect staff, branch, schedule, shift instance, recent scans, and related check-ins.
4. Use only safe repair actions that apply to the current state.
5. Require a reason for corrections.
6. Preserve raw QR scan events.
7. Verify the correction audit row and expected next action.

Do not:

- Delete raw scan events.
- Reset an entire staff day when only one interpreted record is wrong.
- Resolve a case without confirming the linked record update succeeded.

## End-Of-Shift Reconciliation

Target reconciliation detections:

- Scheduled shift started but no clock-in.
- Shift ended without clock-out.
- Open session beyond allowed shift end.
- Clock-in without valid schedule.
- Wrong-branch attempt.
- Device registered but Attendance failed.
- Overlapping active sessions.
- Unresolved closing scan.

Expected behavior:

- Update late, absent, not-arrived, or missing-clock-out status.
- Create or update one Recovery case.
- Update staffing readiness.
- Notify CRM only when action is required.

Current status:

- Deduped Recovery storage is ready.
- A scheduled reconciliation job/RPC is still required before Attendance can be declared autonomous end-to-end.

## Migration Verification

Attendance migrations from this hardening sequence that must be reconciled:

- `supabase/migrations/20260710040835_attendance_recovery_rules.sql`
- `supabase/migrations/20260710055131_attendance_test_mode.sql`
- `supabase/migrations/20260712000100_attendance_state_reset.sql`
- `supabase/migrations/20260712035222_attendance_autonomy_hardening.sql`
- `supabase/migrations/20260712044527_attendance_transactional_scan_rpc.sql`
- `supabase/migrations/20260712045429_attendance_transactional_corrections_rpc.sql`
- `supabase/migrations/20260714143000_attendance_fluid_operations.sql`
- `supabase/migrations/20260714180000_attendance_crm_closing_policy.sql`

Live linked-schema checks from this continuation:

- Recent Attendance columns, constraints, and indexes from the older pending files are present in the linked schema.
- `public.commit_attendance_scan_transaction(...)` and `public.reset_attendance_state_transaction(...)` are present, `security invoker`, and executable only by `postgres` and `service_role`.
- No-mutation probes return `invalid_request` rows instead of inserting data.
- `supabase_migrations.schema_migrations` still reports `0` rows for the six recent Attendance versions above, so migration history is not reconciled.

Verification commands:

```bash
pnpm db:status
pnpm db:doctor
pnpm db:types
pnpm type-check
pnpm test
pnpm build
```

Current blocker from this environment:

- Local Supabase Postgres is not running at `127.0.0.1:54322`.
- Linked migration-history reads time out to `aws-1-ap-northeast-1.pooler.supabase.com:5432`.
- `pnpm db:status` reports `Remote schema changed: no` before the timeout, but the migration list cannot be verified.

Do not manually edit migration history. Reconcile migrations from a working Supabase DB path, then regenerate types and rerun app checks. If using the linked SQL path for an emergency function replace, record exactly what was applied and keep the normal migration-history repair as an explicit blocker.

## Production Troubleshooting

If scans fail:

1. Check whether the QR point is active and belongs to the scanned branch.
2. Check whether `ATTENDANCE_DEVICE_SECRET` is set in production.
3. Check the canonical scan hostname and redirects.
4. Check the staff profile, branch assignment, and device status.
5. Check branch timezone, attendance day boundary, and schedule window.
6. Check `qr_scan_events` by request id or operation id.
7. Check whether a deduped Recovery case already exists.
8. Check whether Test Mode is active.

Never log or expose:

- Passwords.
- OTPs.
- Raw device credentials.
- Device secret.
- Auth tokens.
- Client-readable device cookies.

Known production blockers:

- Main interpreted scan mutations now use a transactional scan RPC, but event-only/noop paths still need QA under retry/concurrency.
- Selected-record Attendance State Reset now uses a transactional correction RPC; the remaining correction workflows still need transactional rollback guarantees.
- Account claim, rotating challenge, canonical host enforcement, and scheduled reconciliation remain incomplete.
- Authenticated CRM/Owner and physical-phone QA remain required.
