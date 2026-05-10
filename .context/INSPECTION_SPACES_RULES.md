# Inspection Report: Spaces & Rules Shared Workspace

> **Date:** 2026-05-10
> **Task:** Create shared "Spaces & Rules" workspace for Owner and Manager
> **Status:** Inspection complete — NO CODE EDITED YET

---

## 1. Existing Owner Branch Detail Page

**File:** `src/app/(dashboard)/owner/branches/[branchId]/page.tsx` (169 lines)

**Structure:**
- Two-column grid (`1fr 1fr`) layout
- Left column: `BranchEditForm`, `BranchBookingRulesForm`, `BranchResourcesManager`
- Right column: Staff list, `BranchServicesPanel`
- Fetches: `getBranchDetailAction`, `getBranchBookingRulesOrDefault`, `getAllActiveServices`
- Types defined inline: `BranchRow`, `ResourceRow`, `StaffLite`, `ServiceLite`, `BranchDetailPayload`

**Key observation:** This page does NOT use a shared workspace pattern. It's a direct composition of local components. The components it uses are the ones we need to extract/reuse.

---

## 2. Existing Owner Branch Resource Manager

**File:** `src/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager.tsx` (390 lines)

**What it does:**
- "Spaces & Equipment" section header with "Add Space" button
- Resource list with icon, name, type, capacity
- Edit dialog (pencil icon) → opens `ResourceForm` in Dialog
- Toggle active/inactive (power icon) → calls `toggleBranchResourceActiveAction`
- Add dialog (plus button) → opens `ResourceForm` in Dialog
- `ResourceForm` handles both create and edit via conditional `resource` prop
- Uses `RESOURCE_TYPES` from `@/lib/validations/branch`
- Emoji icons for resource types: 🚪🛌🪑⚙️🚗👥📦

**Actions used:**
- `createBranchResourceAction`
- `updateBranchResourceAction`
- `toggleBranchResourceActiveAction`
- All from `@/app/(dashboard)/owner/branches/resources-actions`

**Client component:** Yes (`"use client"`)

**Props interface:**
```ts
{ branchId: string; resources: ResourceRow[] }
```

**Can this be reused in shared workspace?** YES — with minimal changes. Need to add `canManage` prop to conditionally hide Add/Edit/Toggle buttons for read-only contexts.

---

## 3. Existing Owner Branch Booking Rules Form

**File:** `src/app/(dashboard)/owner/branches/[branchId]/branch-booking-rules-form.tsx` (257 lines)

**What it does:**
- "Booking Rules" section header
- Form with: in-spa start/end times, home service checkbox, home service start/end, travel buffer, max advance days, driver capacity
- Uses `useActionState` for form submission
- Calls `updateBranchBookingRulesAction` from `owner/branches/actions`
- Success/error inline banners
- `EditField` helper for consistent input styling

**Client component:** Yes (`"use client"`)

**Props interface:**
```ts
{ rules: BranchBookingRules }
```

**CRITICAL FINDING:** This component is ALREADY shared between Owner and Manager. The Manager settings page (`/manager/settings`) imports and renders this exact same component. No changes needed to the form itself — just relocate it into the shared workspace.

---

## 4. Existing Manager Resources Page

**File:** `src/app/(dashboard)/manager/resources/page.tsx` (409 lines)

**What it does:**
- Server Component — fetches branch resources + bookings for selected date
- `getManagerContext()` resolves branch from staff record (same pattern as schedule)
- Date picker (now extracted to `date-picker-form.tsx` client component)
- KPI cards: Spaces count, Overall %, High Use count
- Resource utilization cards with progress bars, booking slot lists
- Hardcoded hours: 8am–10pm (`OPEN_HOUR = 8`, `CLOSE_HOUR = 22`)
- Shows unassigned bookings warning
- Empty state directs to owner branch detail page

**Data fetched:**
- `branch_resources` (active only)
- `bookings` with customer/service/staff joins for selected date

