# Manager Workspace Audit

> **Scope:** Discovery-only audit of the Manager Workspace after recent shared-page changes (Bookings, Schedule, Staff, Spaces & Rules). No code changes. No redesign.
> **Date:** 2026-05-10

---

## 1. Executive Summary

The Manager Workspace currently has **9 nav items** pointing to **10 distinct routes** (plus redirect aliases). Of these:
- **5 routes use shared workspaces correctly** (Bookings, Schedule, Spaces & Rules, Staff Schedule, Notifications).
- **1 route is a large bespoke dashboard** (`/manager` — the Today page) that duplicates many shared concepts but does not reuse shared workspace components.
- **2 routes are static placeholder pages** (Operations, Reports) with no dynamic data.
- **1 legacy route remains** (`/manager/resources`) which is now redirected to `/manager/spaces-rules` but the old page file still exists.
- **1 walk-in action file exists without a dedicated page** — walk-in UI is embedded in the Bookings workspace.

The Manager branch resolution pattern is **duplicated across 8 files** with slight variations. Some pages use inline `allowedRoles` arrays that differ from each other. The Manager Settings page imports Owner components directly (acceptable but notable dependency).

The overall structure is functional but inconsistent in layout patterns — some pages use `PageHeader`, some use custom headers, some use shared workspaces, and some use bespoke inline JSX.

---

## 2. Manager Routes Found

| Route | File | Purpose | Status | Shared or Manager-specific? | Notes |
|---|---|---|---|---|---|
| `/manager` | `manager/page.tsx` | Today dashboard — bookings, stats, issues, quick actions, staff on duty | ✅ Live | **Manager-specific** | 588 lines, bespoke layout, does not reuse shared workspace |
| `/manager/today` | `manager/today/page.tsx` | Redirect alias → `/manager` | ✅ Live | Manager-specific | Thin redirect only |
| `/manager/schedule` | `manager/schedule/page.tsx` | Schedule timeline (Day/Week/Staff modes) | ✅ Live | **Shared** (`ScheduleWorkspace`) | Uses shared workspace correctly |
| `/manager/bookings` | `manager/bookings/page.tsx` | Booking list + details panel + payment actions | ✅ Live | **Shared** (`BookingsWorkspace`) | Uses shared workspace correctly |
| `/manager/bookings` | `manager/bookings/actions.ts` | Server actions: status transitions, edit, payment | ✅ Live | Manager-specific actions | Also revalidates `/crm/*` paths |
| `/manager/staff` | `manager/staff/page.tsx` | Staff schedule management (weekly hours, overrides, blocks) | ✅ Live | **Shared** (`StaffSchedulePageClient`) | Uses shared staff-schedule components |
| `/manager/staff` | `manager/staff/actions.ts` | Server actions: schedule CRUD, blocked time CRUD | ✅ Live | Manager-specific actions | Branch-scoped guards present |
| `/manager/staff/onboarding` | `manager/staff/onboarding/page.tsx` | Review/approve staff onboarding requests | ✅ Live | Manager-specific | Hard role gate excludes `assistant_manager` |
| `/manager/spaces-rules` | `manager/spaces-rules/page.tsx` | Spaces & Rules workspace (resources, booking rules, conflicts) | ✅ Live | **Shared** (`SpacesRulesWorkspace`) | Uses shared workspace correctly |
| `/manager/settings` | `manager/settings/page.tsx` | Branch settings: booking rules + branch services | ✅ Live | Manager-specific | Imports Owner components directly |
| `/manager/operations` | `manager/operations/page.tsx` | Operations tool directory | ⚠️ Static | Manager-specific | No dynamic data; links to other pages |
| `/manager/reports` | `manager/reports/page.tsx` | Reports landing page | ⚠️ Placeholder | Manager-specific | All reports "Coming Soon" |
| `/manager/notifications` | `manager/notifications/page.tsx` | Notification list | ✅ Live | **Shared** (`NotificationListClient`) | Simple wrapper |
| `/manager/resources` | `manager/resources/page.tsx` | Space utilization (legacy) | ⚠️ Legacy | Manager-specific | **Redirected** to `/manager/spaces-rules` via `next.config.ts` but file still exists |
| `/manager/walkin` | `manager/walkin/actions.ts` | Walk-in booking creation action | ⚠️ Orphan | Manager-specific action | **No page.tsx** — UI lives inside Bookings workspace modal |
| `/api/manager/context` | `api/manager/context/route.ts` | Branch context endpoint | ✅ Live | Manager API | Used by client-side modals |
| `/api/manager/resource-check` | `api/manager/resource-check/route.ts` | Resource availability check | ✅ Live | Manager API | Recently hardened with role/branch auth |

