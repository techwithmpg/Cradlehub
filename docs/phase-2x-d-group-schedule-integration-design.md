# Phase 2X-D — Group Schedule Integration Design

> Status: **DESIGN ONLY** — No code modified.  
> Implements the approved priority rule from the product discussion.  
> Phase 2X-E will execute this plan.

---

## 1. Executive Summary

Group schedule rules (`staff_group_schedule_rules`) exist in the database but have zero operational effect. The `get_available_slots` RPC — which powers the public booking wizard — only reads `staff_schedules` (individual) and `schedule_overrides`. If a staff member has no row in `staff_schedules` for a given day, the RPC produces `ELSE NULL` → they are invisible to the booking engine.

The fix is a **group fallback tier**: when no individual schedule exists, the RPC looks up the staff member's group and uses the group rule instead. Individual schedules remain dominant; groups are the default.

There are **two places** where schedule truth is read and both must change:

| # | Location | Purpose | Must change? |
|---|---|---|---|
| 1 | `get_available_slots` SQL (working_hours CTE) | Slot generation | **Yes** |
| 2 | `filterSlotsToWorkingWindows` TypeScript | Post-filter that re-validates slots | **Yes** |
| 3 | `get_daily_schedule` SQL (work_hours CTE) | CRM/manager daily board | **Yes** (consistency) |

---

## 2. Current Schedule Logic Map

### 2.1 `get_available_slots` — `working_hours` CTE (current)

```sql
working_hours AS (
  SELECT DISTINCT
    sp.staff_id, sp.staff_name, sp.staff_tier,
    CASE
      WHEN so.is_day_off = TRUE                              THEN NULL
      WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL   THEN so.start_time
      WHEN ss.id IS NOT NULL                                 THEN ss.start_time
      ELSE NULL   -- ← THE GAP: no group fallback
    END AS work_start,
    CASE
      WHEN so.is_day_off = TRUE                              THEN NULL
      WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL     THEN so.end_time
      WHEN ss.id IS NOT NULL                                 THEN ss.end_time
      ELSE NULL   -- ← THE GAP: no group fallback
    END AS work_end
  FROM staff_pool sp
  LEFT JOIN schedule_overrides so ON so.staff_id = sp.staff_id AND so.override_date = p_date
  LEFT JOIN staff_schedules ss    ON ss.staff_id = sp.staff_id AND ss.day_of_week = v_day_of_week AND ss.is_active = TRUE
)
```

Priority today:
1. `schedule_overrides.is_day_off = TRUE` → NULL (off)
2. `schedule_overrides` with explicit times → override times
3. `staff_schedules` row → individual times
4. `ELSE NULL` → **invisible** (even if a group rule exists)

### 2.2 `filterSlotsToWorkingWindows` TypeScript (current, `src/lib/engine/availability.ts`)

Post-filter that re-reads `staff_schedules` and `schedule_overrides` to verify slots fit inside working windows. It builds `schedulesByStaff` map from individual schedules only:

```ts
const schedulesByStaff = new Map<string, StaffScheduleRow>();
for (const row of schedulesResult.data) {
  const existing = schedulesByStaff.get(row.staff_id);
  if (!existing || row.start_time < existing.start_time) {
    schedulesByStaff.set(row.staff_id, row);
  }
}
// ...
const startTime = override?.start_time ?? schedulesByStaff.get(slot.staff_id)?.start_time;
const endTime   = override?.end_time   ?? schedulesByStaff.get(slot.staff_id)?.end_time;
if (!startTime || !endTime) return false;  // ← DROPS group-rule slots
```

If the RPC is updated to generate slots from group rules but this TypeScript filter is not updated, it will drop all group-rule generated slots (no `staff_schedules` row → `startTime` = undefined → filtered out).

---

## 3. Data Model for Group Lookup

There is **no `group_id` foreign key on `staff`**. The mapping is implicit:

```
staff.staff_type  →  staff_schedule_groups.group_key  (same value)
                      (both scoped to the same branch_id)
```

So to look up a staff member's group rule:

```sql
staff.staff_type = 'therapist'
  JOIN staff_schedule_groups sg
    ON sg.branch_id = staff.branch_id
   AND sg.group_key = staff.staff_type
   AND sg.is_active = TRUE
  JOIN staff_group_schedule_rules gr
    ON gr.group_id    = sg.id
   AND gr.day_of_week = v_day_of_week
   AND gr.is_active   = TRUE
```