**Can logic be reused?** YES — the utilization calculation, progress bars, and booking slot rendering can be extracted into shared components. The page itself will be replaced by the shared workspace.

---

## 5. Existing Manager Settings Page

**File:** `src/app/(dashboard)/manager/settings/page.tsx` (57 lines)

**What it does:**
- Thin wrapper calling `getMyBranchBookingRulesAction()`
- Renders `BranchBookingRulesForm` (shared) + `BranchServicesPanel` (shared with `isOwner={false}`)
- Two-column grid layout
- Calls `ensureBranchSetupWarningNotifications(branchId)`

**Key finding:** This page ALREADY reuses shared components. The shared workspace will absorb this functionality.

---

## 6. Existing BranchBookingRulesForm

**Already inspected in section 3.**

**Reusability verdict:** ✅ ALREADY SHARED — no changes needed.

---

## 7. Existing BranchServicesPanel

**File:** `src/app/(dashboard)/owner/branches/[branchId]/branch-services-panel.tsx` (485 lines)

**What it does:**
- Service list with active count header
- Per-service: name, duration, price, eligibility toggles (spa/home), visibility select
- `isOwner` prop controls: price editing, visibility editing, remove button
- `AddServiceRow` for adding new services from catalog
- All actions from `owner/branches/actions.ts`

**Reusability verdict:** ✅ ALREADY SHARED via `isOwner` prop. Can be rendered in shared workspace with `isOwner={workspaceContext === "owner"}`.

---

## 8. Existing Branch Resources Queries/Actions

**File:** `src/app/(dashboard)/owner/branches/resources-actions.ts` (143 lines)

**Functions:**
| Function | Auth | Safe for Manager? |
|----------|------|-------------------|
| `createBranchResourceAction` | `requireOwnerOrManager(branchId)` | ✅ Yes, own branch only |
| `updateBranchResourceAction` | `requireOwnerOrManager(existing.branch_id)` | ✅ Yes, own branch only |
| `toggleBranchResourceActiveAction` | `requireOwnerOrManager(existing.branch_id)` | ✅ Yes, own branch only |
| `getBranchResourcesAction` | RLS only | ✅ Read-only, safe |

**Verdict:** Managers CAN create/edit/deactivate resources for their own branch. The actions already support it. The UI just hasn't exposed it to managers yet.

---

## 9. Existing Branch Booking Rules Queries/Actions

**File:** `src/lib/queries/branch-booking-rules.ts` (303 lines)

**Functions:**
| Function | Auth | Safe for Manager? |
|----------|------|-------------------|
| `getBranchBookingRules` | `createAdminClient` (read) | ✅ Safe |
| `getBranchBookingRulesOrDefault` | Delegates | ✅ Safe |
| `updateBranchBookingRules` | `canManageBranchRules()` — owner any, manager own | ✅ Yes, own branch only |
| `isBookingTimeAllowedByRules` | Pure | ✅ Safe |
| `isBookingDateAllowedByRules` | Pure | ✅ Safe |
| `validateBookingAgainstBranchRules` | Reads rules | ✅ Safe |

**Verdict:** Managers can already edit booking rules for their own branch. The `canManageBranchRules` function explicitly allows managers for their own branch.

---

## 10. Existing Resource Availability Engine

**File:** `src/lib/engine/resource-availability.ts` (101 lines)

**Functions:**
- `isResourceAvailable()` — capacity-aware conflict check
- `autoAssignBookingResource()` — finds first free resource

**Both use `createAdminClient()` for reads only.**

**PROTECTED FILE — DO NOT REWRITE.** Only read. Any bug here causes double-bookings.

---

## 11. Existing Resource Check API

**File:** `src/app/api/manager/resource-check/route.ts` (36 lines)

**Current behavior:**
1. Checks auth (`auth.getUser()`)
2. Validates query params
3. Calls `isResourceAvailable()`
4. Returns `{available: boolean}`

**Security gap:** Only verifies user is logged in. Does NOT verify:
- Role (any authenticated user can call)
- Branch ownership (can probe any resource ID)

