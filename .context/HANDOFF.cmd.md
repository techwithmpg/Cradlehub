# HANDOFF - Next Agent Session

## ATTENDANCE-FLUID-OPERATIONS-001 - 2026-07-14

The local record-first Attendance implementation is complete. A sole open row is
now closed by the next valid scan even when stale/mismatched, multiple opens and
first closing scans are captured for review, effective branch authority is
date/schedule/cross-branch/home ordered, and all consumers share the exact eight-
state operational model. Review corrections are transactionally linked to the
exception and actor audit. Reports are limited to the three operational outputs.

Migration `20260714143000_attendance_fluid_operations.sql` is intentionally not
applied to the linked database because project context forbids a blind broad push
while migration history is unreconciled. Before runtime deployment, reconcile
history, apply this migration through the approved focused path, regenerate types,
and verify grants/RLS/triggers/RPCs. Then run authenticated CRM + physical-phone QA,
including temporary branch work, cleared-browser recovery, simultaneous scans,
manual correction, and payroll export. Static verification: type-check/lint pass;
full tests pass (123 files / 859 tests), the production build passes (109 static
pages generated), and `git diff --check` passes.

---

## ATTENDANCE-SCAN-RESOLUTION-001 - 2026-07-14

Canonical safe resolutions, event-backed Recovery, review semantics, CRM/staff
conversation, and technical escalation are implemented. Migration `20260714105907`
was applied through linked SQL and its RLS/grants verified. Type-check, lint, full
tests (848), and diff check pass. Physical phone/authenticated browser QA and
migration-history reconciliation remain pending.

---

## Current Task - 2026-07-13

CRADLE-ATTENDANCE-DIAGNOSTICS-AND-SCAN-REPAIR-009 is implemented, live contract migration applied, and code/build verified.

Done:
- Audited the public Attendance QR scan pipeline end-to-end: route, server actions, client processor, device/QR lookups, schedule resolver, intent engine, shift instance identity, transaction RPC, and Recovery exception persistence.
- Live DB probes confirmed the RPC exists and preserves rejection codes, RLS remains enabled, and the root mismatch was internal exception codes being persisted against the stable `attendance_exceptions.exception_type` CHECK constraint.
- Added `src/lib/attendance/scan-errors.ts` for structured safe public error codes, operation IDs, server-only technical logging, and non-200 backend failure responses.
- Added `src/lib/attendance/exception-codes.ts` to map internal scan reasons to stable DB exception types while preserving `metadata.internalExceptionType` for Recovery UI.
- Restored generated Supabase typing for Attendance DB access in `src/lib/attendance/db.ts` and fixed typed JSON/RPC boundaries exposed by that change.
- Patched scan helpers so query/write errors are no longer treated as empty results, including QR/device lookup, duplicate lookup, open checkins, schedule queries, Recovery exception writes, and idempotency replay.
- Patched shift identity/source handling: `weekly | override | recovery | none`, source row/window id, window order, and authoritative `ends_next_day`.
- Added and live-applied `supabase/migrations/20260713082146_attendance_scan_contract_repair.sql` through linked SQL because direct `db push` timed out. Verified `schedule_overrides.ends_next_day`, the new schedule-source constraint, migrated source counts, migration record, and safe no-mutation RPC rejection.
- Verification passed: `npx tsc --noEmit`, focused attendance tests (5 files / 28 tests), and `pnpm build` (Next.js 16.2.4, 108 routes).

Still open:
- A real physical phone scan was not certified in this session. Operator QA should scan with a registered active staff device and confirm the phone either commits attendance or shows the new precise safe code/operation ID.
- Recent Supabase migration history is still behind live schema effects from prior manual repairs. Do not run a blind `db push` until migration history is reconciled from a working direct DB path.

Next steps:
1. Run live registered-device QR QA for clock-in, duplicate scan, clock-out, off-day/missing-schedule Recovery, and wrong-branch correction.
2. Reconcile recent Supabase migration history, including manually applied schedule and attendance repair migrations.
3. Regenerate DB types from the reconciled live schema and rerun type-check/tests/build.

---

CRADLE-SCHEDULE-LEFTOVER-CLEANUP-008 is implemented, live cleanup applied, and code/build verified.

Done:
- Audited the three leftover visible warnings against live data:
  - Dante/Boy has real invalid individual schedule windows (`02:00-22:00`, 20 hours) and now surfaces as `schedule_invalid_time_window` / `INVALID_TIME_WINDOW` with exact source ids and fingerprint.
  - Angels Massage booking `1ea3ce31-6ead-49e0-9ff4-43501d5cf20d` has no explicit service/resource requirement, so missing-room warnings were broad false positives.
  - Main Spa's 29-staff coverage warning came from corrupted `scheduling_rules` minima, not an explicit coverage rule.
- Added and live-applied `supabase/migrations/20260713090000_schedule_leftover_cleanup.sql`.
- Verified `schedule_repair_backups` contains 7 stale schedule-row backups and 1 scheduling-rule backup; stale superseded active `single` rows are removed; Main Spa minima are restored to `1/1/1/0/0`.
- Patched live conflict generation to emit exact schedule issue types/codes/fingerprints/source ids, remove the "All day" false fallback, require explicit service metadata for missing room/resource warnings, and require explicit coverage requirements for coverage gaps.
- Patched Schedule, Spaces/Rules, Manager Today, and mobile manager surfaces to use the same explicit resource-requirement helper.
- Added regression tests for no-explicit-room warnings, explicit-room warnings, coverage gating, exact invalid-window fingerprints, and Manager Today room assignment counts.
- Verification passed: `npx tsc --noEmit`, focused schedule/manager tests (5 files / 24 tests), `pnpm test --run` (95 files / 735 tests), `pnpm lint`, and `pnpm build` (Next.js 16.2.4, 108 routes).

Still open:
- Dante/Boy's invalid 20-hour windows are legitimate data needing CRM correction, not a stale fallback issue.
- Nikki's ambiguous active Opening/Closing overlaps remain for CRM review.
- Linked Supabase migration-history reads through the direct pooler path remain uncertified from this environment. Live effects are verified through Management API SQL probes.

Next steps:
1. Reconcile migration history for recent schedule migrations from a working direct DB path.
2. Run authenticated CRM browser QA for Daily Timeline, Conflict Center, Manager Today, and Adjust Schedule with live branch data.
3. Correct remaining genuine schedule data issues in CRM, starting with Dante/Boy's invalid 20-hour windows and Nikki's ambiguous overlaps.

---

CRADLE-SCHEDULE-SYSTEM-UNIFICATION-007 is implemented, live realtime repaired, and code/build verified.

Done:
- Added canonical shift adapter in `src/lib/schedule/schedule-domain.ts`: UI `regular/opening/closing`, DB `single/opening/closing`, no active UI display of `single`.
- Extended resolver with `STAFF_NOT_OPERATIONAL`; kept missing schedule, configured day off, valid schedules, split, overnight, and conflicts as distinct states.
- Replaced Daily Timeline data loading with an operational branch roster query plus direct joins for `staff_schedules`, `schedule_overrides`, `blocked_times`, `staff_shift_checkins`, `bookings`, and `branch_resources`.
- Preserved Daily Timeline layout while adding Not Configured / Day Off / Needs Review states, split-window filtering, opening/regular/closing colors, overnight rendering, and attendance presence labels.
- Schedule Setup now imports `individual-schedule-window-editor`, which uses the same Adjust Schedule draft DTO, weekly editor, validation, preview, and `updateCrmStaffWeeklyWindowScheduleAction` save action.
- Staff portal week planning now groups same-day windows and resolves through the shared resolver instead of overwriting split shifts.
- Live conflicts no longer emit `missing_schedule`; missing schedule is a schedule state, not a conflict.
- Added `staff_shift_checkins` realtime subscription.
- Added and live-applied `supabase/migrations/20260713064332_schedule_realtime_publication.sql`; verified `staff`, `staff_schedules`, `schedule_overrides`, `blocked_times`, `staff_shift_checkins`, `bookings`, and `branch_resources` are in `supabase_realtime`.
- Verification passed: focused schedule/staff-portal tests (8 files / 41 tests), `npx tsc --noEmit`, `pnpm test` (94 files / 731 tests), `pnpm lint`, `pnpm build`, and `git diff --check` with CRLF warnings only.

Still open:
- Linked Supabase migration-history reads through the direct pooler path remain uncertified from this environment. Live schema effects are verified through Management API SQL probes.
- Authenticated CRM browser QA against live branch data is still recommended for the Schedule Setup/Adjust Schedule save flows and Daily Timeline realtime refresh.
- The old `individual-schedule-editor.tsx` file remains in the tree but Schedule Setup no longer imports it; it can be deleted in a cleanup pass if desired.