---

## 3. Current Manager Navigation

### Nav items (from `nav-config.ts`)

| # | Label | Route | Icon | Status |
|---|---|---|---|---|
| 1 | Today | `/manager` | LayoutDashboard | ✅ Live |
| 2 | Schedule | `/manager/schedule` | CalendarDays | ✅ Shared workspace |
| 3 | Bookings | `/manager/bookings` | ClipboardList | ✅ Shared workspace |
| 4 | Staff | `/manager/staff` | Users | ✅ Shared workspace |
| 5 | Spaces & Rules | `/manager/spaces-rules` | Building2 | ✅ Shared workspace |
| 6 | Operations | `/manager/operations` | Monitor | ⚠️ Static directory |
| 7 | Settings | `/manager/settings` | Settings | ✅ Live |
| 8 | Reports | `/manager/reports` | BarChart2 | ⏸️ Paused / placeholder |
| 9 | Notifications | `/manager/notifications` | Bell | ✅ Live |

### Issues

- **"Notifications" still appears as a dedicated nav item and page.** It is a simple list page. The user's latest instruction says "Do not include dedicated Notifications page" in the final nav, but it currently exists.
- **"Reports" is paused** but still appears in nav. Should be hidden or marked inactive.
- **"Operations" is a static link directory.** It does not provide unique functionality — every tool it links to is already accessible from the nav. This is a candidate for removal or redesign into a true "Today" control center.
- **Old `/manager/resources` nav item was renamed to "Spaces & Rules"** and points to the new route. The old page file still exists but is redirected.

---

## 4. Shared-Page Integration Check

| Workflow | Route | Shared component used? | Issue |
|---|---|---|---|
| Bookings | `/manager/bookings` | ✅ Yes — `BookingsWorkspace` | None. Thin server wrapper passes correct props. |
| Schedule | `/manager/schedule` | ✅ Yes — `ScheduleWorkspace` | None. Thin server wrapper passes correct props. |
| Staff | `/manager/staff` | ✅ Yes — `StaffSchedulePageClient` | None. Thin server wrapper fetches data and passes to shared client. |
| Spaces & Rules | `/manager/spaces-rules` | ✅ Yes — `SpacesRulesWorkspace` | None. Thin server wrapper passes `canSwitchBranch=false`. |

**All four shared workspaces are correctly integrated.** Each manager route is a thin Server Component that resolves the assigned branch, fetches scoped data, and delegates rendering to the shared workspace.

---

## 5. Manager-Specific Pages

### Truly manager-specific pages (not shared):

1. **`/manager` (Today Dashboard)** — The most important manager-specific page. Shows:
   - Today's bookings with status-colored left borders
   - Issue detection (home service prep, unassigned staff, overlapping schedules, bookings starting soon)
   - Quick actions sidebar
   - Staff on duty list
   - Stats cards (bookings, confirmed, in-progress, home service, completed, cancelled/no-show)
   - **This page does NOT reuse any shared workspace.** It is entirely bespoke inline JSX (588 lines).

2. **`/manager/settings`** — Branch settings. Renders `BranchBookingRulesForm` and `BranchServicesPanel` (imported from Owner routes). This is manager-specific because it only shows the manager's assigned branch.

3. **`/manager/staff/onboarding`** — Review staff onboarding requests. Uses `OnboardingReviewList` from Owner routes. Hard role gate (`system_role !== "manager"`) excludes assistant/store managers.

4. **`/manager/operations`** — Static tool directory. No unique functionality.

5. **`/manager/reports`** — Placeholder. All reports "Coming Soon".

6. **`/manager/notifications`** — Simple notification list wrapper.

7. **`/manager/resources`** (legacy) — Space utilization page. Now redirected. Still contains 409 lines of bespoke code showing resource utilization bars per room/bed.

---

## 6. Layout and UX Issues

### `/manager` (Today Dashboard)
- **Duplicated workspace identity strip** — custom "Operations Dashboard" banner at top, then `PageHeader` below it. Two headers saying the same thing.
- **Inconsistent with other workspaces** — Bookings, Schedule, Spaces & Rules all use shared workspace components with consistent KPI cards + tab layouts. Today page is a completely different visual pattern.
- **Hardcoded inline styles throughout** — not using Tailwind utility classes.
- **No right rail / detail panel pattern** — uses a two-column grid (bookings left, issues/actions/staff right) but this is not the same shared detail-panel component used by Bookings and Spaces.
- **Stat cards use `gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))"`** — on wide screens this becomes a very wide sparse row (6 cards spread across full width).