**Required fix:** Add branch authorization. Options:
- Look up resource's branch_id, then verify user has access to that branch
- Reuse existing `requireOwnerOrManager` pattern from resources-actions
- Since this is an API route (not server action), need inline auth check

**Safe fix approach:**
```ts
// 1. Get resource's branch_id
// 2. Get user's staff record
// 3. Allow if owner OR (manager && branch_id matches)
// 4. Return 403 if not allowed
```

---

## 12. Existing Sidebar/Nav Config

**File:** `src/components/features/dashboard/nav-config.ts`

**Owner nav items:** Overview, Schedule, Bookings, Reports, Marketing Studio, Branches, Staff, Services, Notifications, Dev Panel
**Manager nav items:** Today, Schedule, Bookings, Staff, Spaces, Operations, Settings, Reports, Notifications

**Required changes:**
- Owner: Add "Spaces & Rules" (`/owner/spaces-rules`) — position after "Branches" or replace nothing
- Manager: Change "Spaces" href from `/manager/resources` to `/manager/spaces-rules`
- Manager: Keep "Settings" for now (backward compat), or remove later
- CRM: No changes

**File:** `src/components/features/dashboard/sidebar.tsx`

**ICON_MAP** lists available Lucide icons. Need to add `Settings2` or `Building2` or `Armchair` for Spaces & Rules icon. Current available icons include: `Activity`, `Building2`, `Monitor`, `Settings`, etc.

**Lucide icons available in project:** The sidebar imports specific icons. We can use `Building2` or `Settings2` or `Armchair` (need to check if imported). Current imports: `LayoutDashboard, CalendarDays, Building2, Users, Sparkles, UserPlus, ClipboardList, Heart, Sun, BarChart2, ClockAlert, Menu, X, TrendingUp, BookOpen, Clock, UserCheck, Activity, ChevronRight, Truck, Wrench, Monitor`.

For "Spaces & Rules", `Building2` is already imported and used for "Branches". Could use `Settings2` (not imported) or reuse `Activity` (already imported, used for current "Spaces"). Let's add `Settings2` to imports for distinct icon.

---

## 13. Existing Manager Branch-Resolution Logic

**Pattern found in:**
- `src/app/(dashboard)/manager/schedule/page.tsx`
- `src/app/(dashboard)/manager/resources/page.tsx`

**Standard pattern:**
```ts
async function getManagerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Dev bypass
  if (isDevAuthBypassEnabled()) { ... }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me?.branch_id) redirect("/login");
  return { branchId: me.branch_id, branchName: ... };
}
```

**Owner pattern:**
```ts
async function getOwnerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!me || me.system_role !== "owner") redirect("/login");
}
```

**These patterns are safe to copy/reuse for the new route wrappers.**

---

## 14. Exact Files to Create/Edit

### NEW FILES (create)

| File | Purpose | Lines est. |
|------|---------|------------|
| `src/app/(dashboard)/owner/spaces-rules/page.tsx` | Owner route wrapper | ~80 |
| `src/app/(dashboard)/manager/spaces-rules/page.tsx` | Manager route wrapper | ~60 |
| `src/components/features/spaces-rules/spaces-rules-workspace.tsx` | Shared orchestrator | ~200 |
| `src/components/features/spaces-rules/spaces-rules-header.tsx` | Title + branch controls | ~80 |
| `src/components/features/spaces-rules/spaces-rules-kpi-cards.tsx` | 5 KPI cards | ~80 |
| `src/components/features/spaces-rules/spaces-rules-tabs.tsx` | Tab switcher | ~60 |
| `src/components/features/spaces-rules/overview-tab.tsx` | Overview tab content | ~150 |
| `src/components/features/spaces-rules/spaces-tab.tsx` | Spaces tab (resource list) | ~120 |
| `src/components/features/spaces-rules/space-detail-panel.tsx` | Right rail detail | ~100 |
| `src/components/features/spaces-rules/booking-rules-tab.tsx` | Booking rules tab wrapper | ~40 |
| `src/components/features/spaces-rules/conflicts-tab.tsx` | Conflicts read-only view | ~100 |
| `src/components/features/spaces-rules/spaces-rules-utils.ts` | Pure helpers | ~30 |

