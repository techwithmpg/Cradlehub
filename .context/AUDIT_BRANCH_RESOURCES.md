# Branch Resources / Booking Rules Feature Audit

> **Audit Date:** 2026-05-10
> **Auditor:** Kimi
> **Scope:** Read-only discovery of all Branch Resources and Booking Rules functionality across Owner, Manager, and CRM workspaces.

---

## 1. Executive Summary

**What exists:**
- A single `branch_resources` table stores all physical spaces (rooms, beds, chairs, equipment, home service units, shared areas) with capacity-aware conflict checking.
- A single `branch_booking_rules` table stores per-branch operational rules (in-spa hours, home service hours, travel buffer, max advance booking days, driver capacity).
- Resource CRUD lives inside the **Owner → Branch Detail** page only. Managers cannot create/edit resources.
- Manager has a **read-only Space Utilization** page (`/manager/resources`) showing daily occupancy per resource.
- Manager has a **Branch Settings** page (`/manager/settings`) that reuses the same `BranchBookingRulesForm` component from the owner branch detail page, plus service availability toggles.
- Resource assignment happens automatically on booking confirmation (`autoAssignBookingResource`) or manually via the Schedule Details panel, Walk-in form, or edit booking action.
- Conflict checking works via `isResourceAvailable()` and the `/api/manager/resource-check` API.

**What is missing:**
- No shared workspace for resources/booking rules (the user wants to unify this).
- No dedicated "Resources" or "Booking Rules" nav item for owners — must drill into a specific branch.
- No resource hard delete (only soft deactivate).
- No resource-specific schedule overrides or blocked times.
- No branch-level overview of all resources across all branches for the owner.
- The resource check API lacks role/branch authorization beyond basic auth.
- Manager actions (`manager/bookings/actions.ts`, `manager/walkin/actions.ts`) block owners who have `branch_id = null`.

---

## 2. Routes Found

| Workspace | Route | File | Purpose | Status | Notes |
|-----------|-------|------|---------|--------|-------|
| Owner | `/owner/branches` | `src/app/(dashboard)/owner/branches/page.tsx` | Branch list with staff/booking counts | **Active** | Create new branch button |
| Owner | `/owner/branches/new` | `src/app/(dashboard)/owner/branches/new/page.tsx` | Create new branch form | **Active** | Name, address, phone, email, messenger, slot interval |
| Owner | `/owner/branches/[branchId]` | `src/app/(dashboard)/owner/branches/[branchId]/page.tsx` | **Compound branch detail page** containing: BranchEditForm, BranchBookingRulesForm, BranchResourcesManager, BranchServicesPanel, staff list | **Active** | No child routes — everything on one page |
| Owner | `/owner/schedule` | `src/app/(dashboard)/owner/schedule/page.tsx` | Schedule timeline with resources | **Active** | Uses shared ScheduleWorkspace |
| Manager | `/manager/resources` | `src/app/(dashboard)/manager/resources/page.tsx` | **Space Utilization** — daily occupancy per resource | **Active** | Read-only for managers. Hardcoded 8am–10pm window |
| Manager | `/manager/settings` | `src/app/(dashboard)/manager/settings/page.tsx` | **Branch Settings** — booking rules + service availability | **Active** | Reuses `BranchBookingRulesForm` and `BranchServicesPanel` from owner |
| Manager | `/manager/operations` | `src/app/(dashboard)/manager/operations/page.tsx` | Launcher grid linking to Spaces, Settings, etc. | **Active** | Static links |
| Manager | `/manager/schedule` | `src/app/(dashboard)/manager/schedule/page.tsx` | Schedule timeline with resources | **Active** | Uses shared ScheduleWorkspace |
| Manager | `/manager/bookings` | `src/app/(dashboard)/manager/bookings/page.tsx` | Booking list with resource auto-assign on confirmation | **Active** | `updateBookingStatusAction` auto-assigns room on confirm |
| Manager | `/manager/walkin` | `src/app/(dashboard)/manager/walkin/page.tsx` | Walk-in booking form with optional resource picker | **Active** | `WalkinForm` has resource dropdown + live conflict check |
| CRM | `/crm/schedule` | `src/app/(dashboard)/crm/schedule/page.tsx` | Schedule timeline (view-only resources) | **Active** | Uses shared ScheduleWorkspace |
| CRM | `/crm/bookings` | `src/app/(dashboard)/crm/bookings/page.tsx` | Booking list (view-only resources) | **Active** | No resource management |
| CRM | `/crm/today` | `src/app/(dashboard)/crm/today/page.tsx` | Today queue with resource name display | **Active** | `CrmBookingQueuePanel` shows `resource_name` |
| API | `GET /api/manager/resource-check` | `src/app/api/manager/resource-check/route.ts` | Check if resource is available for time slot | **Active** | ⚠️ Only checks auth, not role/branch |
| API | `GET /api/manager/context` | `src/app/api/manager/context/route.ts` | Returns branch context incl. active resources | **Active** | Used by walk-in form |
| API | `GET /api/booking/available-slots` | `src/app/api/booking/available-slots/route.ts` | Public + in-house available slots | **Active** | Does NOT check resources |

