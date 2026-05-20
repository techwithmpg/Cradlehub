# HANDOFF — CRM-OPS-001

## Date
2026-05-21

## What Changed

### CRM Landing Route
**File:** `src/app/(dashboard)/crm/page.tsx`

Changed the CRM root redirect from `/crm/today` → `/crm/control`. CRM users now land directly in the main operations console instead of the "Today" summary page.

### Grouped CRM Navigation
**File:** `src/components/features/dashboard/nav-config.ts`

- Added `NavGroup` type: `{ label: string; items: NavItem[] }`.
- Updated `WorkspaceNav`: `items` is now optional (`items?: NavItem[]`), new optional `groups?: NavGroup[]` field added.
- Replaced the flat `CRM_NAV_ITEMS`, `CSR_HEAD_NAV_ITEMS`, `CSR_STAFF_NAV_ITEMS` arrays with grouped variants (`CRM_NAV_GROUPS`, `CSR_HEAD_NAV_GROUPS`, `CSR_STAFF_NAV_GROUPS`).
- Owner, Manager, Staff, Driver, Utility remain flat (backward-compatible; no changes to their nav).

**CRM groups (5 categories):**
1. **Main Operations** — Control, Live Map, Dispatch, Bookings, Schedule, Availability
2. **Customer Management** — Customers, Repeats, Lapsed, Waitlist
3. **Service & Resource Setup** — Services, Spaces
4. **Staff & Internal Work** — Staff Applications, Notifications
5. **Finance / End-of-day** — Reconciliation

Route mappings (existing routes used, new display labels):
- "Live Map" → `/crm/live-operations`
- "Availability" → `/crm/staff-availability`
- "Spaces" → `/crm/spaces-rules`

### Sidebar Grouped Rendering
**File:** `src/components/features/dashboard/sidebar.tsx`

- Extracted a `NavLink` helper component (handles icon, active state, accent bar, chevron).
- `SidebarContent` now checks for `nav.groups`: if present, renders category labels + items per group; otherwise falls back to flat `nav.items`.
- Added `CalendarClock` to lucide imports and `ICON_MAP` (was referenced in existing nav config but never rendered).
- Mobile hamburger + overlay still work for CRM routes; all grouped labels and links are scrollable on mobile.

## What Still Needs Phase 2

- **Live data wiring** for: Repeats, Lapsed, Waitlist, Reconciliation (currently functional placeholder pages)
- **Dispatch business logic** — auto-driver assignment, live ETA push
- **Availability real-time view** — checked-in/busy/off-duty staff status
- **Scheduling engine** — shift requests, branch support, auto-schedule
- **CRM-specific RLS policies** — currently relying on `manager`-level policies for some routes

## Files That Matter
- `src/components/features/dashboard/nav-config.ts` — CRM grouped nav config
- `src/components/features/dashboard/sidebar.tsx` — grouped rendering
- `src/app/(dashboard)/crm/page.tsx` — landing redirect

## Build / Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 83 app routes

## Git
- Branch: `main` — no branch or worktree created
