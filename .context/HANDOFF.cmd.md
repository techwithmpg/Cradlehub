# HANDOFF — CRM-OPS-002D

## Date
2026-05-21

## What Changed

### Migration
**File:** `supabase/migrations/20260523000001_staff_shift_checkins.sql`
- New table `staff_shift_checkins` (id, staff_id, branch_id, shift_date, shift_type, checked_in_at, checked_out_at, status, recorded_by, notes)
- UNIQUE constraint: `(staff_id, shift_date, shift_type)` — one check-in per shift per day
- Partial index on `(branch_id, shift_date, status) WHERE checked_out_at IS NULL` for fast active lookups
- RLS: owner=all, manager/assistant_manager/store_manager=branch all, crm/csr_head/csr_staff=branch all, staff=read+write own
- `fn_update_updated_at()` trigger reused

### Types
**File:** `src/types/supabase.ts` — manually added `staff_shift_checkins` Row/Insert/Update (local Supabase unavailable; run `pnpm db:types` after applying migration)

### Server Actions
**File:** `src/lib/actions/staff-checkins.ts` (NEW)
- `checkInStaffForShiftAction(input)` — operators check in any branch staff; staff check in self; upsert-safe with conflict handling
- `checkOutStaffForShiftAction(input)` — sets `checked_out_at + status = checked_out`
- `getStaffCheckinForDate(staffId, branchId, date)` — server query for staff portal
- `getBranchCheckinsForDate(branchId, date)` — server query for snapshot (not yet used externally)

### CRM Availability Snapshot
**File:** `src/lib/queries/crm-availability.ts`
- Added `PresenceStatus` type: `checked_in | not_checked_in | checked_out | off_today | no_schedule`
- `LiveStatus` updated: now includes `not_checked_in | checked_out`
- `CrmAvailabilityStaffRow` now includes: `presenceStatus`, `checkedInAt`, `checkedOutAt`, `checkInId`
- `CrmAvailabilitySnapshot` now includes `branchId`
- `CrmAvailabilitySummary` now includes: `checkedIn`, `notCheckedIn`, `checkedOut`
- Fourth parallel query fetches today's check-ins for the branch
- `driversReady` now = drivers with `presenceStatus === "checked_in"` AND not busy (was: just `available_now`)

### CRM Availability Summary
**File:** `src/components/features/crm/availability/crm-availability-summary.tsx`
- New cards: Scheduled, Checked In, Available, Busy, Not Checked In (conditional), Drivers Ready, Needs Attention

### CRM Availability Board
**File:** `src/components/features/crm/availability/crm-availability-board.tsx`
- 5 columns: Available Now / Busy Assigned / Not Checked In / Off+Checked Out / Needs Attention
- `PresenceBadge` component on each staff card
- `CheckinButton` renders "Check in" (green) for `not_checked_in` staff and "Check out" for `checked_in`
- Actions use `useTransition` + `router.refresh()` for optimistic UI

### CRM Availability Client
**File:** `src/components/features/crm/availability/crm-availability-client.tsx`
- Staff List tab: added Presence column with `PresencePill` + inline check-in/out buttons
- Driver Readiness tab: check-in buttons for not-checked-in drivers; check-out for checked-in
- Footer updated: "Availability requires staff to be scheduled and checked in."

### CRM Availability Page
**File:** `src/app/(dashboard)/crm/availability/page.tsx`
- Banner changed from "schedule-based" warning to "check-in enabled" confirmation

### Staff Portal Check-in Widget
**File:** `src/components/features/staff-portal/staff-checkin-widget.tsx` (NEW)
- Shows My Shift Today status: Not yet checked in / Checked in at HH:MM / Shift complete
- Check In / Check Out buttons with `useTransition` + `router.refresh()`

### Staff Portal Page
**File:** `src/app/(dashboard)/staff-portal/page.tsx`
- Fetches `getStaffCheckinForDate()` alongside the today action
- Renders `StaffCheckinWidget` on both desktop and mobile layouts (shown when `branch_id` is set)

## Build / Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

## Git
- Commit: TBD (pending) on `main`
- Files changed: 11 (1 migration, 10 TypeScript/TSX files)

---

## ⚠️ Important Notes for Next Agent

1. **Migration not yet applied to live DB.** Apply `supabase/migrations/20260523000001_staff_shift_checkins.sql` via `pnpm db:migrate`, then run `pnpm db:types`.
2. **Self-check-in shift_type defaults to `single`.** The staff portal widget uses `shiftType: "single"` for self-check-in. Staff with opening/closing shifts need CRM to select the right shift type until the widget is updated.
3. **Phase 2E (future):** Expose shift_type picker in staff portal widget. Auto-void + re-check-in for checked-out staff. GPS-based check-in validation.

