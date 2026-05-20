# HANDOFF — SCHEDULE-ADJUSTMENT-001

## Date
2026-05-20

## What Changed

### Shared Manual Adjustment Action
**File:** `src/lib/actions/staff-schedule-adjustments.ts`

Added `adjustStaffScheduleAction(input)` with support for:
- `working_hours` — upserts a date-specific `schedule_overrides` row with custom hours.
- `day_off` — upserts a date-specific day-off override.
- `blocked_time` — inserts a `blocked_times` row.
- `remove_override` — deletes the staff/date override.
- `remove_block` — deletes one blocked-time row after validating staff/date ownership.

The action verifies:
- Authenticated active staff actor.
- Role via `canAdjustStaffSchedule()` (`owner`, manager variants, `crm`, `csr_head`).
- Non-owner branch scope.
- Target staff belongs to the submitted branch.

After success it revalidates:
`/manager/schedule`, `/crm/schedule`, `/manager/bookings`, `/crm/bookings`, `/manager`, `/crm`, `/manager/staff-availability`, `/crm/staff-availability`, `/staff-portal`, `/staff-portal/schedule`, and `/book`.

### Schedule UI Integration
**File:** `src/components/features/schedule/manual-staff-schedule-adjustment.tsx`

Added compact control inside the existing schedule staff-mode flow. It supports:
- Custom hours
- Off today
- Block time
- Clear override
- Remove block

It uses the existing motion spinner/toast components and does not redesign the schedule page.

### Staff Mode Wiring
**Files:**
- `src/components/features/schedule/schedule-workspace.tsx`
- `src/components/features/schedule/schedule-board-panel.tsx`
- `src/components/features/schedule/schedule-staff-mode.tsx`

The schedule workspace now shows success/error toast feedback and refreshes route data after successful manual adjustments. Staff mode renders the manual adjustment section below the selected staff profile/summary.

### Daily Schedule Data
**File:** `src/lib/queries/schedule.ts`

Daily schedule rows now include:
- `current_override` for the selected staff/date.
- `blocks[].id` from `blocked_times`, so remove-block targets the real row.

The existing `get_daily_schedule` RPC remains untouched.

### Permissions
**File:** `src/lib/permissions.ts`

Added `canAdjustStaffSchedule()` to centralize manual schedule adjustment authorization.

## What Was NOT Changed
- No new schedule page.
- No database schema changes.
- No new packages.
- No booking engine rewrite.
- Existing weekly schedule editors and `/manager/staff-availability`/`/crm/staff-availability` remain intact.

## Verification
- `pnpm type-check`: Passing
- `pnpm lint`: Passing
- `pnpm build`: Passing, 83 app routes

## Manual Test Focus
1. Open `/manager/schedule`, switch to Staff view, choose a staff member.
2. Set Off today and confirm booking/provider availability no longer offers that staff/date.
3. Clear override and confirm normal weekly schedule returns.
4. Add a 2 PM-3 PM block and confirm that slot is unavailable while later slots can remain available.
5. Repeat from `/crm/schedule` with branch-scoped CRM/CSR head account.
6. Confirm cross-branch edits fail server-side.