Next steps:
1. Reconcile Supabase migration history from a working migration-history connection for the schedule repair and realtime publication migrations.
2. Run authenticated CRM QA: Schedule Setup save, Adjust Schedule save, Daily Timeline roster/status/realtime refresh, booking availability smoke.
3. After migration history is reconciled, rerun DB status/types and app verification.

---

CRADLE-SCHEDULE-UPDATE-INTEGRATION-REPAIR-006 is implemented, live schema repaired, and code/build verified.

Done:
- Reproduced root cause: Adjust Schedule/Schedule Setup called `replace_staff_weekly_schedule(uuid, uuid, jsonb)` but the linked live DB had no RPC and still used the old `staff_id, day_of_week, shift_type` unique constraint.
- Added `supabase/migrations/20260713035024_schedule_update_integration_repair.sql` with stale inactive placeholder backups/cleanup, ordered-window `staff_schedules` constraint repair, 1..12 window check, validation trigger, operational helper functions, `replace_staff_weekly_schedule`, and PostgREST schema reload.
- Applied that corrective migration to the linked live schema through `supabase db query --linked --dns-resolver https --file ...` because the project `db push/status` pooler path still timed out.
- Verified live catalog: only `staff_schedules_staff_day_window_unique` remains, `replace_staff_weekly_schedule` exists as `SECURITY DEFINER`, trigger/index/check constraints exist, duplicate staff/day/window keys are zero, and invalid inactive placeholders are zero.
- Verified app-facing PostgREST RPC visibility with a fake-ID `supabase-js` service-role call: returned business validation `23514`, not function-not-found.
- Verified rollbacked live RPC round-trip with a real staff member's current rows: returned 7 rows and rolled back.
- Patched Adjust Schedule, Schedule Setup, and manager single-day schedule write paths to use the ordered-window RPC contract and structured safe error codes.
- Patched schedule consumers/selectors to carry `window_order` and `ends_next_day` where the resolver/scoring/display needs them.
- Verification passed: focused schedule/action tests (5 files / 38 tests), `npx tsc --noEmit`, and `pnpm build`.

Still open:
- `pnpm db:push --dry-run` and `pnpm db:status` still time out against `aws-1-ap-northeast-1.pooler.supabase.com:5432`, including escalated retries. Live schema is fixed, but migration history is not certified from this environment.
- Authenticated CRM browser QA against live branch data is still recommended for the Adjust Schedule save flow.

Next steps:
1. Restore/reconcile the direct Supabase migration-history path and run `pnpm db:status`.
2. If migration history does not include `20260713035024`, reconcile it with the live-applied corrective SQL using the approved database runbook.
3. Run authenticated CRM QA: open Daily Timeline, Adjust Schedule, edit/save weekly rows, reopen, and confirm booking/Today/Timeline refresh behavior.

---

CRADLE-BACKEND-STABILIZATION-AND-SCHEDULE-REPAIR-001 is locally implemented and fully verified, but production database apply is still blocked.

Done:
- Added `supabase/migrations/20260712165012_backend_stabilization_schedule_repair.sql` with schedule repair backups, operational staff helpers/view, booking-rule fee columns, overlap validation triggers, and transactional weekly replacement RPCs for staff and schedule groups.
- CRM weekly staff schedule saves now call `replace_staff_weekly_schedule(...)` and verify returned rows.
- Group weekly schedule saves now call `replace_group_weekly_schedule(...)` and verify returned rows.
- Availability provider selection now excludes inactive, archived, merged, test, and explicitly non-schedulable staff through `src/lib/staff/operational-staff.ts`.
- Supabase types were regenerated from the linked schema and locally reconciled for pending booking-rule fee columns.
- Verification passed: migration rollback dry-run against linked DB, focused schedule/action/staff tests, `pnpm type-check`, `pnpm lint`, `pnpm test` (89 files / 710 tests), and `pnpm build` (Next.js 16.2.4, 108 routes).

Still blocked:
- The migration was not applied to production. `pnpm db:doctor` and `pnpm db:status` still time out while reading linked Supabase migration history on `aws-1-ap-northeast-1.pooler.supabase.com:5432`; `db:status` reports `Remote schema changed: no` before failing.
- Do not run a blind `db push` from this environment because remote migration history is behind live schema effects.

Next steps:
1. Apply `supabase/migrations/20260712165012_backend_stabilization_schedule_repair.sql` from a working migration-history path.
2. Rerun `pnpm db:types`, `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
3. Resolve Nikki's same-timestamp active opening/closing schedule overlaps manually after business confirmation.
4. Move manual import and group apply-to-staff schedule replacement onto transactional RPC paths.
5. Complete duplicate staff merge/identity cleanup only after reviewing bookings, attendance, payroll, and Auth ownership.

---

## Current Task - 2026-07-12

ATTENDANCE-AUTONOMY-HARDENING-001 has a continuation checkpoint: the main interpreted scan commit RPC and selected-record reset RPC are implemented and live on the linked schema, but Attendance must not be declared production-closed yet.

- Added authoritative shift-instance and branch-time handling in `src/lib/attendance/shift-instance.ts`.
- Added `src/lib/attendance/attendance-state-machine.ts` for current state and next expected action after scans/corrections.
- `scan-engine.ts` now captures immutable shift snapshots (`shift_instance_key`, schedule source/id, branch timezone, attendance business date, scheduled start/end), uses configured branch timezone/business date, dedupes active Recovery cases, and stores idempotent operation metadata on scan events.
- `attendance-correction-service.ts` now fails loudly when selected-record reset/correction substeps fail and reports the actual post-reset next action.
- Device Registry now loads branch staff first and devices by staff id, avoiding stale `staff_devices.branch_id` as the primary membership filter and avoiding broad raw scan-event reads.
- Production `ATTENDANCE_DEVICE_SECRET` is now required; only local development gets the explicit fallback.
- Added migration `supabase/migrations/20260712035222_attendance_autonomy_hardening.sql`.
- Added `docs/maintenance/attendance-operations-runbook.md`.
- Added `supabase/migrations/20260712044527_attendance_transactional_scan_rpc.sql` and routed normal interpreted clock-in, clock-out, active-service-blocked, and Recovery-intent scan commits through `public.commit_attendance_scan_transaction(...)`.
- Added `supabase/migrations/20260712045429_attendance_transactional_corrections_rpc.sql` and routed selected-record Attendance State Reset through `public.reset_attendance_state_transaction(...)`.
- Updated generated Supabase types for the new RPCs and added `tests/lib/attendance/transactional-scan-rpc-migration.test.ts`.
- Linked DB verification confirms both new RPCs exist, are `security invoker`, are executable only by `postgres` and `service_role`, and reject invalid no-mutation probes.
- Focused continuation verification passed: Attendance tests (5 files / 30 tests) and `npx tsc --noEmit --pretty false`.
- Final requested suite passed: `pnpm type-check`, `pnpm lint`, `pnpm test` (88 files / 699 tests), and `pnpm build` (Next.js 16.2.4, 108 routes).
- Follow-up hydration fix: CRM/Owner Attendance now pass the serialized `data.serverNowMs` snapshot into `AttendanceWorkspace`, eliminating the initial worked-time text mismatch while preserving the post-hydration 30-second refresh. Verified with `pnpm type-check`, `pnpm lint`, and `pnpm build`.

Still open:
- Reconcile the six recent Attendance migrations in Supabase migration history. Local DB is not running at `127.0.0.1:54322`; linked migration-history reads time out to `aws-1-ap-northeast-1.pooler.supabase.com:5432`; linked `supabase_migrations.schema_migrations` currently reports `0` rows for `20260710040835`, `20260710055131`, `20260712000100`, `20260712035222`, `20260712044527`, and `20260712045429`.
- `pnpm db:types` passed, but the linked remote schema is behind local pending migrations; `src/types/supabase.ts` was locally reconciled afterward.
- Event-only/noop scan paths still need retry/concurrency QA.
- Manual clock-out, launch recovery, ignore-scan, rule updates, archive-test-data, and future rebuild/manual-attendance actions still need transactional RPC coverage.
- Complete account claim/OTP/rate limits, canonical scan host redirect, rotating branch challenge, scheduled reconciliation, full diagnostic modal, authenticated CRM/Owner QA, and real-phone/device-cookie QA.

---

ATTENDANCE-TODAY-ALIGNMENT-RESET-001 is implemented and locally verified.

- Attendance QR now resolves branch time, schedule/overrides, and the selected shift before interpreting open attendance rows.
- `attendance-intent-engine.ts` now classifies open rows as matching current shift, stale prior row, or same-day conflict. Legacy generic `single`/missing shift rows can match only by schedule-window/actual-clock-in overlap.
- `scan-engine.ts` now clocks out only against the matching current-shift row. Stale/conflicting rows create or update Recovery exceptions and no longer drive the next scan.
- Closing-window scans with no matching current clock-in still become `likely_closing_scan_without_clock_in` Recovery items and do not create a check-in.
- Active service clock-out blocking remains in place for true current-shift clock-outs.
- Recovery's former Reset Staff Day path is now selected-record Attendance State Reset / Reset Next Scan State with required reason and void confirmation. It preserves raw `qr_scan_events`, resolves related open exceptions, and records an `attendance_corrections` audit row.
- Added migration `supabase/migrations/20260712000100_attendance_state_reset.sql` for the new `reset_attendance_state` correction action.
- Verification passed: `npx vitest run tests/lib/attendance/attendance-intent-engine.test.ts`, `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