### `/manager/resources` (legacy, redirected)
- **Still exists as a file** — 409 lines of bespoke code. Should be removed or replaced with a redirect page.
- **Hardcoded business hours** (`OPEN_HOUR = 8`, `CLOSE_HOUR = 22`) — not branch-configurable.
- **Uses `<a href>` instead of `<Link>`** for "Back to Today".

### `/manager/settings`
- **Imports Owner components** (`BranchBookingRulesForm`, `BranchServicesPanel` from `owner/branches/[branchId]/`). This is acceptable but means Owner path changes could break Manager.
- **Two-column grid** (`1fr 1fr`) — on narrow viewports the forms get squeezed. No responsive breakpoint.

### `/manager/reports`
- **Fully placeholder** — no data, no charts, just emoji icons and text.

### `/manager/operations`
- **Static link directory** — every tool linked is already in the nav. No unique value.
- **"Coming Soon" section** lists 6 unimplemented modules.

### Cross-page layout inconsistencies
- Some pages use `PageHeader` with icon prop; some use custom headers.
- Some pages have KPI cards at the top; some don't.
- Some use `cs-card` class consistently; some use inline `style` blocks for card-like containers.
- The `ActionRequiredList` on `/manager` fetches its own data separately from the page data — potential for stale data.

---

## 7. Branch-Scope and Permission Issues

### Branch resolution duplication
- `getManagerContext()` or `getManagerBranchId()` is **copy-pasted with variations across 8 files**:
  - `manager/page.tsx`
  - `manager/bookings/page.tsx`
  - `manager/schedule/page.tsx`
  - `manager/staff/page.tsx`
  - `manager/spaces-rules/page.tsx`
  - `manager/settings/page.tsx` (uses `getMyBranchBookingRulesAction` instead)
  - `manager/resources/page.tsx` (legacy)
  - `manager/staff/onboarding/page.tsx`
- Each has slightly different dev bypass handling, role checks, and return shapes.

### Role list inconsistencies
- `manager/bookings/page.tsx` uses `allowedRoles = ["owner", "manager", "assistant_manager", "store_manager"]`
- `manager/resources/page.tsx` (legacy) uses `ALLOWED_ROLES = ["owner", "manager", "crm", "csr_head"]` — **CRM and CSR Head can access manager resources page?** This seems like a copy-paste error.
- `manager/staff/onboarding/page.tsx` hardcodes `system_role !== "manager"` — **excludes assistant_manager and store_manager.**

### Branch switching
- Manager pages correctly **do not allow branch switching** — all resolve `branch_id` from the staff record.
- The `SpacesRulesWorkspace` correctly receives `canSwitchBranch={false}`.
- The `BookingsWorkspace` and `ScheduleWorkspace` receive `branches={[{ id: branchId, name: branchName }]}` — single branch only.

### Cross-workspace data exposure
- **No issues found.** Manager pages only fetch data scoped to `branch_id`.
- Server actions (`manager/bookings/actions.ts`, `manager/staff/actions.ts`) check branch ownership before mutating.

---

## 8. Operational Workflow Gaps

### What the Manager CAN currently do:
- ✅ See today's schedule (Day/Week/Staff modes)
- ✅ See bookings list with status, payment, actions
- ✅ See staff schedule management (weekly hours, overrides, blocked times)
- ✅ See spaces/resources and booking rules (via Spaces & Rules workspace)
- ✅ See conflicts and missing assignments (via Conflicts tab)
- ✅ Manage branch booking rules and service availability (Settings)
- ✅ Review staff onboarding requests
- ✅ See notifications

### What the Manager CANNOT practically do from the Today dashboard:
- ❌ **See walk-in booking creation** — there is no dedicated walk-in page. The action exists but UI is embedded in Bookings workspace modal.
- ❌ **See booking status transitions inline** — the Today page shows `BookingActionMenu` per booking, but it's a compact three-dot menu. Status transitions (confirm, check-in, complete, no-show) are not surfaced as primary actions.
- ❌ **See payment actions from Today** — no payment status or quick-pay on the Today page.
- ❌ **See home service prep checklist** — home service bookings are flagged as "need prep" but no prep checklist or driver assignment UI exists.
- ❌ **See real-time resource conflicts** — conflicts are only visible on the Spaces & Rules page, not on Today or Schedule.
- ❌ **Quick-create a booking from Today** — no "+ New Booking" or "+ Walk-in" CTA on the Today page.