### MODIFIED FILES (edit)

| File | Change | Risk |
|------|--------|------|
| `src/components/features/dashboard/nav-config.ts` | Add "Spaces & Rules" to owner, update manager "Spaces" href | Low |
| `src/components/features/dashboard/sidebar.tsx` | Add `Settings2` to ICON_MAP imports | Low |
| `src/app/api/manager/resource-check/route.ts` | Add branch auth check | Medium — test carefully |

### REUSED WITHOUT MODIFICATION

| File | How used |
|------|----------|
| `src/app/(dashboard)/owner/branches/[branchId]/branch-booking-rules-form.tsx` | Imported into `booking-rules-tab.tsx` |
| `src/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager.tsx` | Imported into `spaces-tab.tsx` (with `canManage` prop) |
| `src/app/(dashboard)/owner/branches/[branchId]/branch-services-panel.tsx` | Optional — can add Services sub-tab later |
| `src/lib/queries/branch-booking-rules.ts` | Called from route wrappers |
| `src/lib/queries/branches.ts` | Called from route wrappers |
| `src/app/(dashboard)/owner/branches/resources-actions.ts` | Actions passed through to client components |

### LEFT COMPLETELY UNTOUCHED

| File | Why |
|------|-----|
| `src/app/(dashboard)/owner/branches/[branchId]/page.tsx` | Branch detail remains functional |
| `src/app/(dashboard)/owner/branches/[branchId]/branch-edit-form.tsx` | Branch management stays separate |
| `src/lib/engine/resource-availability.ts` | Core conflict engine — never touch |
| `src/lib/engine/availability.ts` | Slot engine — never touch |
| `src/lib/engine/slot-time.ts` | Time math — never touch |
| `src/lib/actions/inhouse-booking.ts` | Booking creation — never touch |
| `src/app/(dashboard)/manager/bookings/actions.ts` | Status transitions — never touch |
| `src/app/(dashboard)/manager/walkin/actions.ts` | Walk-in creation — never touch |
| All public booking routes | Out of scope |
| All payment logic | Out of scope |
| All auth/middleware | Out of scope |
| All Supabase migrations | Out of scope |

---

## 15. Resource Check API Safety Fix Plan

**Current code:**
```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401;
// Then checks resource availability for ANY resourceId
```

**Safe fix:**
```ts
// After getting user, look up their staff record
const { data: me } = await supabase
  .from("staff")
  .select("system_role, branch_id")
  .eq("auth_user_id", user.id)
  .eq("is_active", true)
  .maybeSingle();

// Look up resource's branch_id
const { data: resource } = await supabase
  .from("branch_resources")
  .select("branch_id")
  .eq("id", resourceId)
  .single();

// Authorize
const allowed = 
  me?.system_role === "owner" ||
  (me?.branch_id && me.branch_id === resource?.branch_id);
  
if (!allowed) return 403;
```

This is a ~15-line surgical addition. No existing logic is changed, only guarded.

---

## 16. Data Flow Plan

### Owner route (`/owner/spaces-rules`)

```
page.tsx (Server Component)
├── getOwnerContext() → verify owner
├── getAllBranches() → branch selector options
├── resolve selectedBranchId from ?branchId= (default first branch)
├── getBranchWithFullDetail(selectedBranchId) → resources, services
├── getBranchBookingRulesOrDefault(selectedBranchId) → rules
├── fetch today's bookings for conflict detection
└── <SpacesRulesWorkspace
      workspaceContext="owner"
      branchId={...}
      branchName={...}
      branches={[{id, name}, ...]}  ← branch selector data
      resources={...}
      rules={...}
      services={...}  ← optional for future services tab
      bookings={...}  ← today's bookings for conflict calc
      canSwitchBranch={true}
      canManageResources={true}
      canEditRules={true}
    />
```

### Manager route (`/manager/spaces-rules`)