Still open: apply/push the new Supabase migration from a working DB path. `pnpm db:doctor` and `pnpm db:status` still time out on linked migration-history port 5432 even after unrestricted retry; `db:status` reported `Remote schema changed: no` before exit. Authenticated CRM/Owner browser QA and real QR phone scans remain pending.

---

## Current Task - 2026-07-11

CRM-PERFORMANCE-OPTIMIZATION-001 is complete and locally verified.

- Performance docs were added at `docs/performance/crm-performance-baseline.md` and `docs/performance/crm-performance-optimization-report.md`.
- The pass stayed inside frozen UI guardrails: no route, schema, RLS, server-action contract, booking lifecycle, payment, dispatch guard, cache, or visible UI behavior changes.
- Today Work Queue now memoizes the summary pass and visible row filtering/counts.
- Bookings Workspace now lazily derives the initial tab and memoizes workflow tab counts plus visible rows.
- Dispatch Live Map now passes a stable marker-selection callback to `MapCanvas`, avoiding map-effect reruns on selected-booking-only state changes.
- Verification: `pnpm type-check`, `pnpm lint`, `pnpm test -- --run --testTimeout=10000`, and `pnpm build` all pass.

Still open: Bookings remains NOT CERTIFIED until authenticated browser interaction QA is completed. Bundle splitting, query column narrowing, and database/index work should wait for a separately certified performance phase.

---

## Current Task - 2026-07-10

CRM-BOOKING-FOLLOWUP-STABILIZATION-001 is implemented and locally verified.

- CRM Today ETA refresh no longer passes `refreshEtaAction` through `page -> shell -> dashboard -> work queue panel`; the button imports/calls `refreshHomeServiceEtaAction` directly from the server-action module.
- Booking Follow-up cancel/no-answer/reschedule/confirm-later paths now save through CRM server actions with friendly RLS-safe UI errors and branch-checked service-role audit writes.
- Manager status updates use the admin client after session/branch checks and annotate the latest trigger-created `booking_events` row, avoiding the authenticated `booking_events` INSERT RLS failure.
- Change Staff uses the assignment assistant, re-scores the chosen therapist before save, blocks unavailable candidates, preserves the appointment time, writes assignment metadata, inserts a booking audit row, and notifies newly assigned staff.
- Reschedule has a real CRM modal and `rescheduleBookingAction`; it moves only date/time, validates current therapist and room availability, stores reschedule metadata/history, inserts a same-status audit row, and notifies the assigned therapist.
- Assignment recommendation conflicts now include booking ids and exclude the edited booking from conflict scoring; Home Service ineligible therapists and overlaps are unavailable.
- Verification: `pnpm type-check`, `pnpm lint`, `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts`, and `pnpm build` all pass.

Still open: authenticated CRM browser QA for `/crm/today` ETA refresh and `/crm/bookings` follow-up cancel/reschedule/change-staff flows against live branch data.

---

## Previous Task - 2026-07-10

ATTENDANCE-RECOVERY-RULES-001 is implemented and locally verified.

- Attendance keeps the internal tab key `exceptions`, but the visible tab is now Recovery.
- Added `src/lib/attendance/attendance-intent-engine.ts` and tests. The QR scan path now classifies schedule-aware intents before inserting check-ins.
- First scans in clock-out/closing windows with no active check-in now write a raw `qr_scan_events` row with outcome `exception`, create an attendance exception with reason `likely_closing_scan_without_clock_in`, and return a Recovery message instead of creating a normal clock-in.
- Added Recovery Center UI with Today Recovery, Staff Records, Rules, and Audit Log views.
- Added correction/rules service and server actions for launch recovery, manual clock-out, staff-day reset, reviewed scans, and rule updates.
- Added migration `supabase/migrations/20260710040835_attendance_recovery_rules.sql` for rule columns and correction audit fields.
- Verification: `npx vitest run tests/lib/attendance/attendance-intent-engine.test.ts`, `npx vitest run tests/lib/attendance`, `npx tsc --noEmit`, targeted `npx eslint`, `pnpm build`, and `git diff --check` all pass.

Still open: apply/push the new Supabase migration, then run authenticated CRM browser QA for Recovery Rules and Apply Recovery flows against live branch data.

---

## Previous Task - 2026-07-09

SCHEDULE-CONFLICT-RESOLUTION-CENTER-001 is implemented and locally verified.

- The new Schedule Conflict Center impact model is compiling cleanly.
- Removed the unused dialog severity-count memo and stale `coverage` tab typing.
- Updated the legacy summary-list helper to use impact groups instead of retired categories.
- Added explicit resolution-panel `ReactNode` / `LucideIcon` typing.
- Dialog tests now cover the reasoned accept-exception flow, accepted-tab transition, and no direct action routing for exception acceptance.
- Verification: `pnpm type-check`, `pnpm lint`, focused schedule tests, booking/availability safety tests, and `pnpm build` all pass.

Still open: authenticated CRM browser QA against live branch data is recommended for final visual/operator confirmation.

---

## Previous Task - 2026-07-09

AGENT-COACH-IDLE-LOOP-001 is implemented and locally verified.

- Fixed the runtime `Maximum update depth exceeded` error reported at `src/components/agent/agent-context-provider.tsx:53`.
- The Agent Coach idle listener no longer calls `setIsIdle(false)` for every activity/scroll event while already active.
- Idle state now has a ref-backed guard plus a timeout ref, so only real `false -> true` and `true -> false` changes update React state.
- Coach context, chat bubble, inline tips, and the 45-second idle behavior were preserved.
- Verification: `pnpm test --run tests/components/agent/agent-context-provider.test.tsx`, `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass.

---

## Previous Task - 2026-07-09

SCHEDULE-CONFLICT-CENTER-001 is implemented and locally verified.

- The independent right-rail `Conflict Details` card has been removed from the Schedule page layout.
- Coverage Overview is now the only conflict entry point: it shows All clear / warning / critical states and opens the `Schedule Conflict Center` via `Review Issues`.
- `Schedule Conflict Center` is a centered wide modal on desktop and a full-height sheet on small screens, with internal scrolling so large conflict lists no longer increase page height.
- Modal tabs filter All, Critical, Staff, Rooms, Coverage, Travel, Blocked Time, and Schedule conflicts.
- The modal includes a grouped category summary column, compact issue cards with human-friendly conflict titles, and an in-modal action preview panel.
- Existing `LiveScheduleConflict` detection, conflict counts, timeline indicators, staff-row indicators, SWR refresh, and `daily-timeline-conflict-actions.ts` routing were preserved.
- Attendance/check-in remains live status only and is not treated as a schedule conflict by itself. Public booking, CRM booking availability, QR attendance, and schedule setup write flows were not changed.
- Verification: focused schedule conflict/modal tests, relevant booking/availability safety tests, `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass.

Still open: authenticated CRM browser QA against live branch data is recommended for final visual/operator confirmation.

---

## Previous Task - 2026-07-09

SCHEDULE-CONFLICT-CLARITY-001 is implemented and locally verified.