### Missing operational workflows:
1. **Walk-in / in-house booking creation** — no dedicated page or prominent CTA.
2. **Driver dispatch for home services** — listed in Operations "Coming Soon" but not implemented.
3. **Daily closing checklist** — listed in Operations "Coming Soon".
4. **Staff workload balancing** — listed in Operations "Coming Soon".
5. **Real-time conflict alerts on Today page** — overlaps and missing assignments are detected but only shown as a count badge, not as actionable cards.

---

## 9. Component Architecture Findings

### Oversized components
| Component | Lines | Issue |
|---|---|---|
| `manager/page.tsx` | 588 | Entirely bespoke Today dashboard. Should be split into sub-components or rebuilt as a workspace. |
| `manager/resources/page.tsx` (legacy) | 409 | Redundant since Spaces & Rules workspace exists. Should be removed. |
| `schedule-workspace.tsx` | 232 | Shared, acceptable size. |
| `bookings-workspace.tsx` | 301 | Shared, acceptable size. |
| `bookings-table.tsx` | 545 | Shared, large but justifiable for table complexity. |
| `spaces-rules-workspace.tsx` | 187 | Shared, well-sized. |

### Duplicated manager logic
- **Branch resolution** — duplicated in 8 files (see §7).
- **Relation helper** (`first<T>` or `readRelation`) — duplicated in multiple manager pages instead of using a shared utility.
- **Dev bypass logic** — slightly different in every page.

### Reusable components already available
- `BookingsWorkspace` — already shared with Owner and CRM.
- `ScheduleWorkspace` — already shared with Owner and CRM.
- `SpacesRulesWorkspace` — already shared with Owner and CRM.
- `StaffSchedulePageClient` — shared with Owner.
- `PageHeader` — used inconsistently; some pages use it, some don't.
- `StatCard` — used on Today page but not on other pages.
- `EmptyState` — used inconsistently.

### Components that should be extracted
- **Manager branch resolver** — a single shared `getManagerBranchId()` function for all manager pages.
- **Today dashboard** — should be rebuilt as a workspace using shared sub-components (KPI cards, booking list, issue list, quick actions).

### Old unused manager components
- `schedule-manager.tsx` (568 lines) — exists in `src/components/features/dashboard/` but is no longer used by the manager staff page (replaced by `staff-schedule-page-client.tsx`).
- `time-slot-grid.tsx` (208 lines) — may be unused; check before deleting.
- `staff-schedule-grid.tsx` (336 lines) — marked as deprecated in CHANGELOG but still in tree.

---

## 10. Recommended Manager Workspace Structure

### Proposed final nav (7 items):

| # | Label | Route | Purpose |
|---|---|---|---|
| 1 | **Today** | `/manager` | Daily control center: stats, bookings needing action, conflicts, quick actions, staff on duty |
| 2 | **Schedule** | `/manager/schedule` | Shared schedule workspace (Day/Week/Staff modes) |
| 3 | **Bookings** | `/manager/bookings` | Shared bookings workspace (list + details + payment) |
| 4 | **Staff** | `/manager/staff` | Shared staff schedule management |
| 5 | **Spaces & Rules** | `/manager/spaces-rules` | Shared spaces & rules workspace |
| 6 | **Operations** | `/manager/operations` | **Redesigned** — walk-in booking, driver dispatch (when ready), daily closing, issue log |
| 7 | **Settings** | `/manager/settings` | Branch booking rules + branch services |

### Removed from nav:
- **Reports** — paused, hide from nav until resumed.
- **Notifications** — remove dedicated nav item; keep notification bell in header (already exists).

### Redirects to add:
- `/manager/resources` → `/manager/spaces-rules` (already done in `next.config.ts`)
- `/manager/reports` → `/manager` (or show a "Reports coming soon" inline banner)

---

## 11. Recommended Implementation Order