---

## 3. Navigation Map

| Workspace | Nav Label | Route | Exists? | Notes |
|-----------|-----------|-------|---------|-------|
| Owner | Branches | `/owner/branches` | ✅ Yes | Clear. No direct "Resources" or "Booking Rules" link. |
| Owner | *(none)* | `/owner/branches/[id]/resources` | ❌ No sub-route | Resources are embedded inside branch detail page |
| Owner | *(none)* | `/owner/branches/[id]/rules` | ❌ No sub-route | Booking rules embedded inside branch detail page |
| Manager | Spaces | `/manager/resources` | ✅ Yes | ⚠️ Ambiguous label — page is "Space Utilization", read-only |
| Manager | Settings | `/manager/settings` | ✅ Yes | ⚠️ Too broad — contains booking rules + service availability |
| Manager | Operations | `/manager/operations` | ✅ Yes | Launcher page linking to Spaces and Settings |
| CRM | *(none for resources)* | — | — | No resource nav items by design |

**Key finding:** The Owner sidebar has no direct way to manage resources or booking rules without first clicking into a specific branch. The Manager sidebar has "Spaces" (read-only utilization) and "Settings" (rules + services) as separate top-level items.

---

## 4. Data Models Found

### 4.1 `branch_resources` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `branch_id` | UUID | NOT NULL, FK → branches(id) ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | e.g. "Room 1", "Bed A" |
| `type` | TEXT | NOT NULL DEFAULT 'room', CHECK IN (...) | room, bed, chair, equipment, home_service_unit, shared_area, other |
| `capacity` | INTEGER | NOT NULL DEFAULT 1, CHECK >= 1 | Allows >1 simultaneous bookings (shared areas) |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Soft-delete equivalent |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | Display order |
| `notes` | TEXT | nullable | Internal description |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Trigger-managed |

**Indexes:** `branch_id`, `branch_id + is_active`, `branch_id + sort_order`

**RLS Policies:**
- Owner: full CRUD
- Manager: full CRUD for own branch
- CRM/CSR/Staff: read active resources in their branch

**Relationships:**
- `branch_id → branches(id)`
- Referenced by: `bookings.resource_id → branch_resources(id)` ON DELETE SET NULL

### 4.2 `branch_booking_rules` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `branch_id` | UUID | NOT NULL, FK → branches(id) ON DELETE CASCADE | UNIQUE |
| `in_spa_start_time` | TIME | NOT NULL DEFAULT '10:00' | |
| `in_spa_end_time` | TIME | NOT NULL DEFAULT '22:30' | |
| `home_service_enabled` | BOOLEAN | NOT NULL DEFAULT TRUE | |
| `home_service_start_time` | TIME | NOT NULL DEFAULT '14:30' | |
| `home_service_end_time` | TIME | NOT NULL DEFAULT '22:00' | |
| `travel_buffer_mins` | INTEGER | NOT NULL DEFAULT 30, CHECK 0–240 | |
| `max_advance_booking_days` | INTEGER | NOT NULL DEFAULT 30, CHECK 1–365 | |
| `home_service_driver_capacity` | INTEGER | NOT NULL DEFAULT 1, CHECK 0–20 | Added in later migration |