- The old Daily Timeline `Conflicts` count was a count of `DailyTimelineAlert` resource/staff conflict alerts in `src/components/features/schedule/tabs/daily-timeline-coverage-card.tsx`.
- CRM Schedule now carries scheduling rules through the page/API/SWR payload and builds one central `LiveScheduleConflict` list for the workspace and Daily Timeline.
- The Coverage Overview count uses that central conflict list and can open the new `Conflict Details` panel.
- The details panel shows plain-language cards with severity, who/what/time/resource context, rule/fix copy, why it matters, and safe quick actions.
- Timeline rows/bookings now show warning/critical conflict indicators for affected staff/bookings.
- Safe quick actions select affected staff/bookings or open existing setup/full-schedule/availability flows; they do not perform direct conflict-resolution writes.
- Attendance/check-in remains live status only and is not treated as a schedule conflict by itself.
- Public/online booking, CRM booking availability, QR attendance, and schedule setup behavior were preserved.
- Verification: `pnpm type-check`, `pnpm lint`, `pnpm build`, focused schedule conflict/UI tests, and relevant booking/availability safety tests all pass.

Still open: authenticated CRM browser QA against live branch data is recommended after deployment or on a seeded local session.

---

## Previous Task - 2026-07-09

BRANCH-LOCATION-HOME-SERVICE-ORIGIN-001 is implemented and locally verified.

- Branch editing is at `/owner/branches/[branchId]`; the branch detail form now uses the shared Google Places autocomplete for `Branch service address`.
- `public.branches` already had `address`, `maps_embed_url`, `latitude`, and `longitude`; migration `20260709114038_branch_location_settings.sql` adds `place_id`, `city`, `barangay`, and `location_metadata`.
- Selecting a branch address stores formatted address, place id, latitude, longitude, derived city/barangay, map URL, and address components.
- The branch editor shows saved origin coordinates and warns when coordinates are missing.
- `updateBranchAction` persists the new origin fields and revalidates `/owner/branches/[branchId]`.
- CRM Home Service distance already used branch latitude/longitude as origin; its missing-origin message now tells staff to update the selected branch service address.
- Public booking wizard behavior was not changed.
- Verification: focused branch-location/distance tests, `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass.

Next steps: apply pending Supabase migrations, configure `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, and run authenticated owner branch-detail QA plus CRM Home Service quote QA with real Google Places selection.

---

## Previous Task - 2026-07-09

BOOKING-ATTENDANCE-BRANCH-SAFETY-001 is implemented, live DB verified, and locally built.

## Latest Booking / Attendance Branch Safety Checkpoint

- Safe diagnostics were run first against branches, attendance QR points, recent wrong-branch scan events, staff/device branch relationships, staff schedules, and today check-ins.
- Current live attendance QR data has one Main Spa attendance QR (`att_TfTw_tTF9HzJoyPuVloxwKsF`). Recent wrong-branch rows showed QR/event branch as Main and involved staff records currently assigned to Living SM; no active stale `staff_devices.branch_id` mismatches were present before the migration.
- Booking scheduled availability remains the source for future, phone, and home-service bookings.
- Same-day walk-in auto-assignment now prefers checked-in eligible therapists. If none are checked in, it falls back to scheduled availability and returns the warning: `No staff has checked in yet. Showing scheduled availability. Confirm staff presence before starting service.`
- Recommendation scoring now carries `bookingMode` from booking metadata and applies attendance scoring only to walk-ins happening today.
- QR returning scans now validate current staff branch against the scanned QR branch and repair stale device branch ids when the current staff branch matches the scanned QR branch.
- QR first-scan registration now checks authenticated staff/device ownership before branch validation and repairs stale existing-device branch ids when safe.
- Added migration `supabase/migrations/20260709054954_attendance_device_branch_sync.sql`. `pnpm db:push` and direct `supabase db push` timed out to the Supabase Postgres pooler before SQL execution, so the migration was applied via linked `supabase db query --file` and recorded in `supabase_migrations.schema_migrations`.
- Live DB verification found migration row `20260709054954`, trigger `trg_staff_branch_sync_devices`, and `0` active device/staff branch mismatches.

## Latest Verification

- `pnpm test --run tests/lib/attendance/branch-validation.test.ts tests/lib/assignments/recommendation-engine.test.ts`: PASS, 8 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 106 routes.

## Still Open

- If Main QR scanners are expected to accept the staff currently stored under Living SM, update those staff branch assignments or add an explicit cross-branch membership model; the code correctly blocks true branch mismatches.
- `pnpm db:push` remains unreliable from this environment even though linked `db query` works.
- Rotate the previously exposed Supabase DB password outside this repo/session if it has not already been rotated.

---

## Current Task - 2026-07-04

ATTENDANCE-FIRST-SCAN-LOGIN-008 is implemented, locally built, and verified against the live Supabase attendance tables.

## Latest Mobile Scan Flow Checkpoint

- Confirmed `/scan/[publicCode]/page.tsx` renders `PublicScanProcessor` and passes the async App Router `publicCode` param into the public scan action.
- Confirmed `PublicScanProcessor` is client-side, starts at `recognizing`, schedules `processing`, invokes the scan after mount, catches failures, and now routes recoverable missing-device results into an in-flow staff sign-in form instead of a final dead-end result.
- Added `src/app/scan/[publicCode]/loading.tsx` so the route shows the same recognizing shell while the page itself is resolving.
- Kept `src/lib/attendance/scan-engine.ts` as the authoritative backend path for QR lookup, trusted-device cookie checks, branch validation, duplicate protection, event logging, check-in insert, and check-out update.
- Extended public scan result metadata with optional `reasonCode`, `severity`, and `securityNote` so mobile blocked/error/recovery states can render cleanly without changing existing consumers.
- Added user-safe server action fallbacks for scan, activation, and recovery action failures.
- Wired public scan/recovery writes to the existing `revalidateAttendanceSurfaces()` helper, covering `/crm/attendance`, `/crm/availability`, `/crm/today`, and `/staff-portal`.
- Active-service clock-out blocks now pass the existing service countdown data back to the public result UI when available.
- Added the finished first-scan sign-in continuation: email/password auth succeeds through the Supabase server client, the authenticated user's own active `staff.auth_user_id` row is checked against the scanned attendance QR branch, a hashed `staff_devices` credential is inserted with the existing `first_scan_activation` registration source, the `cradle_attendance_device` HttpOnly cookie is set, and the browser reloads the scan URL so the next request carries the cookie.
- Public scan reads now use `POST /api/attendance/public-scan`, which reads `cradle_attendance_device` / legacy `cradle_device` from `NextRequest.cookies` and calls the existing scan engine. This avoids relying on a Server Action to read the newly persisted device cookie.
- Fixed the `staff_devices -> staff` Supabase join ambiguity by using `staff:staff!staff_devices_staff_id_fkey(...)`; without this, valid cookies hashed to active rows but `resolveDevice()` silently received an errored/null result and treated phones as unknown.
- Fixed the scan-effect dependency bug that could strand the first page on `Processing scan...` after the animation updated state.
- Preserved front-desk recovery links and `/scan/activate/[token]`; recovery remains an admin fallback and does not clock attendance in/out.

## Latest Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 106 routes.
- Local dev server is running on port `3000` with PID `31160` from `pnpm exec next dev -H 0.0.0.0`.
- Browser/MCP proof on local dev and live Supabase tables: first unregistered scan rendered the staff sign-in form; registration created active device `9395ae4f-65c1-4005-b491-19309e3a4b26`; a cookie-backed scan wrote a `clock_in` event with the same `device_id`; the next UI scan skipped login and rendered `Already recorded`.
- Verified cookie shape in browser context: `cradle_attendance_device`, HttpOnly, path `/`, `SameSite=Lax`, `secure=false` on localhost.

## Still Open

- Physical phone QA on production links is still recommended after deploy, especially on iOS/Android browser cookie behavior, revoked/wrong-branch devices, and recovery links.
- For local phone testing, current LAN IP is `192.168.137.149`; start dev with `pnpm dev -- -H 0.0.0.0` and open `http://192.168.137.149:3000/scan/<publicCode>` from the phone on the same network.
- Existing untracked local artifacts are still present and intentionally not removed: `.attendance-scan-backups/` and `tmp-attendance-device-registry-verify.sql`.

---

## Current Task - 2026-07-03

ATTENDANCE-DEVICE-REGISTRY-005 is locally complete and live DB verified.

## Latest Attendance Device Registry Checkpoint

- Added and applied `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql`.
- Live SQL verification returned `ok` for the migration-history row, all new `staff_devices` / `device_activation_tokens` columns, `public.consume_attendance_device_recovery`, and the `service_role` execute grant.
- Linked migration-history SQL also found earlier local versions `20260703130922`, `20260703144603`, and `20260703145113` present remotely.
- Added typed backend helpers for registry data, recovery link generation, rename, revoke, pending-link revocation, token preview, and recovery consumption.
- Replaced the Attendance Devices tab UI with registry filters, table, pending recovery links, selected-device panel, recovery-link dialog, rename dialog, and revoke dialog.
- `/scan/activate/[token]` now renders the recovery confirmation screen and does not consume recovery tokens until staff taps the restore button.
- `src/app/scan/actions.ts` writes the new `cradle_attendance_device` cookie at `/` and still reads legacy `cradle_device` for compatibility.
- Recovery consumption does not clock staff in/out or start service sessions; it creates the trusted device and writes an activation audit row only.