---

# HANDOFF — CRM-OPS-002C

## Date
2026-05-21

## What Changed

### Migration
**File:** `supabase/migrations/20260522000004_add_shift_type_to_staff_schedules.sql`

- Added `shift_type TEXT NOT NULL DEFAULT 'single'` to `staff_schedules`
- Added CHECK constraint: values must be `single | opening | closing`
- Dropped old UNIQUE `(staff_id, day_of_week)` constraint
- Added new UNIQUE `(staff_id, day_of_week, shift_type)` — allows one opening + one closing per staff per weekday
- Updated `get_available_slots` RPC: added `SELECT DISTINCT` to `working_hours` CTE and final SELECT to deduplicate overlap slots between opening and closing windows
- Replaced `get_daily_schedule` with a `GROUP BY sid` + `MIN`/`MAX` aggregate version that produces one full-span row per staff (opening 09:00–17:00 + closing 14:00–22:30 → 09:00–22:30)

### TypeScript Types
**File:** `src/types/supabase.ts`
- Added `shift_type: string` to `staff_schedules.Row`
- Added `shift_type?: string` to `staff_schedules.Insert` and `staff_schedules.Update`
- ⚠️ `pnpm db:types` was NOT run — local Supabase unavailable. Types were manually patched. Run `pnpm db:types` after applying the migration to a live DB.

### Validation + Server Action
**Files:** `src/lib/validations/staff.ts`, `src/app/(dashboard)/manager/staff/actions.ts`
- `setScheduleSchema` now includes `shiftType: z.enum(["single", "opening", "closing"]).default("single")`
- `setStaffScheduleAction` upsert includes `shift_type: parsed.data.shiftType` and `onConflict: "staff_id,day_of_week,shift_type"`
- All existing callers that don't pass `shiftType` continue to upsert with default `'single'` — fully backward-compatible

### Query Types
**File:** `src/lib/queries/staff.ts`
- `StaffAvailabilityItem.schedules` type: added `shift_type: "single" | "opening" | "closing"`
- `buildAvailabilityItems`: select includes `shift_type`; mapping includes typed `shift_type`
- `getStaffSchedule`: explicit column list includes `shift_type`, ordered by `day_of_week` then `shift_type`

### Schedule Utilities
**File:** `src/lib/utils/staff-schedule-summary.ts`
- Added `ShiftType = "single" | "opening" | "closing"` export
- Added `SHIFT_LABELS: Record<string, string>` export
- `summarizeWeeklyHours`: groups by `day_of_week` first; multi-shift days return "Opening / Closing (N days)"
- Added `getPrimaryShiftForDay(schedules, dayOfWeek): ShiftType` export

### Schedule UI Components
**Files:** `src/components/features/staff-schedule/staff-schedule-list.tsx`, `staff-schedule-row.tsx`, `staff-weekly-hours-editor.tsx`
**File:** `src/components/features/dashboard/schedule-manager.tsx`
- All local `Schedule` types updated with `shift_type?: string`
- `staff-schedule-row.tsx`: Added `SHIFT_BADGE_COLORS` + `ShiftBadge` component; displays shift badges for active schedules
- `staff-weekly-hours-editor.tsx`: Day detection updated to prefer `shift_type === "single"` row, fallback to first row in day

### CRM Availability Snapshot
**File:** `src/lib/queries/crm-availability.ts`
- Added `StaffShiftEntry` type (`shift_type`, `start_time`, `end_time`)
- `CrmAvailabilityStaffRow` now has `shifts: StaffShiftEntry[]` and `needsAttention: boolean`
- Summary now includes `needsAttention` count
- Third parallel query to `staff_schedules` for today's `day_of_week` to populate `shifts[]`

### CRM Availability Summary
**File:** `src/components/features/crm/availability/crm-availability-summary.tsx`
- Added Needs Attention card (conditional on count > 0)
- Updated sub-labels to match mockup wording

### CRM Availability Board (Live Board tab)
**File:** `src/components/features/crm/availability/crm-availability-board.tsx`
- Full 4-column board: Available Now / Busy Assigned / Off Today / Needs Attention
- `StaffCard`: `Initials` avatar, `ShiftBadge`, shift window, status dot
- Multi-shift days: renders one `ShiftBadge` per shift row