**RLS Policies:**
- Owner: full CRUD
- Manager: read + update own branch
- Staff/CSR/CRM: read own branch

**Triggers:** `updated_at = NOW()` on UPDATE

### 4.3 `bookings` table (resource-related)

| Column | Type | Notes |
|--------|------|-------|
| `resource_id` | UUID, nullable, FK → branch_resources(id) ON DELETE SET NULL | Added by `20260505000001_branch_resources.sql` |
| `type` | TEXT | "online", "walk_in", "home_service" |
| `status` | TEXT | "pending", "confirmed", "in_progress", "completed", "cancelled", "no_show" |

---

## 5. Queries and Actions

| Function/Action | File | Read/Write | Used By | Workspace Safety | Notes |
|-----------------|------|------------|---------|------------------|-------|
| `getBranchResourcesAction` | `owner/branches/resources-actions.ts` | Read | BranchResourcesManager | ✅ RLS-protected | No explicit role check; relies on RLS |
| `createBranchResourceAction` | `owner/branches/resources-actions.ts` | **Write** | BranchResourcesManager | ✅ `requireOwnerOrManager` | Owner = any branch; Manager = own branch only |
| `updateBranchResourceAction` | `owner/branches/resources-actions.ts` | **Write** | BranchResourcesManager | ✅ Same as above | Looks up branch_id from DB first |
| `toggleBranchResourceActiveAction` | `owner/branches/resources-actions.ts` | **Write** | BranchResourcesManager | ✅ Same as above | Soft-deactivate |
| `getBranchBookingRules` | `src/lib/queries/branch-booking-rules.ts` | Read | Pages, actions | ✅ Safe | Returns null if table missing |
| `getBranchBookingRulesOrDefault` | `src/lib/queries/branch-booking-rules.ts` | Read | Pages, actions | ✅ Safe | Falls back to hardcoded defaults |
| `updateBranchBookingRules` | `src/lib/queries/branch-booking-rules.ts` | **Write** | `updateBranchBookingRulesAction` | ✅ `canManageBranchRules` | Owner = any; Manager = own branch |
| `validateBookingAgainstBranchRules` | `src/lib/queries/branch-booking-rules.ts` | Read | `inhouse-booking.ts`, `online-booking.ts` | ✅ Safe | Returns structured result |
| `isBookingTimeAllowedByRules` | `src/lib/queries/branch-booking-rules.ts` | Read | Validation helpers | ✅ Safe | Pure function |
| `isBookingDateAllowedByRules` | `src/lib/queries/branch-booking-rules.ts` | Read | Validation helpers | ✅ Safe | Pure function |
| `attachBranchResources` | `src/lib/queries/booking-resources.ts` | Read | Booking queries, staff portal | ✅ Read-only | Joins resource names onto booking rows |
| `isResourceAvailable` | `src/lib/engine/resource-availability.ts` | Read | Actions, API route | ✅ Read-only | Uses `createAdminClient` for capacity check |
| `autoAssignBookingResource` | `src/lib/engine/resource-availability.ts` | Read | Actions | ✅ Read-only | Finds first free resource by sort_order |
| `updateBookingStatusAction` | `manager/bookings/actions.ts` | **Write** | Booking lists, schedule | ⚠️ Partial | Blocks owner if `branch_id = null`; auto-assigns on confirm |
| `editBookingAction` | `manager/bookings/actions.ts` | **Write** | Booking lists, schedule details | ⚠️ Partial | Blocks owner if `branch_id = null`; checks resource availability |
| `createInhouseBookingMultiAction` | `src/lib/actions/inhouse-booking.ts` | **Write** | CRM in-house form | ✅ Safe | Auto-assigns resource; validates availability |
| `createWalkinBookingAction` | `manager/walkin/actions.ts` | **Write** | Walk-in form | ⚠️ Partial | Blocks owner if `branch_id = null` |
| `ownerUpdateBookingStatusAction` | `owner/bookings/actions.ts` | **Write** | Owner schedule/bookings | ✅ Owner-only | Cross-branch, no `branch_id` required |
| `ownerUpdateBookingPaymentAction` | `owner/bookings/actions.ts` | **Write** | Owner schedule/bookings | ✅ Owner-only | Cross-branch |
| `getMyBranchBookingRulesAction` | `owner/branches/actions.ts` | Read | Manager settings page | ✅ Requires manager or owner + `branch_id` | Returns branchId, rules, services |

