# HANDOFF — MANAGER-STAFF-AVAILABILITY-001

## Date
2026-05-20

## What Changed

### New page: Manager Staff Availability
**Route:** `/manager/staff-availability`
**File:** `src/app/(dashboard)/manager/staff-availability/page.tsx`

Server component. Gets manager's `branchId` via `getManagerBranchId()`, fetches staff + availability data via `getStaffWithAvailability(branchId)`, renders `PageHeader` + `StaffSchedulePageClient`. Shows an `Alert` on data-load failure (no crash).

### New query: `getStaffWithAvailability`
**File:** `src/lib/queries/staff.ts`

Exports `StaffAvailabilityItem` type and `getStaffWithAvailability(branchId)` function. Features:
- Fetches **all staff** (active + inactive) for a branch
- Parallel fetch of `staff_schedules`, `schedule_overrides`, `blocked_times` via `Promise.all`
- Overrides and blocked times scoped to **today → today + 90 days**
- Graceful fallback if DB migration for `staff_type`/`is_head`/`nickname` not yet applied

### Premium feedback wiring
- `StaffWeeklyHoursEditor`, `StaffDayOverridesEditor`, `StaffBlockTimeEditor` — each gained optional `onSave?: () => void` prop called after successful server action
- `StaffScheduleDetailPanel` — accepts `onSave?` and passes it to the active editor tab
- `StaffSchedulePageClient` — `handleSave` callback (useCallback) sets staff name + triggers `PremiumSuccessToast` for 3.5 s when any editor saves

### Nav update
Added to `MANAGER_NAV_ITEMS` (after "Staff"):
```ts
{ label: "Availability", href: "/manager/staff-availability", icon: "CalendarClock" }
```

### Server action revalidation
`src/app/(dashboard)/manager/staff/actions.ts` — all 4 actions now call:
```ts
revalidatePath("/manager/staff-availability");
```
in addition to the existing `revalidatePath("/manager/staff")`.

## What Was NOT Changed
- Booking engine (`src/lib/engine/availability.ts`) — untouched
- Booking lifecycle logic (`src/lib/bookings/progress.ts`) — untouched
- Staff portal, CRM, owner workspace — untouched (except nav-config already updated in CRM-NAV-001)
- No DB schema changes. No new npm packages.
- Editor components keep their existing inline banner feedback alongside the new toast

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 82 app routes

## Manual Test Checklist
1. Log in as a manager → sidebar shows **"Availability"** nav item below "Staff"
2. Click **Availability** → page loads, shows all branch staff in a table
3. Search by name → list filters correctly
4. Filter by "Not scheduled" → shows only unscheduled staff
5. Click **Manage** on a staff row → detail panel slides in from the right
6. **Weekly Hours tab**: click "Set" on a day → set hours → click Save → inline "Schedule saved" banner appears + bottom toast "Saved — Availability updated for [name]."
7. **Day Overrides tab**: add an override → toast fires; delete override → toast fires
8. **Block Time tab**: add a block → toast fires; delete a block → toast fires
9. Close the panel → page refreshes data via `router.refresh()`
10. Filter by "Scheduled" → staff with any active schedule day appears
11. Verify booking wizard still respects availability (book a slot outside a staff member's hours — they should not appear)