## Latest Verification

- `pnpm db:types`: PASS.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm vitest run tests/lib/attendance/device-recovery.test.ts`: PASS, 3 tests.
- `pnpm test`: PASS, 67 files / 595 tests.
- `pnpm build`: PASS, 105 routes.
- `git diff --check`: PASS, line-ending notices only.

## Still Open

- Authenticated browser QA for `/crm/attendance?tab=devices`, the recovery dialog copy flow, and a real staff phone recovery scan.
- `pnpm db:status` and `pnpm db:push` still time out on the Supabase port `5432` migration-history path even though live schema is verified.
- Rotate the pasted Supabase DB password and update only git-ignored local/deployment secrets.
- Manually remove `tmp-attendance-device-registry-verify.sql` if it still appears; sandbox deletion was denied and elevated delete was blocked by environment usage limits.

---

## Current Task - 2026-07-03

DATABASE-CONNECTION-STABILIZATION-001 is in progress. The secure reusable Supabase tooling layer and runbook are in place, but live remote success still requires rotated local database credentials and/or working Supabase CLI auth.

## Latest Database Tooling Checkpoint

- Added project-local wrappers under `scripts/database/`:
  - `db-doctor.mjs`
  - `db-status.mjs`
  - `db-verify.mjs`
  - `db-types.mjs`
  - `db-link.mjs`
  - `db-push.mjs`
  - `db-migration-new.mjs`
  - `_shared.mjs`
- Updated `package.json` database scripts to call these wrappers.
- Updated `.env.example` with placeholders only; `.env.local` and `.env.database.local` remain git-ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md`.
- Confirmed direct project-local Supabase CLI shim works: `.\node_modules\.bin\supabase.CMD --version` -> `2.95.6`.
- Confirmed `pnpm exec supabase --version` is unreliable in this managed shell, returning command-not-found even though the local shim exists.
- Confirmed no active `supabase` or `postgres` process was running during audit.
- Confirmed `psql` is not installed, so the emergency pooler transaction path cannot run here yet.

## Database Tooling Still Open

- Rotate the Supabase database password in the Supabase dashboard and update only git-ignored local/deployment secrets.
- Put rotated values in `.env.local` or `.env.database.local`:
  - `SUPABASE_PROJECT_REF`
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_DB_POOLER_URL`
- Re-run:
  - `pnpm db:doctor`
  - `pnpm db:status`
  - `pnpm db:verify`
  - `pnpm db:push`
  - `pnpm db:types`
- Current verification results:
  - `pnpm db:doctor`: starts successfully but exits nonzero due unconfirmed DB password rotation, missing `SUPABASE_DB_POOLER_URL`, and linked migration-history timeout.
  - `pnpm db:status`: local migration count 83; remote migration history read times out; remote schema changed no.
  - `pnpm db:verify`: linked SQL probe PASS and critical table checks PASS; pooler fallback WARNING because env is missing.
  - `pnpm db:push -- --dry-run`: remote schema changed no; remote migration connection timed out.
  - `pnpm db:types`: not run until migration push/history is stable.
- Inspect and reconcile migration-history drift before applying pending migrations. Known recent version requiring inspection: `20260703022600`.
- Do not apply emergency direct SQL without `psql` or another explicitly approved, documented SQL path.

---

## Previous Task - 2026-07-03

ATTENDANCE-FULL-INTEGRATION-002 is partially complete. The feed/deep-link slice is implemented and verified; broader trusted-device first-scan and staff-history work remains.

## Latest Attendance Feed Checkpoint

- CRM Work Queue (`/crm/today`) now renders `AttendanceScanFeedCard` above Fast Actions.
- Owner Overview (`/owner`) renders the same card; `/owner/attendance` reuses the existing `AttendanceWorkspace` for the selected branch so there is no duplicate Attendance module.
- Feed data comes from `src/lib/attendance/recent-scans.ts`, using successful `qr_scan_events` clock-in/out rows plus the explicit `qr_scan_events_checkin_id_fkey` join to `staff_shift_checkins`.
- `/api/attendance/recent-scans` provides authenticated no-store JSON for SWR refresh.
- `useAttendanceScanFeed` subscribes to Supabase Realtime inserts on `qr_scan_events` and refreshes the feed when successful attendance clock-in/out scans arrive.
- Records deep links now work with `/crm/attendance?tab=records&staffId=<id>&date=<yyyy-mm-dd>`; invalid staff/date/branch params are rejected server-side against branch-scoped Attendance data.
- Owner attendance tab changes stay under `/owner/attendance` and preserve the selected branch id.
- `AttendanceRecordsTab` now has date, branch, staff, status, and search filters; linked rows are highlighted and include a staff profile link.
- Focused tests live at `tests/lib/attendance/scan-feed.test.ts` and `tests/lib/attendance/tabs.test.ts`.

## Latest Verification

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/scan-feed.test.ts tests/lib/attendance/tabs.test.ts`: PASS, 2 files / 9 tests
- `npm run lint`: PASS
- `npm run build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only

## Still Open

- Authenticated browser QA for Work Queue feed, Owner feed, API refresh, realtime refresh, and Records deep links.
- First-scan trusted-device sign-in/linking flow.
- Staff Portal My Attendance and staff profile attendance history.
- `pnpm db:push`, `pnpm db:types`, Supabase migration-history reconciliation, and database password rotation before deployment closure.

---

## Previous Current Task - 2026-07-02

ATTENDANCE-REFIT-005 - Complete locally. The CRM Attendance workspace has been refit into the requested compact, instant-tab operational UI while preserving the existing Attendance QR database, public scan routes, device activation, service-session engine, and Supabase security model. Authenticated CRM/browser QA remains pending.

## Latest Attendance Refit Checkpoint

- `/crm/attendance` remains the single protected Attendance route.
- `AttendanceWorkspace` is a client-owned shell with local state for tab, selected QR point, QR format, activation link, notices, and locally updated workspace data.
- Tab switching uses `window.history.replaceState()` through `src/lib/attendance/tabs.ts`; routine tab changes no longer use router navigation, refreshes, route links, or redirects.
- All tab panels stay mounted so filters, selected QR/format, dialogs, and activation links survive tab switches.
- KPI-card rows were removed from Attendance.
- Overview now centers live staff status, recent scan activity, active service sessions, exceptions requiring attention, and compact quick actions.
- Records, Sessions, Devices, Exceptions, and Reports are compact operational workspaces with filters, tables, dialogs, and preserved backend action paths.
- QR Codes now matches the approved direction: compact selectable QR list on the left, one branded preview on the right, format selector, download PNG/SVG, print, copy scan link, QR information, generate missing, generate attendance QR, and deactivate QR.
- Attendance server actions now return typed `AttendanceActionResult` payloads instead of redirecting to status query params; this removes the `NEXT_REDIRECT` symptom from routine mutations.
- CRM Attendance sidebar icon is now `ClipboardCheck`, which exists in the sidebar icon map.
- Added pure helper coverage for tab parsing, QR public URL/base URL guards, QR print SVG layouts, and export filenames.

## Previous Attendance QR / Database State

- Migration was applied to the linked Supabase project with `supabase db query --linked --file supabase\migrations\20260702075213_attendance_qr_system.sql`, then rerun after grant tightening.
- Live verification confirmed all seven new tables, new check-in/booking columns, the RPC, authenticated SELECT-only grants on readable attendance tables, no authenticated grant on `device_activation_tokens`, and SELECT-only authenticated RLS policies.
- `pg_cron` is not installed on the linked project, so the optional cron block did not schedule an automatic job.
- Because the migration was applied via `db query --file`, Supabase migration-history tracking may not be reconciled. Do not claim `db push` history success without checking.

## Validation

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/tabs.test.ts tests/lib/attendance/qr-url.test.ts tests/lib/attendance/qr-print-layout.test.ts tests/lib/attendance/qr-filenames.test.ts`: PASS, 4 files / 14 tests.
- `pnpm lint`: PASS with 0 warnings after final cleanup.
- `pnpm build`: PASS, 104 app routes.
- `pnpm test`: PASS outside sandbox; 60 files / 564 tests.
- `git diff --check`: PASS, line-ending notices only.
- Browser smoke via `agent-browser`: existing local server redirects unauthenticated `/crm/attendance` to `/login`; login page renders content and no Next/Vite overlay is present.