| Priority | Page | Why first | Risk | Shared or Manager-specific | Suggested action |
|---|---|---|---|---|---|
| P0 | **Extract shared branch resolver** | Unblocks all other manager page refactors; reduces 8 copies to 1 | Low | Shared utility | Create `src/lib/queries/manager-context.ts` with `getManagerBranchId()` |
| P1 | **Today (`/manager`)** | Most important manager page; currently bespoke and inconsistent | Medium | Manager-specific | Rebuild as workspace using shared KPI cards, booking list, issue panel. Add "+ New Booking" / "+ Walk-in" CTAs. |
| P2 | **Remove legacy `/manager/resources`** | Dead code; 409 lines | Low | Manager-specific | Delete page file; redirect already exists |
| P3 | **Redesign Operations (`/manager/operations`)** | Currently useless link directory; should host walk-in creation | Medium | Manager-specific | Add walk-in booking form. Keep "Coming Soon" modules as placeholders. |
| P4 | **Hide Reports from nav** | Paused feature should not appear in nav | Low | Config only | Remove from `nav-config.ts` |
| P5 | **Hide Notifications from nav** | Bell in header is sufficient | Low | Config only | Remove from `nav-config.ts` |
| P6 | **Settings responsive layout** | Two-column grid breaks on narrow viewports | Low | Manager-specific | Add responsive breakpoint or use stacked layout |
| P7 | **Onboarding role gate fix** | Excludes assistant_manager | Low | Manager-specific | Use `isManager()` from permissions instead of hardcoded string |
| P8 | **Remove unused components** | Dead code in tree | Low | Cleanup | Delete `schedule-manager.tsx`, `staff-schedule-grid.tsx` if confirmed unused |

---

## 12. Files Likely to Touch Later

### By page/workflow:

**Today Dashboard:**
- `src/app/(dashboard)/manager/page.tsx`
- `src/components/features/dashboard/stat-card.tsx`
- `src/components/features/dashboard/empty-state.tsx`
- `src/components/features/notifications/action-required-list.tsx`

**Operations:**
- `src/app/(dashboard)/manager/operations/page.tsx`
- `src/app/(dashboard)/manager/walkin/actions.ts`
- `src/components/features/dashboard/walkin-form.tsx`

**Settings:**
- `src/app/(dashboard)/manager/settings/page.tsx`
- `src/app/(dashboard)/owner/branches/[branchId]/branch-booking-rules-form.tsx`
- `src/app/(dashboard)/owner/branches/[branchId]/branch-services-panel.tsx`

**Nav cleanup:**
- `src/components/features/dashboard/nav-config.ts`

**Shared utilities:**
- `src/lib/queries/manager-context.ts` (to be created)

**Cleanup:**
- `src/app/(dashboard)/manager/resources/page.tsx`
- `src/components/features/dashboard/schedule-manager.tsx`
- `src/components/features/dashboard/staff-schedule-grid.tsx`

---

## 13. Files to Avoid

| Area | Files/Patterns | Reason |
|---|---|---|
| Auth | `src/proxy.ts`, `src/app/(auth)/*`, `src/lib/supabase/*` | Do not change auth flow |
| RBAC | `src/lib/permissions.ts` | Read-only for reference; do not modify role constants |
| Database schema | `supabase/migrations/*`, `src/types/supabase.ts` | No migrations in this phase |
| Booking engine | `src/lib/engine/*` | Core availability logic; do not touch |
| Public booking | `src/app/(public)/*`, `src/components/public/*` | Out of scope |
| Payment logic | `src/lib/actions/online-booking.ts`, payment status badges | Out of scope |
| Shared workspaces | `src/components/features/bookings/*`, `src/components/features/schedule/*`, `src/components/features/spaces-rules/*`, `src/components/features/staff/*` | Read-only; these are already shared and working |

---

## 14. Open Questions Before Design

1. **Should the Today page become a shared workspace** (like Bookings/Schedule/Spaces), or remain manager-specific?
   - Owner also has a Today page (`/owner`) but it is a different design (overview dashboard with branch selector).
   - CRM has `/crm/today` which is a daily operations queue.
   - **Recommendation:** Keep Manager Today manager-specific but extract reusable sub-components (KPI cards, issue list, quick actions) so Owner/CRM can optionally use them.

2. **Where should walk-in booking UI live?**
   - Currently only accessible via modal from Bookings workspace.
   - Should it have a dedicated page under Operations?
   - Should it be a prominent CTA on the Today page?

3. **Should Operations be a true page or just a set of tools accessible from Today?**
   - Current Operations page is a link directory with no unique value.
   - If walk-in creation, driver dispatch, and daily closing are the real tools, they might be better surfaced as CTAs on Today + dedicated routes.

4. **What happens to the old `/manager/resources` page?**
   - File still exists. The redirect is in `next.config.ts`.
   - Should we delete the file now or keep it as a safety fallback?

5. **Should Reports be completely hidden or shown as a disabled nav item?**
   - User said "paused" — hiding entirely is cleaner.

6. **Should Notifications have a dedicated page or just the header bell?**
   - User said "Do not include dedicated Notifications page" in final nav.
   - The page exists and works. Should it be removed or just hidden from nav?

---

**Manager Workspace audit complete. Waiting for approval before designing the first Manager page.**