```
page.tsx (Server Component)
├── getManagerContext() → resolve branch from staff record
├── getBranchWithFullDetail(branchId) → resources
├── getBranchBookingRulesOrDefault(branchId) → rules
├── fetch today's bookings for conflict detection
└── <SpacesRulesWorkspace
      workspaceContext="manager"
      branchId={...}
      branchName={...}
      branches={[{id, name}]}  ← single item, locked
      resources={...}
      rules={...}
      bookings={...}
      canSwitchBranch={false}
      canManageResources={true}  ← actions already allow it
      canEditRules={true}        ← actions already allow it
    />
```

---

## 17. Component Architecture

Following the `ScheduleWorkspace` pattern:

```
SpacesRulesWorkspace ("use client")
├── state: activeTab, selectedResourceId, searchQuery, typeFilter, statusFilter
├── SpacesRulesHeader
│   ├── Title + subtitle
│   └── BranchSelector (conditional) OR LockedBranchPill
├── SpacesRulesKpiCards
│   ├── Total Spaces
│   ├── Available Today
│   ├── Active Rules
│   ├── Conflicts
│   └── Missing Assignments
├── SpacesRulesTabs
│   ├── Overview
│   ├── Spaces
│   ├── Booking Rules
│   └── Conflicts
├── Main Content Area (tab-dependent)
│   ├── OverviewTab → inventory summary + rules summary + conflict summary
│   ├── SpacesTab → BranchResourcesManager + filtering
│   ├── BookingRulesTab → BranchBookingRulesForm + RuleImpactPreview
│   └── ConflictsTab → derived conflict list
└── SpaceDetailPanel (right rail, 320px)
    ├── Selected resource details
    ├── Today's usage
    ├── Next booking
    └── Quick actions
```

---

## 18. Conflict Detection Logic (Client-Side Derived)

From inspection of `ScheduleWorkspace.computeAlerts()`, the schedule already computes:
- Missing assignments (`!booking.resource_id`)
- Room conflicts (overlapping bookings on same resource)
- Travel buffer risks (home service)

We can reuse this same logic in the Conflicts tab, but derived from the bookings data passed from the server wrapper instead of schedule rows.

**Algorithm (pure function, no DB queries):**
```ts
function computeResourceConflicts(bookings: Booking[], resources: Resource[]) {
  const conflicts = [];
  
  // 1. Missing assignments
  for (const b of bookings) {
    if (b.type !== "home_service" && !b.resource_id) {
      conflicts.push({ type: "missing_assignment", ... });
    }
  }
  
  // 2. Overlapping resource bookings
  const byResource = groupBy(bookings, b => b.resource_id);
  for (const [resourceId, list] of byResource) {
    if (list.length > 1) {
      // Check all pairs for overlap
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (overlaps(list[i], list[j])) {
            conflicts.push({ type: "overlap", ... });
          }
        }
      }
    }
  }
  
  // 3. Capacity overflow
  for (const resource of resources) {
    const resourceBookings = byResource.get(resource.id) ?? [];
    // For each time slot, count how many bookings overlap
    // If count > capacity, flag overflow
  }
  
  return conflicts;
}
```

This is 100% client-side, read-only, and uses data already fetched by the server wrapper.

---

## 19. Manager /manager/resources Backward Compatibility

**Options:**

A. **Redirect:** `/manager/resources` → redirect to `/manager/spaces-rules`
   - Pro: Clean, single source of truth
   - Con: Breaks any external bookmarks

B. **Thin wrapper:** `/manager/resources` renders same workspace but defaults to Utilization view
   - Pro: Backward compatible
   - Con: Two routes rendering same thing

C. **Keep old page, add new nav:** `/manager/resources` stays, `/manager/spaces-rules` is new
   - Pro: Zero breakage
   - Con: Confusing duplication

**Recommendation: Option A (redirect)** — update nav to point to new route, add redirect in old page. The old page has no complex state or URLs worth preserving (only `?date=` query param which is trivial).

---

## 20. Acceptance Criteria Checklist