The `staff_pool` CTE in the current RPC does NOT select `staff_type`. It must be added.

---

## 4. Approved Priority Rule

```
1. schedule_overrides.is_day_off = TRUE   → staff is off (NULL hours, no slots)
2. schedule_overrides with explicit times → use override window
3. staff_schedules row(s) for that day    → use individual schedule
4. staff_group_schedule_rules for that day → use group default
5. No rule at all                         → staff invisible (no slots, same as today)
6. blocked_times apply on top of working window (existing behavior, unchanged)
7. Booking conflicts apply on top (existing behavior, unchanged)
```

---

## 5. Designed Changes

### 5.1 SQL Change — `get_available_slots`

**Step A:** Add `staff_type` to `staff_pool`:

```sql
staff_pool AS (
  SELECT
    s.id        AS staff_id,
    s.full_name AS staff_name,
    s.tier      AS staff_tier,
    s.staff_type AS staff_type   -- NEW
  FROM staff s
  WHERE s.branch_id = p_branch_id
    AND s.is_active = TRUE
    AND (p_staff_id IS NULL OR s.id = p_staff_id)
),
```

**Step B:** Add group rule JOINs and updated CASE in `working_hours`:

```sql
working_hours AS (
  SELECT DISTINCT
    sp.staff_id,
    sp.staff_name,
    sp.staff_tier,
    CASE
      WHEN so.is_day_off = TRUE                              THEN NULL
      WHEN gr.is_day_off = TRUE AND ss.id IS NULL            THEN NULL  -- group day-off (only when no individual override)
      WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL   THEN so.start_time
      WHEN ss.id IS NOT NULL                                 THEN ss.start_time  -- individual schedule
      WHEN gr.id IS NOT NULL                                 THEN gr.start_time  -- group fallback
      ELSE NULL
    END AS work_start,
    CASE
      WHEN so.is_day_off = TRUE                              THEN NULL
      WHEN gr.is_day_off = TRUE AND ss.id IS NULL            THEN NULL
      WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL     THEN so.end_time
      WHEN ss.id IS NOT NULL                                 THEN ss.end_time
      WHEN gr.id IS NOT NULL                                 THEN gr.end_time
      ELSE NULL
    END AS work_end
  FROM staff_pool sp
  LEFT JOIN schedule_overrides so
    ON  so.staff_id      = sp.staff_id
    AND so.override_date = p_date
  LEFT JOIN staff_schedules ss
    ON  ss.staff_id    = sp.staff_id
    AND ss.day_of_week = v_day_of_week
    AND ss.is_active   = TRUE
  LEFT JOIN staff_schedule_groups sg          -- NEW
    ON  sg.branch_id  = p_branch_id
    AND sg.group_key  = sp.staff_type
    AND sg.is_active  = TRUE
  LEFT JOIN staff_group_schedule_rules gr     -- NEW
    ON  gr.group_id    = sg.id
    AND gr.day_of_week = v_day_of_week
    AND gr.is_active   = TRUE
),
```

**Note on `SELECT DISTINCT` behaviour:** The existing `SELECT DISTINCT` on `working_hours` already handles the case where multiple shift_type rows produce duplicate working windows (e.g., override collapses opening+closing to one window). The same mechanism will correctly handle group rules with multiple shift_types (opening+closing group rules produce separate windows; SELECT DISTINCT deduplicates only when windows are identical).

**SECURITY DEFINER note:** `get_available_slots` is `SECURITY DEFINER SET search_path = public`. This bypasses RLS on `staff_schedule_groups` and `staff_group_schedule_rules`. That is correct — the function already bypasses RLS on other tables for the same reason.

### 5.2 SQL Change — `get_daily_schedule`

The `work_hours` CTE in `get_daily_schedule` has the same gap. For CRM board consistency, apply the same group fallback:

```sql
work_hours AS (
  SELECT
    ast.sid,
    CASE
      WHEN COALESCE(BOOL_OR(so.is_day_off), FALSE) THEN NULL
      WHEN COALESCE(BOOL_OR(gr.is_day_off), FALSE) AND NOT EXISTS (
        SELECT 1 FROM public.staff_schedules ss2
        WHERE ss2.staff_id = ast.sid AND ss2.day_of_week = v_dow AND ss2.is_active = TRUE
      ) THEN NULL
      ELSE MIN(
        CASE
          WHEN so.start_time IS NOT NULL THEN so.start_time
          WHEN ss.start_time IS NOT NULL THEN ss.start_time
          ELSE gr.start_time
        END
      )
    END AS wh_start,
    -- mirror for wh_end
    ...
  FROM active_staff ast
  LEFT JOIN public.schedule_overrides so ...
  LEFT JOIN public.staff_schedules ss ...
  LEFT JOIN public.staff_schedule_groups sg     -- NEW
    ON sg.branch_id = p_branch_id
   AND sg.group_key = (SELECT s.staff_type FROM public.staff WHERE s.id = ast.sid LIMIT 1)
   AND sg.is_active = TRUE
  LEFT JOIN public.staff_group_schedule_rules gr  -- NEW
    ON gr.group_id = sg.id
   AND gr.day_of_week = v_dow
   AND gr.is_active = TRUE
  GROUP BY ast.sid
)
```

**Alternative for `get_daily_schedule`:** Since `active_staff` doesn't include `staff_type`, there are two options:
- Add `staff_type` to `active_staff` CTE (preferred — matches the pattern in `get_available_slots`)
- Use a scalar subquery (shown above but less clean)

The preferred approach is to add `staff_type` to `active_staff`.

### 5.3 TypeScript Change — `filterSlotsToWorkingWindows`

This function re-validates that each slot fits inside a working window. With group rules wired in the RPC, slots generated from group rules will have no `staff_schedules` row. Two options:

**Option A — Also fetch group rules in the filter (full parity):**  
Query `staff_schedule_groups` + `staff_group_schedule_rules` as a fallback. Correct but adds DB calls.

**Option B — Trust the RPC for group-rule staff (simpler):**  
If neither an override nor an individual schedule exists for a staff member in the TypeScript filter, do not drop the slot — the RPC already validated that the slot fits within the group window. Change the filter from:

```ts
if (!startTime || !endTime) return false;  // current: drop if no schedule
```

to:

```ts
if (!startTime || !endTime) return true;  // option B: trust RPC output
```

**Decision: Use Option A.**  
Option B introduces a subtle correctness hole: if a staff member somehow appears in the RPC output without a working window (e.g., data integrity issue), the TypeScript filter would let bad slots through. Option A maintains defense-in-depth. The extra DB calls are two queries (one to `staff_schedule_groups`, one to `staff_group_schedule_rules`) on small tables with branch+key indexes.

The updated `filterSlotsToWorkingWindows` signature stays the same. Internally, after resolving overrides and schedules, add:

```ts
// Group fallback: for staff without an individual schedule or override, check group rules
if (!startTime || !endTime) {
  const groupRule = groupRulesByStaff.get(slot.staff_id);
  if (!groupRule || groupRule.is_day_off) return false;
  startTime = groupRule.start_time ?? undefined;
  endTime   = groupRule.end_time   ?? undefined;
  if (!startTime || !endTime) return false;
}
```

Where `groupRulesByStaff` is built by looking up each staff member's `staff_type`, joining to `staff_schedule_groups` + `staff_group_schedule_rules`.

---

## 6. Test Cases

### 6.1 Slot Visibility (core correctness)

| # | Setup | Expected |
|---|---|---|
| T1 | Staff has individual schedule for the day | Slots from individual schedule (unchanged) |
| T2 | Staff has NO individual schedule; group rule exists for the day | Slots from group rule **NEW BEHAVIOR** |
| T3 | Staff has NO individual schedule; group rule has `is_day_off=TRUE` | No slots |
| T4 | Staff has NO individual schedule; no group rule for that day | No slots (same as today) |
| T5 | Staff has individual schedule + group rule for same day | Individual schedule wins |
| T6 | Staff has `schedule_override` (day off) + group rule | Override wins → no slots |
| T7 | Staff has `schedule_override` (time change) + individual + group | Override wins |
| T8 | Staff has `staff_type = NULL`; group rule exists | No group lookup → no group slots (staff_type IS NULL, no JOIN match) |
| T9 | Group has no rule for that specific day of week | No group slots for that day (same as T4) |

### 6.2 Multi-Shift Windows