## Known Caveats

- Authenticated CRM/browser QA is still needed for `/crm/attendance` tabs and actions, device activation, attendance clock-in/out scans, room/resource session starts, countdown reopen, and blocked/revoked/wrong-branch duplicate-scan flows.
- `npm run db:types` is stale for the installed Supabase CLI because it uses removed `--project-ref`.
- Fresh linked type generation exposed unrelated live schema drift, so `src/types/supabase.ts` was restored from baseline and manually augmented for attendance.
- Two zero-byte `_tmp_14412_*` files remain in the repo root because scoped `Remove-Item -LiteralPath` returned Access denied.
- Follow-up FK fix: `qr_points_branch_id_fkey` was caused by dev bypass using the zero UUID branch. `src/lib/dev-bypass-server.ts` now resolves a real active branch; Attendance actions prefer real staff branch context first and validate branch existence before QR/settings inserts.

## Attendance Files To Inspect First

- `supabase/migrations/20260702075213_attendance_qr_system.sql`
- `src/app/(dashboard)/crm/attendance/page.tsx`
- `src/app/(dashboard)/crm/attendance/actions.ts`
- `src/app/scan/[publicCode]/page.tsx`
- `src/app/scan/activate/[token]/page.tsx`
- `src/app/scan/actions.ts`
- `src/components/features/attendance/attendance-workspace.tsx`
- `src/components/features/attendance/attendance-header.tsx`
- `src/components/features/attendance/attendance-tabs.tsx`
- `src/components/features/attendance/overview/*`
- `src/components/features/attendance/records/attendance-records-tab.tsx`
- `src/components/features/attendance/sessions/service-sessions-tab.tsx`
- `src/components/features/attendance/devices/registered-devices-tab.tsx`
- `src/components/features/attendance/exceptions/attendance-exceptions-tab.tsx`
- `src/components/features/attendance/reports/attendance-reports-tab.tsx`
- `src/components/features/attendance/qr-codes/*`
- `src/components/features/attendance/public-scan-processor.tsx`
- `src/lib/attendance/*`
- `src/types/supabase.ts`

## Next Attendance Steps

1. Run authenticated browser QA for the CRM Attendance workspace tabs, filters, actions, and QR preview/export controls.
2. Create a device activation link, activate a test device, then scan attendance and room/resource QR codes from that device.
3. Verify blocked flows: unknown device, revoked device, wrong branch, duplicate scan, and active-service clock-out block.
4. Decide whether to install/enable `pg_cron` or schedule `complete_due_service_sessions` externally.
5. Fix the stale `db:types` script separately from this feature.
6. Reconcile Supabase migration history if the team wants `db push` to know this migration was applied.
7. Continue broader CRM blocker cleanup only after this attendance flow has been click-tested end to end.

---

# Previous Handoff - CRM Schedule

## Current Task

CRM-SCHEDULE-WORKSPACE-COMPLETION-2026-07-01 - active CRM Schedule workspace is locally complete; authenticated CRM Schedule QA remains pending.

## Latest User Intent

The user explicitly asked to keep progress logged so another AI agent can resume if Codex credit runs out.

The focused stabilization prompt is the operational guardrail: production-safe small checkpoints, no broad rebuilds, preserve working behavior, and do not claim CRM workflows work until UI actions are traced through server actions/API, auth, Supabase/RLS, constraints, invalidation, and feedback.

## What Was Done Most Recently

- Added explicit staff selection shared between Daily Timeline and Full Schedule; Schedule no longer silently falls back to the first visible staff row.
- Updated the Selected Staff card no-selection state and added Edit Profile, Edit Capabilities, and View Full Schedule actions.
- Reused existing modal/sheet surfaces instead of rebuilding them:
  - shared administrative booking modal
  - check availability modal
  - staff profile modal
  - staff service-capabilities sheet
  - staff full schedule calendar modal
  - availability/block-time editor
- Added in-place Edit Capabilities from both Schedule views through `StaffServiceEditorSheet` and `updateStaffServicesFromCrmAction`.
- Added timeline lane assignment in `src/lib/utils/schedule-timeline.ts`; overlapping booking blocks now render in separate vertical lanes in Daily Timeline and Full Schedule.
- Added a Schedule header view toggle for `Daily Timeline` and `Full Schedule + Live Bookings`, driven by the `view` query param.
- Added the Full Schedule + Live Bookings master-detail view with staff list, Day/Week mode, layer toggles, shifts, live bookings, blocks, overrides, no-shift states, and booking conflict flags.
- Full Schedule booking clicks open the in-Schedule booking detail panel using the real booking id.
- Audited Schedule/staff-service permissions and existing migrations; no new migration was added. Relevant existing migrations:
  - `supabase/migrations/20260529000002_crm_csr_schedule_rls.sql`
  - `supabase/migrations/20260529000003_crm_csr_staff_update_rls.sql`
  - `supabase/migrations/20260617141348_crm_staff_service_capabilities_rpc.sql`

## Previous Checkpoint

- Added shared quick-booking option loaders and a customer prefill server action.
- Mounted the shared administrative booking modal provider in the CRM layout.
- Extended `QuickBookingForm` for modal use while preserving `/crm/bookings/new` as a direct route.
- Converted major internal CRM New Booking triggers to modal buttons across Bookings, Today/Work Queue, Customers, Waitlist, Setup flow cards, direct customer profile, and Schedule header.
- Wired active CRM Schedule Daily Timeline actions:
  - Add Booking -> shared booking modal.
  - Check Availability -> in-context availability modal with slot-to-booking handoff.
  - Edit Staff Profile -> existing CRM staff profile modal with branch-authorized data load.
  - View Full Schedule -> existing staff schedule calendar modal.
  - Adjust Staff / Block Staff Time -> existing availability editor, including direct block-time tab/date prefill.
- Kept the existing booking server action; no duplicate booking action was introduced.

## Validation

- `npm run type-check`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings
- `npm run build`: PASS, 103 app routes
- `git diff --check`: PASS, line-ending notices only
- Browser smoke via `agent-browser` on existing `http://localhost:3000`: unauthenticated `/crm/schedule` redirects to `/login`, which loads with content and no Next.js error overlay.
- Browser console/errors on the unauthenticated smoke route: no page errors; only normal dev/HMR/Speed Insights messages.
- Authenticated CRM Schedule modal/browser QA: NOT RUN in this checkpoint because no authenticated CRM browser state was available.
- `npm run test`: not run for this checkpoint.

## Current Worktree

There are uncommitted changes. Do not revert user/previous-agent work.

Run:

```bash
git status --short --branch
```

Known changed areas:

- Schedule workspace completion:
  - `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
  - `src/components/features/schedule/workspace/schedule-workspace-header.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-selection-card.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
  - `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx`
  - `src/lib/utils/schedule-timeline.ts`
  - `src/lib/actions/crm-staff-services.ts`
- `src/lib/queries/crm-context.ts`
- `src/components/features/dashboard/nav-config.ts`
- `src/components/features/dashboard/sidebar.tsx`
- `src/components/features/workspace/workspace-prefetch-config.ts`
- `src/app/(dashboard)/crm/today/page.tsx`
- `src/app/(dashboard)/crm/bookings/page.tsx`
- `src/app/(dashboard)/crm/control/page.tsx`
- `src/app/(dashboard)/crm/live-operations/page.tsx`
- CRM setup/staff/staff-availability route gating files
- Dashboard header/sidebar/nav/readiness/workspace-access files
- `.context/*`, `docs/*` handoff files
- `docs/FRONT_DESK_REFACTOR_PROGRESS.md`

## Important Direction Reconciliation

Checkpoint 1 reconciled the visible sidebar labels toward:

- `Work Queue`
- `Bookings`
- `Schedule`
- `Customers`
- `Home Service`
- collapsed `System Management`

However, System Management follows the current management-authorized route gates. The latest prompt's broader statement that ordinary CRM users may occasionally edit system tools still needs an explicit permission/page-gate review before exposing setup pages to all CRM/CSR roles.

## Next Logical Steps

1. Read `docs/FRONT_DESK_REFACTOR_PROGRESS.md` first.
2. Inspect current diffs before editing.
3. Do not restart the booking-modal, Schedule modal wiring, or Full Schedule view checkpoint; it has passing type-check, lint, build, and unauthenticated smoke verification.
4. Run an authenticated CRM browser pass if credentials/session are available:
   - `/crm/schedule` Daily Timeline selection and no-selection disabled actions.
   - Add Booking, Check Availability, Edit Staff Profile, Edit Capabilities, View Full Schedule, Adjust Staff, and Block Staff Time.
   - `Full Schedule + Live Bookings` Day/Week mode, layer toggles, staff selection, live booking detail panel, and conflict/lane rendering.
   - Confirm internal CRM triggers do not navigate to `/crm/bookings/new`.