### CRM Availability Client (tabs)
**File:** `src/components/features/crm/availability/crm-availability-client.tsx`
- Tabs: Live Board / Staff List / Schedule Issues / Driver Readiness
- `StaffListView`: grid table with status dot, shift badge, shift times, active booking
- `ScheduleIssuesView`: warning cards for staff missing a weekly schedule
- `DriverReadinessView`: driver cards with schedule-ready / on trip / off status

### CRM Availability Page
**File:** `src/app/(dashboard)/crm/availability/page.tsx`
- Updated description text
- Added schedule-based disclaimer banner (ℹ icon)

### Schedule Setup Page
**File:** `src/app/(dashboard)/crm/staff-availability/page.tsx`
- Full redesign: 3 ExplainerCard components + ShiftPill legend
- Dynamic `noScheduleCount` warning card

---

## Build / Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

## Git
- Commit: TBD (pending) on `main`
- Files changed: 17 (1 migration, 16 TypeScript/TSX files)

---

## ⚠️ Important Notes for Next Agent

1. **Migration not yet applied to live DB.** `supabase/migrations/20260522000004_add_shift_type_to_staff_schedules.sql` is committed but must be applied via `pnpm db:migrate` against a running Supabase instance. After applying, run `pnpm db:types` to regenerate types.

2. **Existing schedules are safe.** All existing `staff_schedules` rows get `shift_type = 'single'` by the `DEFAULT 'single'` column. No data loss.

3. **Staff Weekly Hours Editor still sets only `single` shifts.** The UI for creating opening/closing split shifts is not yet wired. A manager can create them via direct DB insert or a future editor update. The booking engine and availability snapshot already support them correctly.

4. **Phase 2D (check-in) not yet implemented.** `staff_shift_checkins` table, check-in/out server action, and wiring into `getCrmAvailabilitySnapshot()` are deferred.

---

## Do Not Touch
- `get_available_slots` RPC — already updated in this migration; do not edit manually
- `get_daily_schedule` RPC — already updated in this migration; do not edit manually
- `staff_schedules` UNIQUE constraint — now `(staff_id, day_of_week, shift_type)`

---

## Phase 2D Plan (next separate migration)
- Add `staff_shift_checkins` table
- Staff check-in/check-out server action
- Wire check-in state into `getCrmAvailabilitySnapshot()` to surface physical presence vs schedule-based presence

---

# HANDOFF — CRM-OPS-002E

## Date
2026-05-21

## What Changed

### Schedule Setup Workspace Redesign
**File:** `src/app/(dashboard)/crm/staff-availability/page.tsx`
- Full redesign of the Schedule Setup page into a tabbed universal-group-schedule workspace.
- Page header now includes "Coverage Overview" and "Publish Schedules" placeholder action buttons.

**File:** `src/components/features/staff-schedule/schedule-setup-workspace.tsx` (NEW)
- Tabbed orchestrator with 4 tabs: General Rules, Individual Adjustments, Overrides, Coverage Issues.
- General Rules tab: group card selector + universal rules panel + right rail + helper bar.
- Individual Adjustments tab: renders existing `StaffSchedulePageClient` unchanged.
- Overrides tab: renders `ScheduleOverridesView` showing day-off overrides and blocked times.
- Coverage Issues tab: renders `ScheduleCoverageIssues` with real computed data.

**File:** `src/components/features/staff-schedule/schedule-setup-helper-bar.tsx` (NEW)
- Warm "How it works" explainer bar at the bottom of General Rules.

**File:** `src/components/features/staff-schedule/schedule-overrides-view.tsx` (NEW)
- Lists staff with upcoming day-off overrides and blocked times.
- Info banner linking to Individual Adjustments for full editing.

**Pre-existing untracked components now wired into the workspace:**
- `schedule-group-cards.tsx` — 7 staff group cards with real computed counts.
- `group-schedule-rules-panel.tsx` — Shift templates, weekly pattern matrix (preview-only), schedule summary, overlap window.
- `schedule-setup-right-rail.tsx` — Group overview stats, coverage insight bars, quick actions.
- `schedule-coverage-issues.tsx` — No-schedule / no-opening / on-leave issue cards.

## Build / Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

## Git
- Commit: TBD (pending) on `main`
- Files changed: 8 (4 new components, 1 modified page, 4 pre-existing untracked components)

## ⚠️ Important Notes for Next Agent

1. **Universal schedule persistence is NOT implemented yet.** The weekly pattern matrix, shift templates, and group rules are UI-level previews only. The UI clearly states: "Universal schedule persistence will be wired in the next implementation step."
2. **Existing individual schedule editing is fully preserved.** The "Individual Adjustments" tab renders the same `StaffSchedulePageClient` with toolbar, list, and detail panel editors.
3. **No database schema changes were made.** All schedule data still flows through `staff_schedules`, `schedule_overrides`, and `blocked_times`.
4. **Action buttons are placeholders.** "Coverage Overview" and "Publish Schedules" are disabled pending future implementation.
5. **Quick Actions in the right rail are placeholders.** Copy schedule, apply to new staff, export, and view staff list are displayed but not wired.

