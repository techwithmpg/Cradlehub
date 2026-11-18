# CradleHub — Attendance Lifecycle Correction (2026-11-18)

- **Branch:** `fix/attendance-lifecycle-correction-20261118`
- **Base Web `main` SHA:** `ce3e31813e5472cd4bace6d523bb6d3e381eee40`
- **Release Classification:** `LOCAL/TEST` Verified Candidate Only — **Not merged, pushed, or activated in Production** (`lsrbwqhvzjfpiabeolkv`).

---

## 1. Root-Cause Audit (Production vs Web `main` vs Attendance V2)

All production findings below were gathered strictly via `BEGIN READ ONLY; ... ROLLBACK;` queries without mutating production data, Cron jobs, functions, or schema, and without exposing PII.

### A. Previous-Day Missed Clock-Outs Leak Into Today's Active Sessions (P0)
1. **Hardcoded `exception_state: "open"` on today's new check-in:**
   In `src/lib/attendance/scan-engine.ts`, `recover_stale_attendance_and_clock_in` previously passed `exception_state: "open"` inside `p_current_checkin` unconditionally (even when today's arrival had `late_minutes = 0` or was an authorized early arrival), and `public.recover_stale_attendance_and_clock_in` fell back to `'open'` when `exception_state` was omitted.
   - Read-only production inspection on `2026-11-18` confirmed active `checked_in` sessions opened on `2026-11-18` (including `13:38` on-time arrivals with `late_minutes: 0` against `14:00`) carrying `exception_state = 'open'`.
2. **Stale exception attached to `v_current_id` (`checkin_id`) instead of `p_stale_checkin_id`:**
   Production `public.recover_stale_attendance_and_clock_in` delegated `p_exception` to `public.commit_attendance_scan_transaction(..., p_checkin_id => v_current_id, p_exception => p_exception)`. Consequently, every recovered `stale_open_checkin` / `missed_checkout` row in `public.attendance_exceptions` wrote `checkin_id = v_current_id` (today's session) and `related_checkin_ids = [v_current_id]`, storing `p_stale_checkin_id` only inside `metadata.staleCheckinId` with `staleShiftDate = null`.
3. **Downstream UI/state propagation:**
   - `filterAttendanceExceptionsForBusinessDay` matched `exception.checkin_id` (`v_current_id`) against today's records.
   - `staff-portal/attendance.ts` passed unfiltered `attendance_exceptions` into `resolveAttendanceDayStaffStates`.
   - `buildAttendanceStaffDiagnostics` scanned all branch open exceptions (`data.exceptions`) rather than current-day/session exceptions, flipping clean active workers from `Working` to `Needs Review` (`working = false`).
   - `findExceptionRecord` fell back to open today check-ins when a prior `checkin_id` was outside the loaded slice.

### B. 60-Minute Early Clock-In Enforcement vs Approved 120-Minute One-Scan Policy (P0/P1)
- Web `main` (`ce3e3181`) already contains Attendance V2 (`20261116094630_attendance_v2_automation.sql` / `v2-policy.ts`), which enables the 120-minute arrival window (`creditedStartAt = greatest(checked_in_at, scheduled_start_at)`, one scan) **only when `attendance_v2_enabled()` is enabled**.
- Read-only production inspection confirmed:
  - `supabase_migrations.schema_migrations` latest recorded version is `20261104004559`; schema `attendance_v2_private` is not installed.
  - Trigger `staff_shift_checkins_qr_clock_in_window_guard` (`enforce_qr_clock_in_shift_window()`) is installed and rejects `checked_in_at < scheduled_start_at - INTERVAL '60 minutes'`.
  - `attendance_settings` on both active branches has `early_clock_in_allowed_minutes = 60` and `clock_in_window_before_shift_minutes = 60`.
  - Production `qr_scan_events` on `2026-11-17` and `2026-11-18` show blocked `outside_schedule_window` scans 83–102 minutes before shift start (e.g. `13:05` & `12:48` for `14:30–22:30`; `08:27` for `10:00–17:30`; `11:18` for `13:00–20:00`).
- Additionally, in `scan-engine.ts`, `blockedClockInIntent()` previously overwrote `missing_schedule`, `off_day_exception`, `schedule_state_unsupported`, and `likely_closing_scan_without_clock_in` with `outside_schedule_window` whenever a prior stale open check-in existed.

### C. Why Non-Closing Shifts Accumulate Unclosed & Never Receive Reminders
- Production `recalculate_attendance_clock_out_policy` only enables closing safety/reminders when `v_category = 'crm_front_desk' and lower(shift_type) = 'closing'`. All therapists, drivers, opening/single shifts, and recovery scans receive `clock_out_reminder_at = null`, `hard_cutoff_at = null`, and `provisional_clock_out_at = null`.
- Only 4 fixed nightly closing Cron jobs (`0 15`, `30 15`, `0 16`, `10 16` UTC) are active in production; the V2 due-work processor (`process_due_attendance_v2`) is not installed/scheduled. As a result, production has unclosed `checked_in` rows across `2026-11-07`, `11-08`, `11-09`, `11-11`, `11-13`, `11-15`, `11-16`, and `11-17`.
- Furthermore, Attendance V2 (`20261116094630`) on `main` triggered reminders at `+5m` every `5m` instead of the newly directed **+20 minutes after effective authorized shift end** and **+10 minutes after verified final home-service completion + required operational buffers**, and V2's midnight closure check (`p_processed_at >= v_midnight and p_processed_at >= v_end`) could close an overnight `17:00–01:30` shift immediately at `01:30` before the `+20m` reminder fired at `01:50`.

### D. Schedule-Source & Lateness Discrepancies (Diagnosed Without Mutating History)
- Across inspected high-lateness check-ins (`2026-11-16..18`, `late_minutes` 106–264), `schedule_overrides` had `0` rows; every check-in resolved via `schedule_source = 'weekly'` against a single active `staff_schedules` row for that `day_of_week`.
- Active weekly schedules in `staff_schedules` contain anomalies driving distorted lateness/shift behavior:
  - 35 active `12.5h` rows (`10:00–22:30`: 30 `staff`, 5 `driver`; plus `09:00–21:30`), 5 rows at `12.0h` (`09:00–21:00`), 2 rows at `11.5h` (`11:00–22:30`), and 5 `crm` rows at `10.5h` (`12:00–22:30`).
  - Typo/sub-4h row: `22:03:00–22:30:00` (`day_of_week=4`, `closing`, 27 minutes).
  - Non-quarter-hour odd minute entries: `14:33–22:30` (Sun), `14:03–22:30` (Wed), `14:00–18:09` (Sat), `14:30–22:33` (Sat).
  - Overnight split rows: `17:00:00–01:30:00` (`ends_next_day = true`, `window_order = 2`, `closing`, Wed–Fri).
- Historical record & schedule cleanup is intentionally separated into `supabase/operations/attendance-schedule-and-recovery-audit.sql` (manual review candidate only).

---

## 2. Corrections Implemented (On Isolated Branch Only)

1. **Stale Exception Attribution (`20261118163000_attendance_lifecycle_correction.sql` + TS/UI):**
   - `public.recover_stale_attendance_and_clock_in` defaults today's check-in `exception_state` to `'none'`, commits today's QR scan event on `v_current_id` with `p_exception => null`, and attributes `stale_open_checkin` / `missed_checkout` exclusively to `p_stale_checkin_id` (`checkin_id = p_stale_checkin_id`, `related_checkin_ids = [p_stale_checkin_id]`, `metadata.staleBusinessDate`, `metadata.staleShiftDate`, `recoveredByCurrentCheckinId`).
   - `scan-engine.ts` computes today's `needsCurrentClockInReview` independently from yesterday's recovery, populates `staleShiftDate` and `staleBusinessDate`, preserves `creditedStartAt` on early V2 arrival during stale recovery, and stops overwriting `missing_schedule` / `off_day_exception` with `outside_schedule_window`.
   - `filterAttendanceExceptionsForBusinessDay`, `resolveAttendanceDayStaffStates`, `buildAttendanceStaffDiagnostics`, `partitionStaffPortalExceptions` / `getPureAttendanceSnapshot` (with separate `priorShiftIssues` and non-blocking `AttendanceReadinessCard` / `StaffAttendanceHistory` isolation), `matchTodayReviewItemForStaffRow` in `CrmAttendanceWorkspace`, `getAttendanceWorkspaceData` (`exceptionRecords` / `exceptionScanEvents` hydration for `historyDays: 0`), `findExceptionRecord`, `AttendanceIssueModalRouter`, `AttendanceTodayView`, desktop + mobile `AttendanceReviewView`, `AttendanceIssueSummary`, and `AttendanceCorrectionModal` isolate prior-day stale exceptions from today's active session while hydrating and surfacing original prior shift dates and records cleanly.
2. **Automatic Reminders (+20m Shift End / +10m Final Home-Service) & Reusable Portal Clock-Out:**
   - Reconciled `v2-policy.ts`, `attendance_v2_private.resolve_reminder_schedule`, `guard_credit()`, `track_work()`, `process_due_attendance_v2()`, and `validate_attendance_v2_push()` to enforce:
     - **+20 minutes** after effective authorized shift end when no active/upcoming duty remains (`shift_end`).
     - **+10 minutes** after verified final home-service completion (`session_completed_at`/`completed_at`) + configured operational buffers (`home_service_wrap_up_buffer_minutes` / `driver_return_buffer_minutes`) when released with no subsequent assignment (`final_home_service`).
     - Instant reminder suppression + `generation`/`last_interval` reset inside `track_work()` and `process_due_attendance_v2()` when a new active or upcoming booking appears (so brief cancelled assignments re-emit cleanly), plus live pre-dispatch revalidation in `validate_attendance_v2_push()` and automatic cancellation on manual QR or `commit_attendance_portal_clock_out` clock-out.
     - Overnight & late-shift protection: both `scheduled_end_at >= v_midnight` overnight shifts and late day shifts whose `authorizedEndAt + delay_minutes >= v_midnight` defer provisional auto-close past branch `attendance_day_boundary` + the reminder grace window (and regular shifts also wait `delay_minutes + 40m` past `authorizedEndAt`) before provisional closure.
   - `safeAttendanceNoticeCopy` & V2 notifications retain CRM's manual **Send Clock-In Reminder** control and explain how staff can open **My Attendance** and tap **"Clock out"** when eligible (`commit_attendance_portal_clock_out`).
   - Reconciled `recalculate_attendance_clock_out_policy` and `commit_attendance_portal_clock_out` in `20261118163000_attendance_lifecycle_correction.sql` (plus `portalAvailabilityCopy` in `src/lib/staff-portal/attendance.ts`) so open `cash_sessions` custody blocks Staff Portal clock-out (`open_cash_session`) even when `attendance_staff_category_rules` has 0 rows or no active/upcoming bookings remain.
   - Updated `20261116094630_attendance_v2_automation.sql` to create `public.attendance_staff_reminder_checks` forward-only (`CREATE TABLE IF NOT EXISTS` with RLS/grants, without replaying historical migrations) and fixed the `Auto-closed at %s · Confirmation required` UTF-8 middot formatting; added an explicit `pg_net` / `net.http_post` preflight check to `supabase/operations/enable-attendance-v2.sql`.
   - Preserves original QR evidence, raw timestamps, `provisional_auto_closed_at`, `attendance_corrections`, and delivery logs; never treats service completion as physical clock-out or auto-finalizes unverified hours.

---

## 3. Release & Production Activation Checklist (Blocked Until Owner Sign-Off)

Before considering Production activation:
1. Review and merge via normal owner gate; back up Production schema, `pg_get_functiondef()` definitions, `staff_schedules`, and `attendance_exceptions`.
2. Apply migrations (`20261116094630_attendance_v2_automation.sql` + `20261118163000_attendance_lifecycle_correction.sql`) to STAGING/PRODUCTION only via sanctioned release path.
3. Run read-only queries in `supabase/operations/attendance-schedule-and-recovery-audit.sql` with branch managers to confirm schedule corrections (`22:03–22:30`, `10:00–22:30` 12.5h shifts, odd minutes, overnight windows) and optionally run the guarded exception link repair.
4. Enable `pg_net` extension (`net` schema), provision Vault secrets (`cradlehub_attendance_v2_endpoint`, `cradlehub_attendance_v2_cron_token`), configure/verify `CRON_SECRET` and `attendance_staff_category_rules` (including `driver_return_buffer_minutes` and `home_service_wrap_up_buffer_minutes`), confirm owner sign-off on `owns_closing = true` transition behavior, enable `CRADLEHUB_ATTENDANCE_V2_ENABLED=true`, and run `supabase/operations/enable-attendance-v2.sql`.
5. Run live end-to-end verification on a registered device against STAGING/PRODUCTION push subscriptions (`web_push_subscriptions` + VAPID) — local tests cannot exercise external Web Push endpoints.
