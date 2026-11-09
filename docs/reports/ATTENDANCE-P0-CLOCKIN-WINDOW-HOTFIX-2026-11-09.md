# P0 Web Attendance Hotfix — November 9, 2026

**Target:** `techwithmpg/Cradlehub` (WEB only)  
**Branch:** `fix/web-p0-attendance-clockin-window-20261109`  
**Base:** `038737dc470201f0fdd0ec1231506a8707b6d170` (accepted main at branch creation)  
**Stage:** emergency P0 attendance integrity; review branch only  
**Authorization:** owner requested hotfix after inspection of 2026-11-09 midnight attendance.

## Verified production incident — READ ONLY

On 2026-11-09 at 00:00:34 Asia/Manila, Lorraine Eslabra had a non-test QR clock-in for an Opening shift scheduled 09:00–21:30. The production `qr_scan_events` reason was `stale_checkin_recovered_and_clocked_in` and audit metadata included `currentScanIntent: ambiguous_scan`. The prior 2026-11-08 open record was system-auto-closed at 21:30 and the system created a new attendance row at midnight. Branch attendance day boundary is 06:00; live stored early-clock-in settings are 30 minutes, inconsistent with the explicitly approved one-hour policy. The 2026-11-03 through 2026-11-09 read-only screening found 59 candidate rows earlier than scheduled start by over one hour (38 stale-recovery, 21 ambiguous), not proof that every historic record is invalid.

**No live attendance records were modified in this investigation or patch.**

## Consumer / source-of-truth map

- Attendance QR scanner owner: `src/lib/attendance/scan-engine.ts`; server-only logic and service-role audit RPCs.
- Schedule resolution: `attendance-intent-engine.ts` and `resolve-staff-schedule.ts`, with authorized override/weekly schedule windows.
- Clock-out: same scanner + `recalculate_attendance_clock_out_policy`; last-service and Home Service extensions remain untouched.
- Database: `staff_shift_checkins`, `qr_scan_events`, `attendance_exceptions`. QR device/branch authorization, RLS, idempotency and commit RPCs remain in place.
- Potential separate DB gap: `recover_stale_attendance_and_clock_in` does not independently verify canonical schedule time; its EXECUTE grants and database-layer defense-in-depth require independent release review. No database schema or RPC mutation included.

## Implemented changes

1. New `clock-in-authority.ts`: deny a new clock-in unless the resolved working shift is valid, selected, and the scan instant is within `[scheduled start - 60 minutes, scheduled end)`. Existing late scans inside a shift remain reviewable.
2. Scanner validates *both* the ordinary first-scan path and stale-recovery new-clock-in path before any attendance write. An invalid QR scan is retained as a review event but does not create an attendance session.
3. An open shift at the same branch and same attendance business date is treated as a clock-out, even after midnight, instead of a stale-recovery-plus-next-day clock-in. This retains real QR clock-out time and dynamic service-based end calculations. Other-branch and genuinely prior-business-day open shifts preserve their existing recovery boundaries.
4. Intent engine uses the owner-approved full 60-minute early window even where legacy branch settings still show 30; the release checklist must reconcile those displayed settings without silently mutating production configuration.
5. Added focused Vitest coverage for 07:59:59 vs 08:00, Lorraine's midnight repro, late in-shift scan, shift end, missing/off/conflict schedule, genuine overnight windows, split shifts, same-business-day clock-out, and cross-branch safety.

## Required checks — not verified in this session

The connected environment has no local checked-out project/dependency installation. **Not run:** `pnpm exec vitest run`, `pnpm type-check`, scoped ESLint/Prettier, isolated Postgres transaction/concurrency tests, authenticated QR browser or native mobile tests, production deploy verification. Static anchor checks were performed while modifying source.

Required:
- `pnpm exec vitest run tests/lib/attendance/clock-in-authority.test.ts tests/lib/attendance/attendance-intent-engine.test.ts`.
- Attendance scanner integration: midnight open QR -> clock-out only, midnight no-open QR -> captured/no insert, new day 60m-before-start, late first scan, driver/therapist last-service extension, valid overnight, split shifts, completed-shift rescan, cross-branch, concurrent double scan.
- `pnpm type-check`, `pnpm exec eslint src/lib/attendance/scan-engine.ts src/lib/attendance/attendance-intent-engine.ts src/lib/attendance/clock-in-authority.ts tests/lib/attendance/clock-in-authority.test.ts tests/lib/attendance/attendance-intent-engine.test.ts`, Prettier, isolated database test fixtures.
- Independently reconcile overlaps with existing unmerged PR #82. Never replay/push historical local-only migrations to tidy the record.
- Check current production RPC EXECUTE authorization and decide whether an additional strictly server-side database guard is required. Obtain independent review and owner release permission BEFORE merging, deploying, changing settings, correcting history, or writing SQL.

**Status:** REVIEW ONLY — CORRECTION REQUIRED until tests and independent review.  
**Rollback:** revert the reviewed code commit only, preserve event/audit history; verify scanner operation and late-service clock-out after rollback. No production-impact claim from repository code alone.