| # | Setup | Expected |
|---|---|---|
| T10 | Staff has individual opening+closing schedules | Both windows visible (unchanged) |
| T11 | Staff has NO individual schedule; group has opening+closing rules | Both group windows visible **NEW** |
| T12 | Staff has individual single schedule; group has opening+closing rules | Individual single wins (no group used) |

### 6.3 Post-Filter Consistency

| # | Setup | Expected |
|---|---|---|
| T13 | Group-rule slot at 10:00, group rule is 09:00–18:00 | `filterSlotsToWorkingWindows` passes slot (fits in window) |
| T14 | Group-rule slot at 18:30, group rule is 09:00–18:00 (60-min service) | Filter drops slot (slot end = 19:30 > work_end) |
| T15 | Staff has override (day off) + group rule; slot generated | Filter drops slot via override.is_day_off |

### 6.4 Regression (existing behavior must not change)

| # | Setup | Expected |
|---|---|---|
| R1 | Existing staff with schedules for all 7 days | Slots identical to today |
| R2 | Staff with override on specific date | Override behavior unchanged |
| R3 | Staff with blocked times | Blocked time filtering unchanged |
| R4 | Staff with booking conflicts | Conflict detection unchanged |
| R5 | Date in the past | No slots returned (unchanged) |
| R6 | Staff with no schedule of any kind | No slots (unchanged) |

---

## 7. Edge Cases and Decisions

### 7.1 Individual schedule overrides group — only for days that have an individual row

The priority rule says "individual overrides group." This means: if a staff member has an individual schedule for Monday but NOT for Tuesday, and the group has rules for both days, then:
- Monday → individual schedule (group ignored)
- Tuesday → group schedule (no individual row)

This is the correct semantics. The CASE expression in the RPC handles this naturally via the LEFT JOIN: `WHEN ss.id IS NOT NULL THEN ss.start_time` fires only when a row exists.

### 7.2 Group `is_active = FALSE`

If a group has `is_active = FALSE`, the `LEFT JOIN staff_schedule_groups sg ... AND sg.is_active = TRUE` filter means no rules are found → same as having no group. Group rules are only consulted when the group itself is active.

### 7.3 Group rule `is_active = FALSE` vs `is_day_off = TRUE`

- `is_active = FALSE` on a rule → rule is not joined (filtered at JOIN time) → treated as if no rule
- `is_day_off = TRUE` on a rule → rule IS joined → CASE produces NULL → staff marked off

Both are valid ways to disable a rule. The distinction: `is_day_off` is intentional "this group is off today"; `is_active = FALSE` is "this rule is paused/deleted."

### 7.4 When individual schedule exists for SOME shift_types but not others

Example: a staff member has a `single` schedule row for Wednesday, but no `opening` row. The group has both `single` and `opening` rules for Wednesday.

In the current LEFT JOIN approach, `ss` matches the `single` row. The CASE fires `WHEN ss.id IS NOT NULL THEN ss.start_time`, which wins. The group rules are ignored. This means **once any individual schedule row exists for that day, the entire group rule is bypassed for that day**.

This is the correct and least-surprising behavior. If you want a staff member on a custom single shift while their colleagues follow group opening+closing rules, setting one `single` row overrides everything. Managers can always use `applyGroupScheduleToStaffAction` to reset.

### 7.5 `filterSlotsToWorkingWindows` uses earliest start time as "primary window"

The current TypeScript uses the earliest `start_time` in `schedulesByStaff` as the representative window for the post-filter. For group rules with multiple shift_types, the same approach should be used: take the earliest start / latest end across all group rule shift_types for that staff member's group. This is consistent with how the RPC uses `SELECT DISTINCT` to handle multiple shift windows.

**Better approach for the TypeScript filter:** Instead of collapsing to a single window, check whether the slot fits inside **any** of the staff's windows (individual or group). This is more correct for opening+closing scenarios.

---

## 8. Implementation Plan (for Phase 2X-E)

### Step 1: New migration file

Create `supabase/migrations/20260524000002_wire_group_rules_into_availability.sql` (or the next available timestamp).

Replaces `get_available_slots` and `get_daily_schedule` with the updated versions from Section 5.

Changes to `get_available_slots`:
- Add `staff_type` to `staff_pool` CTE
- Add LEFT JOINs to `staff_schedule_groups` + `staff_group_schedule_rules` in `working_hours` CTE
- Add group fallback tier to the CASE expressions
- Update COMMENT ON FUNCTION