## Recommended Next Step
- Phase 2F: Implement persistent universal group schedule tables (`group_schedules` or `staff_group_rules`) and wire the weekly pattern matrix + shift templates to save/load from the database.

---

# HANDOFF — CRM-OPS-002E-A

## Date
2026-05-21

## What Changed

### Individual Adjustments Tab Polish
**File:** `src/components/features/staff-schedule/staff-schedule-page-client.tsx`
- Added 6-compact-stat strip at the top: Total Staff, Scheduled, Not Scheduled, With Overrides, With Blocks, Inactive.
- Stats computed from the full unfiltered staff list.

**File:** `src/components/features/staff-schedule/staff-schedule-toolbar.tsx`
- Filter dropdown replaced with horizontal filter pills (All, Scheduled, Not Scheduled, Overrides, Blocks, Active, Inactive).
- Search input upgraded with focus ring, rounded corners, and placeholder text.
- Sort select styled with custom arrow icon.

**File:** `src/components/features/staff-schedule/staff-schedule-list.tsx`
- Table header now uses `var(--cs-surface-warm)` background for better separation.
- Column proportions adjusted; override/block columns centered.

**File:** `src/components/features/staff-schedule/staff-schedule-row.tsx`
- Avatars now have deterministic soft colors based on staff name.
- New `StatusChip` component: pill-shaped badges for Scheduled (green), Off (neutral), Inactive (red).
- `CountBadge` for override/block counts — subtle but scannable.
- `ShiftBadge` restyled as uppercase pill with tighter typography.
- "Manage" button restyled as `cs-btn-secondary` for clearer affordance.

## Build / Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

## Git
- Commit: TBD (pending) on `main`

## ⚠️ Important Notes for Next Agent
1. **Existing sheet editor is untouched.** `StaffScheduleDetailPanel` with Weekly Hours / Day Overrides / Block Time editors remains fully functional.
2. **All data is real.** Stat cards, filter counts, and badges are computed from the same `StaffScheduleItem[]` data source.
3. **No schema changes.** This is a pure UI/UX polish pass.

## Recommended Next Step
- Phase 2F: Implement persistent universal group schedule tables.

---

# HANDOFF — CRM-OPS-002E-B

## Date
2026-05-21

## What Changed

### Manage Individual Schedule Modal Redesign
**File:** `src/components/features/staff-schedule/staff-schedule-detail-panel.tsx`
- Sheet now has a warm cream inner background (`var(--cs-surface-warm)`).
- Header section with large colored avatar, staff name, role/tier/head badges, and status chip.
- Weekly hours summary line with Clock icon and day-of-week dot indicators.
- Tabs upgraded to project's `Tabs` component with line variant and sand accent.

**File:** `src/components/features/staff-schedule/staff-weekly-hours-editor.tsx`
- Days rendered as circular short-label badges (green when scheduled, muted when off).
- Each day row shows full day name, time range, and Edit/Set ghost button.
- Inline editing uses time inputs + primary check button + secondary cancel button.
- Wrapped in a white rounded card.

**File:** `src/components/features/staff-schedule/staff-day-overrides-editor.tsx`
- Add-override form in a white rounded card with labeled Date, Day off, From/To fields.
- Override list items are cards with a date circle, formatted date label, and time range/day-off status.
- Remove action uses ghost button with Trash icon.
- Empty state with CalendarDays icon.

**File:** `src/components/features/staff-schedule/staff-block-time-editor.tsx`
- Add-block form in a white rounded card with labeled Date, From, To, Reason fields.
- Block list items are cards with colored reason badge, date circle, formatted date, and time range.
- Remove action uses ghost button with Trash icon.
- Empty state with ShieldAlert icon.

## Build / Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

## Git
- Commit: TBD (pending) on `main`

## ⚠️ Important Notes for Next Agent
1. **All functionality is preserved.** Every server action call, state update, optimistic UI pattern, and callback remains unchanged.
2. **No schema changes.** This is a pure UI redesign of the sheet and its three editors.
3. **Feedback alerts now use theme tokens.** Success/error backgrounds use `--cs-success-bg` / `--cs-error-bg` instead of hardcoded hex.

## Recommended Next Step
- Phase 2F: Implement persistent universal group schedule tables.