| # | Criteria | Plan |
|---|----------|------|
| 1 | New shared workspace exists | ✅ `SpacesRulesWorkspace` component |
| 2 | Owner has `/owner/spaces-rules` | ✅ New route wrapper |
| 3 | Manager has `/manager/spaces-rules` | ✅ New route wrapper |
| 4 | Owner can switch/select branch | ✅ `branches` prop + branch selector |
| 5 | Manager is branch-locked | ✅ `canSwitchBranch={false}`, single branch in array |
| 6 | CRM does not get full page/nav | ✅ No nav item, no route |
| 7 | Branches remain Owner-specific | ✅ `/owner/branches` untouched |
| 8 | Header + KPI + tabs + detail panel | ✅ Architecture defined |
| 9 | Tabs: Overview, Spaces, Rules, Conflicts | ✅ All 4 planned |
| 10 | Booking Rules reuses existing form | ✅ `BranchBookingRulesForm` imported directly |
| 11 | Spaces uses existing data/actions | ✅ `BranchResourcesManager` imported with `canManage` prop |
| 12 | Overview shows inventory + rules + conflicts | ✅ 3 sub-panels |
| 13 | Conflicts is read-only | ✅ Client-side derived only |
| 14 | Existing utilization logic preserved | ✅ Extracted from manager/resources/page.tsx |
| 15 | Owner branch detail untouched | ✅ No edits to `[branchId]/page.tsx` |
| 16 | Resource check API guarded | ✅ Surgical auth addition |
| 17 | No auth/RBAC rewrite | ✅ Reuse existing patterns |
| 18 | No schema changes | ✅ Zero migrations |
| 19 | No booking engine changes | ✅ `resource-availability.ts` untouched |
| 20 | Type-check, lint, build pass | ✅ Will verify after each phase |

---

## 21. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BranchResourcesManager doesn't work outside branch detail context | Low | Medium | Test import paths; component has no hardcoded branch-detail dependencies |
| Manager resource CRUD exposes too much | Low | High | Actions already have `requireOwnerOrManager` with branch check; verify before enabling UI |
| Resource check API break | Low | High | Surgical fix only adds auth guard; preserve response shape |
| Nav config changes break sidebar | Low | Medium | Add icon to ICON_MAP; test build |
| Conflicts tab shows false positives | Medium | Low | Mark as "beta/detection preview" in UI; pure client-side, no DB writes |
| Build fails due to import cycles | Low | Medium | Keep imports one-directional: workspace → existing components |

---

## 22. Implementation Order (Safest)

| Step | Action | Why First |
|------|--------|-----------|
| 1 | Create `spaces-rules/` component directory + `spaces-rules-workspace.tsx` shell | Establishes foundation |
| 2 | Create Owner + Manager route wrappers (thin, data-fetching only) | Provides data to workspace |
| 3 | Create `spaces-rules-header.tsx` + `spaces-rules-kpi-cards.tsx` | Safe presentational components |
| 4 | Create `spaces-rules-tabs.tsx` + tab shell components | Layout scaffolding |
| 5 | Build **Booking Rules** tab (reuse `BranchBookingRulesForm`) | Lowest risk — already shared |
| 6 | Build **Spaces** tab (reuse `BranchResourcesManager`) | Medium risk — need `canManage` prop |
| 7 | Build **Overview** tab (inventory + rules summary) | Uses data already passed |
| 8 | Build **Conflicts** tab (client-side derived) | No backend risk |
| 9 | Build `space-detail-panel.tsx` right rail | Cosmetic, low risk |
| 10 | Update nav config + sidebar icon imports | Navigation wiring |
| 11 | Fix resource-check API auth | Security fix |
| 12 | Handle `/manager/resources` redirect/backward compat | Cleanup |
| 13 | Verify type-check + lint + build | Quality gate |
| 14 | Update context files (CHANGELOG, CURRENT_TASK, HANDOFF) | Documentation |

---

**END OF INSPECTION REPORT**

**Ready to proceed with implementation upon approval.**