5. Keep `/crm/bookings/new` alive as compatibility for direct links and agent fallback.
6. Continue remaining Work Queue / Today / Control Center simplification without deleting working routes.
7. Trace each additional CRM action end-to-end before claiming readiness.

---

## 2026-07-02 - ATTENDANCE-REFIT-005 Final Verification Continuation

### Completed

- Resolved all four lint warnings:
  - Removed unused `FALLBACK_IMAGE_URL` from `scripts/generate-service-image-assets.mjs`.
  - Replaced unused `generationPrompt` rest destructuring with explicit `appManifestEntry()` projection.
  - Preserved payroll mock `staffId` signatures and marked them intentionally unused with `void staffId`.
- Reran final checks with the project package manager:
  - `pnpm type-check`: PASS.
  - `pnpm lint`: PASS, 0 warnings.
  - `pnpm test`: PASS, 60 files / 564 tests.
  - `pnpm build`: PASS, 104 app routes.
- Started local dev server and attempted `/crm/attendance?tab=qr` browser QA.
- Confirmed the route redirects to `/login` at all requested widths: 1440, 1280, 1024, 768, and 375 px.
- Captured blocker screenshots:
  - `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-1440.png`
  - `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-1024.png`
  - `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-375.png`

### Still Blocked

- Authenticated QR visual QA cannot be completed without a valid Supabase CRM/front-desk browser session. `DEV_AUTH_BYPASS=true` does not bypass `src/proxy.ts`'s requirement for an authenticated user.
- Manual interaction checks are still pending: select row(s), format changes, search/filter, copy link, PNG/SVG/download/print/export, print selected, and deactivate confirmation.
- Phone-camera scans are still pending for one attendance PNG, one room SVG, and one print/PDF preview.
- QR identity preservation still needs authenticated browser confirmation before/after preview/export for QR point ID, public code, scan URL, and version.
- Local Supabase CLI may need a retry after a Windows file lock clears: `pnpm exec supabase --version` currently reports `The process cannot access the file because it is being used by another process.`

### Next Pickup

1. Log in with a CRM/front-desk account or provide explicit local test credentials.
2. Reopen `http://localhost:3000/crm/attendance?tab=qr`.
3. Rerun visual QA at 1440, 1280, 1024, 768, and 375 px.
4. Complete the requested interaction, export, phone-scan, and QR identity checks before marking Attendance QR fully complete.

## Handoff - ATTENDANCE-SCHEDULE-REPAIR-002

Done:
- CRM Schedule Daily Timeline now logs actionable branch/date/error diagnostics and returns a safe unavailable message.
- Daily schedule query now selects `schedule_overrides.shift_type`, propagates it into timed override labels, and fails loudly on staff metadata, blocked-times, and override query errors.
- Schedule workspace uses live SWR schedule data and explicit refresh tokens instead of router refresh for setup changes.
- Attendance QR insert mapping type regression is fixed.
- Focused schedule regression tests were added for missing override shift type and staff metadata failures.
- Live DB read verification through the Supabase pooler confirmed the schema column/check constraint and a successful `get_daily_schedule` response for the active SM branch/date.
- Local verification passed: `npx tsc --noEmit`, `npm run lint`, focused schedule tests, full `npx vitest run`, `npm run build`, and `git diff --check`.

Still blocked:
- `pnpm db:push` and `pnpm db:types` cannot complete until the local Supabase CLI/pnpm issue is repaired.
- Supabase migration history does not show `20260703022600` applied even though the live column exists.
- The pasted Supabase database password should be rotated before deploy.

Suggested next steps:
1. Repair pnpm/Supabase CLI build-script approval or reinstall the Supabase CLI binary cleanly.
2. Rerun `pnpm db:push` and `pnpm db:types`.
3. Rotate the Supabase database password and update environment variables.
4. Deploy after migration history/type generation is clean.

---

## Handoff - SCHEDULE-DATA-OPTIMIZATION-001

Done:
- Schedule resolution now returns explicit `resolved`, `day_off`, `missing`, or `conflict` status.
- Invalid overrides, overlapping windows, and day-off-plus-working group rules become conflict states with no operational windows.
- Individual schedule saves, CRM weekly availability saves, group rule saves, and group apply-to-staff now write complete matrices so stale shift rows are deactivated.
- Schedule Setup UI ordinary shift choices are mutually exclusive; Split Shift is explicit and required for multiple active windows.
- CRM availability, readiness, live schedule conflicts, and assignment recommendations consume the conflict-safe canonical schedule status.
- Verification passed: focused scheduling tests, `npm run type-check`, `npm run lint`, full `npx vitest run`, and `npm run build`.

Notes:
- The repository already had a large unrelated dirty Attendance/CRM worktree before this scheduling continuation. Those changes were preserved and not reverted.
- No new scheduling tables or migrations were added.

---

## Handoff - CRADLE-INDIVIDUAL-SCHEDULING-SIMPLIFICATION-005

Done:
- Manual/paper schedule importer, paper roster constants, importer action paths, and duplicate scheduling UI were removed.
- CRM Schedule now exposes only Daily Timeline and Schedule Setup; old CRM staff availability and availability pages redirect to the Schedule workspace.
- Runtime schedule resolver, queries, realtime subscriptions, booking availability, attendance, dispatch recommendations, readiness, and schedule conflict text no longer use group schedule fallback.
- Individual weekly schedule saves use ordered windows, operational staff filtering, exact returned-row verification, and minimal day-off markers.
- Supabase types were regenerated and app checks pass on the current tree.

Verified:
- `pnpm db:types`
- `pnpm type-check`
- `pnpm lint`
- `pnpm test --run` (88 files / 702 tests)
- `pnpm build` (108 routes)
- `git diff --check`

Still blocked:
- Production migration apply is not verified. `pnpm db:doctor` and `pnpm db:status` still time out while reading linked migration history through the pooler.
- `pnpm db:verify` can run linked SQL/table checks but exits nonzero because `psql` is missing for fallback.
- Linked generated types still show `branch_booking_rules` without pending distance-fee columns until migrations are applied.

Next pickup:
1. Apply `20260712165012_backend_stabilization_schedule_repair.sql` and `20260712190359_individual_schedule_runtime_only.sql` from a working Supabase migration-history connection.
2. Rerun `pnpm db:types`, `pnpm type-check`, `pnpm lint`, `pnpm test --run`, and `pnpm build`.
3. Run authenticated CRM browser QA for `/crm/schedule` Daily Timeline and Schedule Setup.

---

## Handoff - CRADLE-ADJUST-SCHEDULE-MODAL-003

Done:
- Added the reusable `src/components/features/schedule-adjustment` modal suite with staff identity strip, left adjustment navigation, Staff Shift Profile, weekly matrix, right Schedule Status/Preview/Impact rail, sticky validation footer, mobile weekday cards, and honest exceptions empty state.
- Replaced CRM Schedule Daily Timeline Quick Actions > Adjust Staff with `AdjustScheduleDialog` in Weekly Schedule mode.
- Added Adjust Schedule to the selected-staff card beside Edit Profile, Edit Capabilities, and View Full Schedule; it uses the same modal target/state/save/refresh behavior.
- Kept Daily Timeline visuals unchanged outside action wiring.
- Kept individual schedules authoritative and excluded all group schedule controls/runtime fallback language.
- Added ordered-window weekly save support through `updateCrmStaffWeeklyWindowScheduleAction`, `buildStaffWeeklyWindowScheduleRows`, and the pending schedule repair migration.

Verified:
- Focused tests: `pnpm test --run tests/lib/schedule/adjust-schedule-utils.test.ts tests/lib/schedule/staff-schedule-write.test.ts tests/lib/schedule/daily-timeline-selection-card.test.tsx tests/lib/schedule/adjust-schedule-dialog.test.tsx` (4 files / 21 tests).
- `pnpm type-check`
- `pnpm lint`
- `pnpm test --run` (91 files / 717 tests)
- `pnpm build` (Next.js 16.2.4, 108 routes)
- `git diff --check` (passes with CRLF warnings only)