---

## 6. Resource CRUD Findings

| Operation | Status | Who Can | How |
|-----------|--------|---------|-----|
| **Create resource** | ✅ Exists | Owner, Manager (own branch) | `BranchResourcesManager` → `createBranchResourceAction` |
| **Edit resource** | ✅ Exists | Owner, Manager (own branch) | Dialog form in `BranchResourcesManager` |
| **Activate/deactivate** | ✅ Exists | Owner, Manager (own branch) | Toggle button (Power icon) in resource list |
| **Hard delete** | ❌ Missing | — | Only soft-delete via `is_active = false` |
| **Assign to booking** | ✅ Exists | Manager, CRM, Owner | Schedule Details panel dropdown; Walk-in form dropdown; Auto-assign on confirmation |
| **Check availability** | ✅ Exists | Any authenticated user | `/api/manager/resource-check` + `isResourceAvailable()` |
| **Detect conflict** | ✅ Exists | Any authenticated user | `isResourceAvailable()` counts overlapping bookings vs capacity |
| **Auto-assign** | ✅ Exists | Backend only | `autoAssignBookingResource()` — finds first free resource |

---

## 7. Booking Rules Findings

**What exists:**
- `branch_booking_rules` table with one row per branch.
- `BranchBookingRulesForm` component (`branch-booking-rules-form.tsx`, 257 lines) — a form with time pickers, checkboxes, and number inputs for all rule fields.
- `branchBookingRulesSchema` Zod validation (`src/lib/validations/booking-rules.ts`).
- `DEFAULT_BRANCH_BOOKING_RULES` constants (`src/lib/bookings/booking-rules-config.ts`).
- Rules are validated during: public booking, in-house booking, walk-in booking, CRM booking creation.

**Where rules are used:**
1. **Public booking wizard** — `validateBookingAgainstBranchRules` blocks bookings outside allowed times/dates.
2. **In-house booking** (`createInhouseBookingMultiAction`) — same validation.
3. **Online booking** (`createOnlineBookingAction`) — same validation + home service eligibility.
4. **Available slots RPC** — `get_available_slots` does NOT currently enforce booking rules; the client-side/public wizard does.
5. **Walk-in form** — no explicit rule check in the walk-in action, but slots come from `get_available_slots` which inherently respects staff schedules.

**Where rules are edited:**
- Owner: inside `/owner/branches/[branchId]` page
- Manager: inside `/manager/settings` page (reuses the exact same `BranchBookingRulesForm` component)

---

## 8. Schedule Integration Findings

**What works:**
- `get_daily_schedule` RPC joins `branch_resources` and returns `resource_name` per booking.
- `ScheduleBookingBlock` displays `resource_name` when width allows (≥120px).
- `ScheduleDetailsPanel` shows "Room / Bed" row with the assigned resource name.
- `ScheduleDetailsPanel` has a "Space Assignment" dropdown to change the resource (calls `editBookingAction`).
- `updateBookingStatusAction` auto-assigns a resource when status changes to "confirmed" (if not home service and no resource already set).
- Off-duty overlays and blocked times display correctly; no resource-specific blocked times exist.

**What is broken/missing:**
- **Resource conflict preview in schedule details panel** is broken: the `SpaceAssignment` component just shows a dropdown and saves via `editBookingAction` — there is no live conflict preview before saving. The `/api/manager/resource-check` exists but is not called from the details panel.
- **No resource capacity visualization** in the schedule timeline — you cannot see at a glance that a shared area has 2 of 3 slots filled.
- **No resource-specific lane** in the day timeline — the timeline is staff-centric, not resource-centric. Two bookings in the same room appear on different staff rows.
- **Schedule alerts** do not currently warn about double-booked resources or missing resource assignments.