Changes to `get_daily_schedule`:
- Add `staff_type` to `active_staff` CTE
- Add LEFT JOINs to `staff_schedule_groups` + `staff_group_schedule_rules` in `work_hours` CTE
- Add group fallback tier to MIN/MAX aggregation
- Update COMMENT ON FUNCTION

### Step 2: Update `filterSlotsToWorkingWindows` in `availability.ts`

Add group rule fallback lookup. After fetching `staff_schedules` and `schedule_overrides`, also fetch group rules for staff members who have no individual schedule.

New query pattern inside `filterSlotsToWorkingWindows`:
```ts
// staffIds with no individual schedule
const staffIdsWithoutSchedule = staffIds.filter(
  (id) => !schedulesByStaff.has(id)
);

// If any such staff members exist, look up their group rules
if (staffIdsWithoutSchedule.length > 0) {
  // 1. Get staff_type for each staff_id (from staff table or from the slots)
  // 2. JOIN to staff_schedule_groups by branch_id + group_key
  // 3. JOIN to staff_group_schedule_rules by group_id + day_of_week + is_active
  // 4. Build groupRulesByStaff map (multi-window aware)
}
```

Note: `filterSlotsToWorkingWindows` doesn't currently receive `branchId` or `staffType` data. It will need either:
- `branchId` passed as a new parameter (to look up groups), OR
- `staffType` per slot (but slots don't have `staff_type` in the current `AvailabilitySlot` type)

**Recommended approach:** Pass `branchId` as a new parameter to `filterSlotsToWorkingWindows`. It is already available at every call site.

### Step 3: Verify `assertSlotAvailable` and `assertMultiServiceSlotAvailable`

These call `getAvailableSlots` / `getAvailableSlotsMulti`, which call `filterSlotsToWorkingWindows`. Once Steps 1 and 2 are done, they should work correctly without further changes.

### Step 4: Verify `applyGroupScheduleToStaffAction` remains valid

This action copies group rules into `staff_schedules` rows (individual). After 2X-E, it remains valid as a "promote group rule to individual schedule" convenience action. No changes needed.

### Step 5: Run type-check, lint, build, and manual smoke test

- Type-check and lint (automated)
- Build (automated)
- Manual smoke test: open `/book` wizard, select a date, verify staff with group rules but no individual schedules now appear in slot results

---

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Staff who were previously hidden now appear | LOW–MEDIUM | This is the intended outcome. Monitor for unexpected new slots for staff types that shouldn't serve customers (e.g., drivers in therapist slots). Service capability filtering (`filterSlotsForQualifiedProviders`) is a second defense. |
| Group rule with incorrect times creates bad slots | LOW | Group rules are managed by managers/CRM; same trust level as individual schedules. |
| Performance regression | LOW | Two additional LEFT JOINs on indexed columns. `staff_schedule_groups` is tiny (7 rows per branch). |
| `SECURITY DEFINER` scope | NONE | Function already bypasses RLS; same scope applies to new JOINs. |
| TypeScript filter drops group-rule slots if not updated | HIGH | Steps 1 and 2 must ship together in same PR. |
| `get_daily_schedule` not updated | MEDIUM | CRM board would show staff as "unscheduled" even after group rules wire in. Include in same migration. |

---

## 10. What This Does NOT Fix

The following items remain for 2X-F and 2X-G:

- `manager/staff-availability` still shows legacy individual-only editor (2X-F)
- Dead code from before Phase 2H (2X-G)
- CRM recommendation engine still ignores group schedules in scoring — this is a separate issue. Recommendation engine uses `getStaffSchedulesForScoring(staffIds, dayOfWeek)` which also reads only `staff_schedules`. After 2X-E, the booking engine will show correct slots; but the auto-assign scoring won't automatically use group schedules either. That is a separate 2X-E sub-task.

---

## 11. Files to Change in Phase 2X-E

| File | Change |
|---|---|
| `supabase/migrations/20260524000002_wire_group_rules_into_availability.sql` | **CREATE** new migration |
| `src/lib/engine/availability.ts` | Update `filterSlotsToWorkingWindows` + add `branchId` param |
| `src/lib/queries/assignment-recommendations.ts` | Update `getStaffSchedulesForScoring` to also fall back to group rules (or: add a new `getGroupSchedulesForScoring` helper) |

The RPC change is the authoritative fix. The TypeScript changes are defense-in-depth consistency updates.