Still open:
- Authenticated CRM browser QA/visual certification for the modal against live branch data.
- Production migration apply remains blocked by the existing Supabase migration-history connectivity issue.
- Authoritative affected-booking impact analysis is not yet wired into weekly save confirmation.
- Date-range overrides, expanded blocked-time reasons, override overnight persistence, and durable approved-exception records need separately approved schema/action work.
## Handoff - CRADLE-ATTENDANCE-DB-CONNECTION-AND-END-TO-END-DIAGNOSTICS-011

Done:
- Same-project database identity, live schema, RLS, grants, generated types,
  transaction RPC, recovery RPC, scan writes, Activity query, and Realtime were
  inspected and exercised.
- Live browser operations: blocked unknown-device audit, configured-secret
  recovery, clock-in, duplicate no-op, clock-out, valid early-leave exception.
- QA schedule restored to 09:00-18:00 and QA device revoked after validation.
- New migration `20260713120237` is applied and recorded.

Key operation IDs:
- `998ba4f6-9499-4c76-960b-5543d67cdd6e`: safe unknown-device failure audit.
- `971879ba-a130-4df2-991c-6b5030b59ea3`: successful atomic clock-in.
- `4b8e9251-cb03-4565-b459-5c406cd03b53`: pre-write `PGRST201` clock-out failure.
- `fbf2bebf-2a20-4c0a-b6b0-7e25218b86e4`: successful atomic clock-out plus
  early-leave exception.

Still open:
- Restore direct pooler TCP 5432 connectivity and reconcile old migration
  history before any broad `db push`.
- `psql` is absent; `db:verify` therefore returns warning exit 2 after all table
  probes pass.
- Investigate the separate process/operator that deleted the pre-existing
  Attendance operational dataset during this task window. `pg_stat_statements`
  proves the deletes, but does not retain actor/timestamp, and this checkout has
  no reset backup.

## Handoff - ONLINE-STAFF-PREFERENCE-EXCEPTIONS-001

Done:
- Public booking defaults/resets to Any available and never derives the form
  value from the recommended provider.
- Manual preferences are hard-validated for tenant/branch/provider/service
  eligibility, then soft-evaluated for schedule, leave/block, overlap, override,
  and full buffered duration.
- Soft exceptions preserve normal booking creation and selected `staff_id`, use
  metadata plus idempotent notification/task signals, and show safe customer
  confirmation wording.
- CRM Today, booking list/details, notifications, and work queue show amber
  review state with resolution actions wired to existing workflows.
- No database/RLS change.

Verified:
- Focused 7 files / 25 tests, full 108 files / 780 tests, type-check, lint,
  build, and diff check.
- Public browser flow confirmed default/recommendation/manual-preference state.

Still open:
- Run authenticated CRM browser QA for Today/list/details and Keep/Reassign/
  Reschedule/Mark-resolved clicks using a safe test booking. The local browser
  session redirects CRM routes to `/login`.

## Handoff - CRM-BOOKINGS-DESKTOP-REDESIGN-001

Done:
- CRM desktop Bookings uses the approved two-pane layout; selected-date rows,
  quick/exact filters, search, selection, pagination, legacy links, and the
  fixed command-pane structure are implemented.
- Existing lifecycle plans, mutations, operational modals, permissions,
  assignment recommendations, payment paths, note save, countdown, and
  auto-completion remain the action sources.
- Mobile and manager/owner booking workspaces continue to use the prior shared
  UI. No database migration or RLS policy changed.

Verified:
- Focused 3 files / 9 tests; full 111 files / 789 tests; type-check, lint,
  production build, and diff check all pass.

Still open:
- Run the manual CRM Bookings matrix in a safe authenticated browser session at
  desktop widths, including filter/search/pagination, row selection/close,
  pending/confirmed/checked-in/in-service/completed actions, and legacy URLs.
  The available in-app browser redirected `/crm/bookings` to `/login` and had no
  alternate authenticated browser session.

## Handoff - CRM-BOOKING-ACTIONS-COMPACT-001

Done:
- CRM desktop routine actions bypass Booking Follow-up: direct confirmation,
  `tel:` Call, existing Message copy, direct No Answer, and direct Confirm Later.
- Reschedule still opens `RescheduleBookingModal`; Cancel now uses a compact
  reason-required dialog and existing cancellation status/event/notification/
  permission/refresh behavior.
- The shared CRM booking loader validates and queries the real booking UUID with
  a base-only select, loads details separately, and distinguishes missing,
  wrong-branch, RLS/permission, load, final-state, and update failures.
- The desktop booking list is Time/Customer/Status only, has optional compact
  issue indicators, no horizontal table scroll, and an approximately 43/57
  list/detail split. Mobile remains unchanged.
- No database migration or RLS policy change was required.

Verified:
- Focused booking tests: 6 files / 27 tests.
- Full Vitest: 114 files / 807 tests.
- `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check` pass.

Still open:
- Authenticated live operator QA for direct mutation toasts/refresh and the
  focused cancel/reschedule dialogs. The only available in-app browser reached
  the running local app but redirected `/crm/bookings` to `/login` and had no
  authenticated CradleHub session or alternate browser.

## Handoff - ATTENDANCE-STAFF-SELF-SERVICE-001

Done:
- Autonomous first-scan phone registration is continuation-bound, retry-safe,
  policy-aware, and completes attendance in the same action/operation context.
- Staff Portal phone requests, CRM review, expiring same-phone activation,
  transactional replacements, signal dedupe/reconciliation, profile controls,
  CRM review UI, and the self-only Staff Attendance summary/history are local.
- Migration, explicit grants/RLS, generated types, and focused/full regression
  coverage are included without adding a second engine or device registry.

Verified:
- Focused 6 files / 14 tests; full 119 files / 819 tests; type-check, lint, and
  production build pass.

Still open:
- Apply and verify `20260714050554_attendance_staff_self_service.sql` after the
  linked Postgres pooler is reachable; then regenerate live schema types and run
  service-role RPC plus authenticated RLS probes.
- Run the physical/signed-in Method 1 and Method 2 matrix. The only available
  browser redirects protected routes to `/login`, so production/device
  certification must not be claimed yet.
## Handoff - ATTENDANCE-COMPLETE-SYSTEM-001 Phase 0

Done:
- Mapped current Attendance routes, engine entry points, schedule resolution,
  device paths, RPCs, Recovery, realtime, staff/CRM/report sources,
  notifications/tasks/payroll connections, limits, and timezone hardcoding.
- Recorded proven architectural gaps and the exact Phase 0 gate in
  `docs/attendance/PHASE_0_BASELINE_AND_ARCHITECTURE_MAP.md`.
- Focused baseline passes: 24 test files / 96 tests.
- Type-check, lint, production build, and diff check pass on the current tree.

Blocked:
- Linked migration-history access times out on Postgres port 5432. Deployed
  migrations, RLS, RPC grants, and scheduler state remain uncertified.
- Phase 1 must not begin until this gate is cleared; do not blind-push local
  migrations.

Next pickup:
1. Restore an approved authoritative linked SQL/migration-history path.
2. Verify live Attendance tables, functions/signatures, grants, policies,
   publications, extensions, and migration versions.
3. Rerun Phase 0 checks, mark the gate complete, then begin the authoritative
   daily Attendance model in Phase 1.
## Handoff - Attendance device-request schema-cache repair

Done:
- Applied the focused Staff Portal device-request migration to the linked
  project and reloaded PostgREST.
- Verified table, RLS, policies, grants, privileged RPC restrictions, and
  service-role REST access.
- Added `staff_device_registration_requests` to `pnpm db:verify`.
- Focused device/Staff Attendance tests pass: 3 files / 7 tests.

Still open:
- The SQL effects are live, but linked migration-history reads still time out;
  reconcile version `20260714050554` before a normal broad migration push.
- Physical same-phone staff/CRM request approval and activation QA remains
  required for full device certification.
## Handoff - ATTENDANCE-COMPLETE-SYSTEM-001 Phase 1

Done:
- Added the pure authoritative Attendance-day model and connected CRM/Owner and
  self-only Staff Portal consumers.
- Removed CRM Overview's first-36 truncation and record-existence schedule
  interpretation.
- Added focused ordinary/split/overnight/override/day-off/missing/conflict/
  later/late/presence/service/branch/timezone/review tests.
- Documented the model in the Attendance Phase 1 and Architecture documents.

Verified:
- 25 focused Attendance files / 112 tests.
- Full suite: 120 files / 835 tests.
- Type-check, lint, production build, and diff check pass.

Pending at this checkpoint:
- Run authenticated CRM and Staff Portal browser QA with safe accounts.
- Migration version `20260714050554` remains live-but-unreconciled in migration
  history; do not run a blind broad push.