---

## 9. Booking / Public Flow Integration Findings

**Public booking wizard:**
- Customers **cannot choose** a room/bed. Resources are invisible to the public.
- Auto-assignment happens later when staff confirms the booking.
- Booking rules (time windows, max advance days, home service enabled) **do** affect available slots.
- No resource conflict checking in the public flow (correct — customer doesn't know about rooms).

**In-house / walk-in / CRM booking:**
- Staff **can** manually pick a resource in the walk-in form (`WalkinForm` has a dropdown).
- Live conflict check runs via `/api/manager/resource-check` when a resource is selected in the walk-in form.
- CRM in-house form (`createInhouseBookingMultiAction`) auto-assigns a resource if none provided, or validates if one is provided.
- Home service bookings skip resource assignment entirely.

**Auto-assignment logic:**
- Triggered on: booking confirmation (`updateBookingStatusAction`), walk-in creation (`createWalkinBookingAction`), in-house creation (`createInhouseBookingMultiAction`).
- Algorithm: fetch active resources ordered by `sort_order`, count overlapping bookings, pick first where `occupancy < capacity`.
- If no resource available, booking confirmation fails with error: "No room/bed is available for this time."

---

## 10. Components Found

| Component | File | Purpose | Used By | Issues |
|-----------|------|---------|---------|--------|
| `BranchResourcesManager` | `owner/branches/[branchId]/branch-resources-manager.tsx` (390 lines) | CRUD for branch resources: list, add dialog, edit dialog, toggle active | Owner branch detail page | Owner-only UI; not shared with manager |
| `BranchBookingRulesForm` | `owner/branches/[branchId]/branch-booking-rules-form.tsx` (257 lines) | Form for editing branch booking rules (times, buffers, driver capacity) | Owner branch detail + Manager settings | ✅ Already shared! Reused by both workspaces |
| `BranchEditForm` | `owner/branches/[branchId]/branch-edit-form.tsx` (215 lines) | Edit branch name, address, phone, slot interval, active toggle | Owner branch detail page | Owner-only |
| `BranchServicesPanel` | `owner/branches/[branchId]/branch-services-panel.tsx` (485 lines) | Manage services at branch: add/remove, spa/home eligibility, price, visibility | Owner branch detail + Manager settings | ✅ Already shared! `isOwner` prop controls features |
| `ScheduleDetailsPanel` | `schedule/schedule-details-panel.tsx` (364 lines) | Right panel in schedule: booking info, space assignment dropdown, actions | ScheduleWorkspace (all contexts) | Space assignment uses `editBookingAction` which blocks owner without branch_id |
| `ScheduleBookingBlock` | `schedule/schedule-booking-block.tsx` (157 lines) | Colored booking bar on timeline | DailyScheduleBoard | Shows resource_name when width allows |
| `WalkinForm` | `dashboard/walkin-form.tsx` (627 lines) | Walk-in booking creation form with optional resource picker | Manager walk-in page | Has `ResourceCheckWarning` sub-component for live conflict check |
| `CrmBookingQueuePanel` | `crm/today/crm-booking-queue-panel.tsx` (377 lines) | Today's booking cards with tabs and resource name display | CRM today page | Read-only resource display |

---

## 11. UX / Workflow Pain Points

- **Owner has no direct "Resources" or "Booking Rules" nav item.** Must go: Branches → click a branch → scroll to find the section. For multi-branch owners, this is tedious.
- **Branch detail page is overloaded.** It crams branch edit, booking rules, resources manager, services panel, and staff list into one two-column grid. No tabs.
- **Manager "Spaces" label is ambiguous.** The page is called "Space Utilization" but the nav says "Spaces" — implies management, but it's read-only.
- **Manager "Settings" is too broad.** Contains booking rules AND service availability. Could be split or renamed "Branch Settings".
- **No branch-level resource overview for owner.** Cannot see all rooms/beds across all branches in one view.
- **No resource-centric schedule view.** The timeline is staff-centric; resource conflicts are invisible until you click into booking details.
- **No resource capacity visualization.** A shared area with capacity 3 shows no indication of how many slots are used.
- **Resource check API is unguarded.** Any authenticated user can probe any branch's resource availability.
- **Owner blocked from manager booking actions.** If owner has `branch_id = null`, they cannot use `editBookingAction` or `updateBookingStatusAction` in the manager workspace.
- **No hard delete for resources.** Only deactivate. This may be intentional but should be documented.
- **Walk-in form resource picker shows all resources** without grouping by type or showing current occupancy.

---

## 12. Recommended Shared Workspace Structure

Following the pattern established by `ScheduleWorkspace`, create a shared `BranchResourcesWorkspace` component used by Owner, Manager, and (read-only) CRM.

```
BranchResourcesWorkspace
├── BranchResourcesToolbar
│   ├── BranchSelector (owner only)
│   ├── DatePicker (for utilization view)
│   └── Search / Filter
├── BranchResourcesKpiCards
│   ├── Total Spaces
│   ├── Active Spaces
│   ├── Overall Utilization %
│   ├── Unassigned Bookings Today
│   └── High-Utilization Alerts
├── BranchResourcesTabs
│   ├── Overview
│   ├── Spaces & Equipment
│   ├── Booking Rules
│   ├── Service Availability
│   └── Utilization Timeline
├── BranchResourcesMainPanel
│   └── (tab-specific content)
└── BranchResourcesDetailsPanel
    └── Selected space details / booking list / edit form
```

**Individual component responsibilities:**

| Component | Responsibility |
|-----------|---------------|
| `BranchResourcesWorkspace` | Orchestrator. Manages state (selected branch, active tab, selected resource, date). Fetches data. Delegates to panels. |
| `BranchResourcesToolbar` | Branch selector (owner), date picker, search filter, add-space button (if allowed). |
| `BranchResourcesKpiCards` | Compact metric cards: total spaces, active count, utilization %, unassigned bookings, driver capacity status. |
| `BranchResourcesTabs` | Tab switcher: Overview / Spaces / Rules / Services / Utilization. |
| `ResourceInventoryPanel` | Grid or list of all resources for the branch. Shows icon, name, type, capacity, status. Supports click-to-select. |
| `ResourceCard` | Individual resource card with occupancy indicator, assigned bookings count, active/inactive toggle. |
| `ResourceDetailsPanel` | Right-side panel showing selected resource: bookings assigned today, edit form, deactivate toggle. |
| `BookingRulesPanel` | Reuse existing `BranchBookingRulesForm`. Wrap in tab panel. |
| `ServiceAvailabilityPanel` | Reuse existing `BranchServicesPanel`. Wrap in tab panel. |
| `UtilizationPanel` | Reuse the logic from `/manager/resources/page.tsx` — daily occupancy bars per resource. |
| `ResourceConflictPreview` | Show overlapping bookings when editing a resource or assigning to a booking. |

---

## 13. Recommended Tabs / Layout

For the shared workspace, recommend these tabs based on actual code and user needs:

| Tab | Content | Owner | Manager | CRM |
|-----|---------|-------|---------|-----|
| **Overview** | KPI cards, quick stats, unassigned bookings alert, high-utilization warnings | ✅ Read + edit | ✅ Read + partial edit | ✅ Read-only |
| **Spaces & Equipment** | Resource inventory grid, add/edit/deactivate, capacity settings | ✅ Full CRUD | ✅ View-only (or edit if permissions allow) | ✅ Read-only |
| **Booking Rules** | In-spa hours, home service hours, travel buffer, max advance, driver capacity | ✅ Edit | ✅ Edit (own branch) | ❌ Read-only |
| **Service Availability** | Spa/home eligibility, visibility, custom pricing | ✅ Full | ✅ Eligibility only (existing behavior) | ❌ Read-only |
| **Utilization** | Daily occupancy per resource, date picker, booking slot list | ✅ Read | ✅ Read | ✅ Read-only |

**Layout recommendation:**
- Header with branch name + date + tab switcher
- KPI cards row below header
- Main area: tab content (full width for Utilization, two-column for Spaces with details panel)
- Keep the same 2-column layout pattern as ScheduleWorkspace where appropriate

---

## 14. Owner vs Manager vs CRM Behavior

### Owner
- **Branch scope:** Can view/switch between ALL branches.
- **Resource CRUD:** Full create, edit, deactivate for any branch.
- **Booking rules:** Full edit for any branch.
- **Service availability:** Full edit (eligibility, visibility, pricing).
- **Utilization:** Can view any branch's utilization.
- **Nav:** Should have a top-level "Branch Setup" or "Spaces & Rules" item (currently missing — only "Branches").

### Manager
- **Branch scope:** Locked to assigned branch. No branch selector.
- **Resource CRUD:** Currently none in UI. Could be enabled for own branch if desired (actions already support it via `requireOwnerOrManager`).
- **Booking rules:** Can edit own branch rules (already works via `/manager/settings`).
- **Service availability:** Can edit eligibility (spa/home) for own branch. Cannot edit visibility or pricing (owner-only).
- **Utilization:** Can view own branch utilization (already works).

### CRM
- **Branch scope:** Locked to assigned branch.
- **Resource CRUD:** None. Should remain read-only.
- **Booking rules:** Read-only (view in schedule details, but no edit).
- **Service availability:** Read-only.
- **Utilization:** Read-only.
- **Resource assignment:** Can assign resources when editing bookings via schedule details panel (if permissions allow).

---

## 15. Risks and Protected Files

### High-risk areas — do NOT break:
1. **`src/lib/engine/resource-availability.ts`** — Core conflict logic. `isResourceAvailable()` and `autoAssignBookingResource()` are called by booking creation/confirmation paths. Any bug here causes double-bookings.
2. **`src/lib/queries/branch-booking-rules.ts`** — Validation logic for all booking creation. Changing defaults or validation logic affects public booking.
3. **`src/app/(dashboard)/manager/bookings/actions.ts`** — `updateBookingStatusAction` auto-assigns resources on confirmation. Breaking this breaks the walk-in → confirm flow.
4. **`src/lib/actions/inhouse-booking.ts`** — CRM booking creation with auto-assign. Breaking this breaks front-desk booking.
5. **Public booking flow** (`src/app/(public)/book/**`) — Do not modify. Resources are invisible to customers by design.

### Medium-risk areas:
6. **`/api/manager/resource-check/route.ts`** — Used by walk-in form for live conflict preview. If changed, must maintain backward-compatible response shape `{available: boolean}`.
7. **`get_daily_schedule` RPC** — Returns `resource_id` and `resource_name`. The schedule board depends on these fields.

### Files to avoid touching during workspace unification:
- All public booking components and routes
- `src/lib/engine/slot-time.ts`, `src/lib/engine/availability.ts`
- Supabase migrations (do not create new ones for this task)
- Auth / proxy / middleware

---

## 16. Recommended Implementation Order

| Priority | Step | Why | Risk | Notes |
|----------|------|-----|------|-------|
| 1 | **Create shared `BranchResourcesWorkspace` shell** | Establishes the component architecture without touching existing pages | Low | Copy pattern from `ScheduleWorkspace` |
| 2 | **Build read-only Overview tab** | KPI cards + unassigned bookings + utilization summary. Safe to show all roles. | Low | Uses existing queries only |
| 3 | **Move `BranchBookingRulesForm` into shared workspace** | Already shared between owner/manager. Just relocate into tab panel. | Low | No logic changes |
| 4 | **Move `BranchServicesPanel` into shared workspace** | Already shared. Relocate into tab panel. | Low | `isOwner` prop already handles permissions |
| 5 | **Move `BranchResourcesManager` into Spaces tab** | Currently owner-only. Make it conditional based on workspace + permissions. | Medium | Needs `workspaceContext` prop like ScheduleWorkspace |
| 6 | **Add Utilization tab** | Port logic from `/manager/resources/page.tsx` into shared component. | Medium | Hardcoded 8am–10pm window should become dynamic from booking rules |
| 7 | **Create route wrappers** | `/owner/spaces` and `/manager/spaces` (or rename existing routes) rendering shared workspace. | Medium | Keep old routes working during transition |
| 8 | **Add nav items** | Owner gets "Spaces & Rules"; Manager keeps "Spaces" (now shared workspace). | Low | Update `nav-config.ts` |
| 9 | **Fix owner action blockage** | Make `editBookingAction` and `updateBookingStatusAction` owner-safe, OR ensure owner always uses owner-specific actions. | High | Critical for owner schedule → details panel workflow |
| 10 | **Secure resource-check API** | Add role/branch verification to `/api/manager/resource-check`. | Medium | Currently any authenticated user can probe any branch |

---

## 17. Files Likely to Touch Later

### New files to create:
- `src/components/features/resources/branch-resources-workspace.tsx`
- `src/components/features/resources/resource-toolbar.tsx`
- `src/components/features/resources/resource-kpi-cards.tsx`
- `src/components/features/resources/resource-tabs.tsx`
- `src/components/features/resources/resource-inventory-panel.tsx`
- `src/components/features/resources/resource-card.tsx`
- `src/components/features/resources/resource-details-panel.tsx`
- `src/components/features/resources/utilization-panel.tsx`
- `src/app/(dashboard)/owner/spaces/page.tsx` (or reuse `/owner/branches/[id]`)
- `src/app/(dashboard)/manager/spaces/page.tsx` (upgrade from current `/manager/resources`)

### Existing files to modify:
- `src/components/features/dashboard/nav-config.ts` — Add "Spaces & Rules" to owner nav
- `src/app/(dashboard)/owner/branches/[branchId]/page.tsx` — May simplify by delegating to shared workspace
- `src/app/(dashboard)/manager/resources/page.tsx` — Replace with shared workspace
- `src/app/(dashboard)/manager/settings/page.tsx` — May simplify by delegating to shared workspace
- `src/app/api/manager/resource-check/route.ts` — Add role/branch auth

### Existing files to reuse (no logic changes):
- `src/app/(dashboard)/owner/branches/[branchId]/branch-booking-rules-form.tsx`
- `src/app/(dashboard)/owner/branches/[branchId]/branch-services-panel.tsx`
- `src/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager.tsx` (relocate)
- `src/lib/queries/branch-booking-rules.ts`
- `src/lib/queries/booking-resources.ts`
- `src/lib/engine/resource-availability.ts`
- `src/app/(dashboard)/owner/branches/resources-actions.ts`

---

## 18. Open Questions Before Mockup

1. **Should the owner keep the existing `/owner/branches/[id]` compound page, or should branch detail be absorbed into the new shared workspace?**
   - Option A: Keep branch detail as-is, add new `/owner/spaces` top-level shared workspace.
   - Option B: Replace branch detail with tabbed sub-routes (`/owner/branches/[id]/spaces`, `/owner/branches/[id]/rules`).

2. **Should managers get resource CRUD in the shared workspace?**
   - The server actions already support it (`requireOwnerOrManager`).
   - Currently the UI hides it from managers.
   - Enabling it would let managers add rooms/beds without asking the owner.

3. **What should the nav label be?**
   - "Spaces & Rules" (combines resources + booking rules)
   - "Branch Setup" (broader, includes services)
   - Keep "Branches" for owner and add a separate "Spaces" item

4. **Should CRM see the shared workspace at all, or remain read-only via schedule/bookings only?**
   - CRM currently has no resource nav items.
   - Giving CRM a read-only "Spaces" tab might help with customer inquiries ("do you have a private room available?").

5. **Should the Utilization tab use the branch's actual operating hours from booking rules, or keep the hardcoded 8am–10pm?**
   - Currently `/manager/resources` hardcodes 8–22.
   - Booking rules have `inSpaStartTime` / `inSpaEndTime` per branch.

6. **Should resource hard-delete be added, or keep soft-delete only?**
   - Historical bookings reference resources via `resource_id`. Hard delete would break `ON DELETE SET NULL` or lose history.
   - Recommend keeping soft-delete only.

---

**Branch Resources / Booking Rules audit complete. Waiting for approval before designing the shared workspace mockup.**
