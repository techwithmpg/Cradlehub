# CRM Internal Tabs Risk Audit

> Audit date: 2026-05-30
> Scope: CRM workspaces under `/crm/*`
> Rule: No code changes were made in this audit.

---

## Executive Summary

| Page | Current Pattern | Internal-Tab Ready? | Recommendation |
|------|-----------------|---------------------|----------------|
| **Today** (`/crm/today`) | Already internal tabs via `useSearchParams` + `router.replace` | ✅ Yes — ideal pattern | No change needed |
| **Schedule** (`/crm/schedule`) | Already internal tabs via `useSearchParams` + `router.replace` | ✅ Yes — ideal pattern | No change needed |
| **Services** (`/crm/services`) | Route-link `CrmTabNav`, but workspace already holds tab state in `useState` | ✅ Yes — easiest win | **Convert first** |
| **Staff** (`/crm/staff`) | Route-link `CrmTabNav`, workspace switches via `switch(activeTab)` | ✅ Yes — mostly ready | **Convert second** |
| **Customers** (`/crm/customers`) | Route-link `CustomerSegmentTabs`, server-fetches per tab | ⚠️ Partial — needs lazy-loading strategy | Convert later |
| **Bookings** (`/crm/bookings`) | Not a tab page; `CrmTabNav` links to separate routes | N/A | Keep as-is |
| **Setup** (`/crm/setup`) | Single content panel; `CrmTabNav` is decorative | N/A | Keep as-is |
| **Availability** (`/crm/availability`) | Standalone page, no tabs | N/A | Keep as-is |
| **Staff-availability** (`/crm/staff-availability`) | Standalone page, no tabs | N/A | Keep as-is |
| **Dispatch** (`/crm/dispatch`) | Standalone page, no tabs | N/A | Keep as-is |
| **Reconciliation** (`/crm/reconciliation`) | Standalone page, no tabs | N/A | Keep as-is |

**Fastest safe win:** Convert `/crm/services` to internal tabs (workspace already manages tab state).  
**Second win:** Convert `/crm/staff` to internal tabs (page already preloads all data).  
**Deferred:** `/crm/customers` because tabs have mutually exclusive heavy queries; needs a lazy-load strategy first.

---

## 1. Current Architecture Map

### Pages Already Using Internal Tabs (Ideal Pattern)

#### Today (`/crm/today`)
- **Tab component:** `CrmTodayTabBar` (client buttons, not Links)
- **Tab state:** `useSearchParams` → `getTabFromSearchParams()` → `router.replace("?tab=...", { scroll: false })`
- **Data:** All data fetched once by server page (`getTodaysSchedule`, `getCrmTodaySnapshot`, `getActionRequiredNotificationsAction`, `getCrmReadinessCached`)
- **Panels:** 5 dynamic imports (`TodayOverviewTab`, `TodayControlCenterTab`, `TodayPaymentsPendingTab`, `TodayActionRequiredTab`, `TodayEndOfDayTab`)
- **Right rail:** Changes per tab (`renderRightRail()`)
- **Risk:** None. This is the target pattern.

#### Schedule (`/crm/schedule`)
- **Tab component:** `ScheduleWorkspaceTabs` (client buttons)
- **Tab state:** `useSearchParams` → `getTabFromSearchParams()` → `router.replace("?tab=...", { scroll: false })`
- **Data:** All data fetched once by server page (`getDailySchedule`, `getStaffWithAvailability`, `getManagerDashboardStats`, `branch_resources`, `getCrmReadinessCached`)
- **Panels:** 5 dynamic imports (`DailyTimelineTab`, `LiveAvailabilityTab`, `ScheduleSetupTab`, `CoverageIssuesTab`, `StaffScheduleTab`)
- **Right rail:** Conditional per tab
- **Date nav:** Also uses `router.replace("?date=...")`
- **Risk:** None. This is the target pattern.

### Pages Using Route-Link Tabs

#### Staff (`/crm/staff`)
- **Tab component:** `CrmTabNav` with `STAFF_TABS` (Links with `?tab=`)
- **Tab keys:** `applications`, `management`, `assignments`, `status`
- **Tab state:** Server reads `searchParams.tab`, passes `activeTab` prop to `CrmStaffWorkspace`
- **Data fetch:** Server fetches **all** tab data in parallel (`getStaffByBranchWithBranches`, `getPendingStaffByBranch`, `getAllBranches`, `getBranchServicesForManagement`, `getBranchStaffAndServiceAssignments`). Onboarding requests are fetched conditionally (`if (activeTab === "applications")`).
- **Workspace:** `CrmStaffWorkspace` renders one of 4 tab components via `switch(props.activeTab)`
- **Risk:** Low. All data except onboarding is already preloaded. Switching to internal tabs just means moving the `switch` logic from prop-driven to local state.

#### Services (`/crm/services`)
- **Tab component:** `CrmTabNav` with `CRM_SERVICES_TABS` (Links with `?tab=`)
- **Tab keys:** `services`, `customization`, `providers`, `readiness_issues`
- **Tab state:** Server reads `searchParams.tab`, passes `initialTab` to `CrmServicesWorkspace`. The workspace **already manages active tab in local `useState`**!
- **Data fetch:** Server fetches all data (`getBranchServicesForManagement`, `getAllActiveServices`, `getBranchStaffAndServiceAssignments`).
- **Workspace:** `CrmServicesWorkspace` holds `activeTab` in `useState`, renders panels via switch.
- **Risk:** Very low. The workspace is already internally tabbed. The only external dependency is `initialTab` from the URL.

#### Customers (`/crm/customers`)
- **Tab component:** `CustomerSegmentTabs` (Links with `?tab=`)
- **Tab keys:** `all`, `repeat`, `lapsed`, `followup`
- **Tab state:** Server reads `searchParams.tab`, fetches tab-specific data, passes to `CustomersWorkspace`
- **Data fetch:** Server fetches **only the active tab's data**:
  - `all` → `getCustomersPage` (paginated, searchable)
  - `repeat` → `getRepeatCustomers` (paginated)
  - `lapsed` → `getLapsedCustomers` (limited to 50)
  - `followup` → `getWaitlistAction`
- **Workspace:** `CustomersWorkspace` receives all data arrays; only renders the active tab's table.
- **Risk:** Medium. Preloading all four datasets would be expensive (4 separate queries + waitlist). Keeping route-based tabs allows server-side pagination and search. A hybrid approach (preload stats + lazy-load tables) is possible but adds complexity.

#### Bookings (`/crm/bookings`)
- **Tab component:** `CrmTabNav` with `BOOKINGS_TABS`
- **Tabs:** "Today's Bookings" (`/crm/bookings`), "New Booking" (`/crm/bookings/new`)
- **Reality:** These are not content tabs — they are navigation links to separate routes. The main page is a single bookings list with client-side filter pills (status, type, search).
- **Risk:** N/A. Not a tab-conversion candidate.

#### Setup (`/crm/setup`)
- **Tab component:** `CrmTabNav` with `SETUP_TABS`
- **Tabs:** "Setup Health" (`/crm/setup`), "Services" (`/crm/services`), "Spaces & Rules" (`/crm/spaces-rules`)
- **Reality:** These are cross-page navigation links, not in-page tabs. The setup page has a single `SetupHealthContent` panel.
- **Risk:** N/A. Not a tab-conversion candidate.

---

## 2. Cross-Link Map

| Source | Target URL | Params | Risk if tabs become internal |
|--------|-----------|--------|------------------------------|
| `setup-health-content.tsx` | `/crm/services?tab=providers` | `?tab=providers` | **Medium** — deep link must still open Services on Provider Assignments tab. If Services becomes internal, URL param must still be read on mount. |
| `crm-service-readiness-tab.tsx` | `/crm/services?tab=providers` | `?tab=providers` | Same as above. |
| `crm-service-readiness-tab.tsx` | `/crm/services?tab=customization` | `?tab=customization` | Same as above. |
| `crm-service-therapist-panel.tsx` | `/crm/services?tab=services` | `?tab=services` | Same as above. |
| `provider-assignment-card.tsx` | `/crm/services?tab=services` | `?tab=services` | Same as above. |
| `selected-service-editor-rail.tsx` | `/crm/staff?tab=assignments` | `?tab=assignments` | **Medium** — deep link must open Staff on Service Assignments tab. If Staff becomes internal, URL param must still be read on mount. |
| `manager-today-screen.tsx` | `/manager/staff?tab=pending` | `?tab=pending` | **Low** — Manager workspace is soft-paused; route redirects to `/crm`. |
| `coverage-issues-tab.tsx` | `/crm/staff-availability?tab=individual` | `?tab=individual` | **Low** — `staff-availability` is a separate page with its own tab nav. |
| `coverage-issues-tab.tsx` | `/crm/staff-availability?tab=overrides` | `?tab=overrides` | Same as above. |
| `schedule-setup-right-rail.tsx` | `/crm/staff-availability?tab=coverage` | `?tab=coverage` | Same as above. |
| `nav-config.ts` (comments) | `/crm/repeats` → `/crm/customers?tab=repeat` | Redirect | Already implemented. |
| `nav-config.ts` (comments) | `/crm/lapsed` → `/crm/customers?tab=lapsed` | Redirect | Already implemented. |
| `nav-config.ts` (comments) | `/crm/waitlist` → `/crm/customers?tab=followup` | Redirect | Already implemented. |

**Mitigation for deep links:**  
If a page converts to internal tabs, its page component must continue reading `searchParams.tab` on initial server render and passing it as `initialTab` to the workspace. The workspace then initializes local state from `initialTab`. This preserves all existing deep links without breaking them.

---

## 3. Data Dependency Matrix

| Page | Tab | Data Needed | Preload Safe? | Lazy Needed? | Notes |
|------|-----|-------------|---------------|--------------|-------|
| **Today** | overview | `queueData`, `snapshot` | ✅ Yes | No | Already preloaded |
| **Today** | control-center | `queueData` | ✅ Yes | No | Already preloaded |
| **Today** | payments | `queueData`, `snapshot.payment` | ✅ Yes | No | Already preloaded |
| **Today** | actions | `readinessIssues`, `actionNotifications`, `queueData` | ✅ Yes | No | Already preloaded |
| **Today** | end-of-day | `snapshot.payment`, booking counts | ✅ Yes | No | Already preloaded |
| **Schedule** | daily | `staffRows`, `availabilityItems`, `branchResources`, `stats` | ✅ Yes | No | Already preloaded |
| **Schedule** | availability | Live availability snapshot | ⚠️ Partial | Yes | `LiveAvailabilityTab` currently receives `branchId` and `date` props and likely fetches its own data internally. The server page does NOT preload this. |
| **Schedule** | setup | `branchId` only | ✅ Yes | No | `ScheduleSetupTab` uses `branchId` to fetch staff internally. |
| **Schedule** | coverage | `branchId` only | ✅ Yes | No | `CoverageIssuesTab` fetches its own data. |
| **Schedule** | staff | `availabilityItems` | ✅ Yes | No | Already preloaded |
| **Services** | services | `activeServices`, `providerStaff`, `providerAssignments` | ✅ Yes | No | Already preloaded |
| **Services** | customization | `services`, `allServices` | ✅ Yes | No | Already preloaded |
| **Services** | providers | `providerStaff`, `providerAssignments` | ✅ Yes | No | Already preloaded |
| **Services** | readiness_issues | `activeServices`, `providerAssignments` | ✅ Yes | No | Already preloaded |
| **Staff** | applications | `onboardingRequests` | ⚠️ Conditional | Yes | Currently fetched **only** when `activeTab === "applications"`. If preloading all tabs, this adds an admin-client query on every Staff page load. |
| **Staff** | management | `allStaff`, `pendingStaff`, `branches`, `activeServices`, `providerAssignments` | ✅ Yes | No | Already preloaded |
| **Staff** | assignments | `activeServices`, `providerStaff`, `providerAssignments` | ✅ Yes | No | Already preloaded |
| **Staff** | status | `allStaff`, `pendingStaff` | ✅ Yes | No | Already preloaded |
| **Customers** | all | `getCustomersPage` (paginated, searchable) | ⚠️ Heavy | Yes | Branch-scoped ILIKE search + pagination. Preloading would lose server-side pagination benefits. |
| **Customers** | repeat | `getRepeatCustomers` (paginated) | ⚠️ Heavy | Yes | Separate paginated query. |
| **Customers** | lapsed | `getLapsedCustomers` (50 limit) | ✅ Moderate | Maybe | Limited to 50 rows. Could be preloaded. |
| **Customers** | followup | `getWaitlistAction` | ✅ Moderate | Maybe | Up to 100 rows. Could be preloaded. |

---

## 4. Mutation / Refresh Risk Matrix

| Action | Page/Tab | `router.refresh()`? | `revalidatePath` targets | Risk if internal tabs |
|--------|----------|---------------------|--------------------------|----------------------|
| `updateCustomerAction` | Customers / all | No | `/crm/customers`, `/crm/{id}` | **Low** — revalidatePath targets the main route. Internal tabs on the same route would still see fresh data on next SWR fetch or manual refresh. |
| `updateWaitlistStatusAction` | Customers / followup | No | `/crm/waitlist` | **Medium** — revalidates `/crm/waitlist` which now redirects. The waitlist table in Customers tab does NOT auto-refresh after action. User must manually refresh or we need optimistic update. |
| `updateBookingPaymentAction` | Bookings | No | `/crm`, `/crm/bookings`, `/manager`, `/manager/bookings` | **Low** — Bookings page uses SWR with `revalidateOnFocus`. Data refreshes automatically. |
| `confirmBookingPaymentAction` | Bookings | No | Same as above | **Low** — Same SWR pattern. |
| Service visibility toggle | Services / services | **Yes** (`router.refresh()`) | `/crm/services`, `/crm/setup`, `/crm/today`, `/manager/services` | **Medium** — `router.refresh()` re-fetches the current route. If Services is one big internal-tab page, refresh reloads ALL tab data. This is acceptable but slightly slower than refreshing just one tab. |
| Service customization save | Services / customization | **Yes** (`router.refresh()`) | `/crm/services`, `/book`, `/services`, `/` | **Medium** — Same as above. |
| Provider assignment save | Services / providers | **Yes** (`router.refresh()`) | `/crm/services`, `/crm/setup`, `/crm/today`, `/manager/services` | **Medium** — Same as above. |
| Staff profile edit | Staff / management | **Yes** (`router.refresh()`) | None in action; caller calls `router.refresh()` | **Medium** — If Staff becomes internal tabs, `router.refresh()` reloads all staff data. Acceptable. |
| Staff status toggle | Staff / management | **Yes** (`router.refresh()`) | None in action; caller calls `router.refresh()` | **Medium** — Same as above. |
| Staff service capabilities | Staff / assignments | **Yes** (`router.refresh()`) | None in action; caller calls `router.refresh()` | **Medium** — Same as above. |
| Schedule weekly save | Schedule / setup | **Yes** (`router.refresh()`) | `/crm/staff-availability`, `/crm/availability`, `/crm/today`, `/crm/setup`, `/book` | **Low** — Schedule already uses internal tabs and `router.refresh()`. Works fine. |
| Availability check-in | Availability | **Yes** (`router.refresh()`) | None | **Low** — Standalone page. |
| Reconciliation approval | Reconciliation | No | `/crm/reconciliation` | **Low** — Standalone page. |

**Key insight:** `router.refresh()` is used heavily in Services and Staff. Converting these to internal tabs means `router.refresh()` will reload the entire workspace instead of just one tab. This is functionally correct but may feel slightly slower. The fix is to use optimistic local updates + targeted SWR revalidation instead of `router.refresh()`.

---

## 5. Modal / Right Rail Risk Matrix

| Modal / Rail | Used By | Depends on Tab Route? | Risk | Mitigation |
|-------------|---------|----------------------|------|------------|
| `CrmEditStaffProfileModal` | Staff / management, Services / providers | **Yes** — opened from tab content. Must stay mounted when tab switches. | **Medium** — If tabs unmount tab content, the modal (which is rendered inside tab content) would unmount too. | **Lift modal to workspace level.** Both `CrmStaffManagementTab` and `CrmStaffCapabilitiesTab` already lift it to their parent workspace. For full internal tabs, lift to `CrmStaffWorkspace` or `CrmServicesWorkspace`. |
| `ProviderAssignmentSheet` | Services / providers | No — opened from table row. | **Low** — Rendered inside `ServiceAssignmentTableRow`. If row unmounts, sheet closes. | Keep sheet state in row component; row unmounting on tab switch is acceptable because user explicitly switched tabs. |
| `StaffServiceEditorSheet` | Staff / management (via profile modal) | No — opened from profile modal. | **Low** — Modal closes before sheet opens (existing pattern). |
| `EditAvailabilityModal` | Schedule / setup | No — opened from `StaffScheduleTab`. | **Low** — Already works in internal-tab Schedule page. |
| `CustomerPreviewRail` | Customers / all tabs | No — right rail is workspace-level. | **None** — Already rendered at `CustomersWorkspace` level, outside tab tables. |
| `CrmDrawer` (readiness) | Today / overview | No — workspace-level. | **None** — Already workspace-level. |

---

## 6. Page-by-Page Recommendation

### Services (`/crm/services`) — CONVERT NOW

**Why:** `CrmServicesWorkspace` already manages `activeTab` in `useState`. It is 90% internally tabbed already. The only external piece is `CrmTabNav` rendering Links.

**Required changes:**
1. Replace `CrmTabNav` in `crm/services/page.tsx` with internal tab buttons (or reuse `CrmSegmentTabs` from premium layer).
2. Pass `initialTab` from server page to workspace (preserve deep links).
3. Remove `router.replace` usage inside workspace for tab switching; use local `setActiveTab` instead.
4. Keep `router.refresh()` calls for now — they work. Optionally replace with optimistic updates later.

**Risks:** Very low.

**What must be preserved:**
- Deep links (`?tab=providers`, `?tab=customization`, etc.) must still work.
- `CrmEditStaffProfileModal` must remain openable from the Provider Assignments tab.
- All `revalidatePath` calls in `crm/services/actions.ts` must remain unchanged.

---

### Staff (`/crm/staff`) — CONVERT NOW

**Why:** The server page already fetches all tab data in parallel (except onboarding requests). `CrmStaffWorkspace` uses a simple `switch` on `activeTab` prop. Converting to internal tabs means changing the prop to local state.

**Required changes:**
1. Replace `CrmTabNav` in `crm/staff/page.tsx` with internal tab buttons.
2. Move `activeTab` from prop to local state in `CrmStaffWorkspace`.
3. Fetch onboarding requests conditionally inside the workspace (or preload them — they're lightweight).
4. Lift `CrmEditStaffProfileModal` to `CrmStaffWorkspace` level if not already there.

**Risks:** Low.

**What must be preserved:**
- Deep links (`?tab=management`, `?tab=assignments`, etc.) must still work via `initialTab`.
- `router.refresh()` calls in management/assignments tabs must continue to work.

---

### Customers (`/crm/customers`) — CONVERT LATER

**Why:** Each tab has a different heavy query (paginated customers, repeat customers, lapsed customers, waitlist). The current server-side-per-tab pattern is efficient. Converting to internal tabs would require either:
- Preloading all 4 datasets (slow initial load), or
- Lazy-loading tab data client-side (new pattern, needs SWR or similar).

**Recommended approach (future):**
1. Keep the unified page structure.
2. Preload only the "All Customers" data + KPI stats on initial load.
3. Use SWR or `useTransition` + server actions to lazy-load other tab data on first tab visit.
4. Keep URL `?tab=` param for deep-linking and back-button support, but use `router.replace` (like Today/Schedule) instead of full `Link` navigation.

**Risks:** Medium if done without lazy-loading.

---

### Today (`/crm/today`) — NO CHANGE

**Why:** Already uses the ideal internal-tab pattern. Tabs are dynamic imports, data is preloaded once, tab switch uses `router.replace` with `scroll: false`.

---

### Schedule (`/crm/schedule`) — NO CHANGE

**Why:** Already uses the ideal internal-tab pattern. Same architecture as Today.

---

### Bookings (`/crm/bookings`) — NO CHANGE

**Why:** Not a tab page. The `CrmTabNav` links to separate routes (Today's Bookings vs New Booking). The main page is a single bookings list with filter pills.

---

### Setup (`/crm/setup`) — NO CHANGE

**Why:** Single content panel. Tab nav is cross-page navigation.

---

## 7. Risk Classification

| Risk | Severity | Page | Why | Mitigation |
|------|----------|------|-----|------------|
| Deep links with `?tab=` break | **HIGH** | Services, Staff, Customers | External links (setup health, service readiness, provider cards) rely on `?tab=` to open specific tabs. | Always read `searchParams.tab` on server render and pass as `initialTab`. |
| `router.refresh()` reloads entire workspace | **MEDIUM** | Services, Staff | Currently refreshes one tab's data. With internal tabs, it refreshes all. | Acceptable for now. Replace with SWR revalidation or optimistic updates as follow-up. |
| Modal unmounts on tab switch | **MEDIUM** | Staff, Services | Edit Profile modal is rendered inside tab content in some places. | Lift modal to workspace level. Already partially done. |
| Onboarding requests fetched unnecessarily | **LOW** | Staff | Currently lazy-fetched per tab. Internal tabs would need them preloaded or client-side fetched. | Preload them (lightweight admin query) or fetch client-side inside Applications tab. |
| Customer tab data too heavy to preload | **MEDIUM** | Customers | 4 separate queries, some paginated. | Implement lazy-loading with SWR before converting. |
| Waitlist table stale after action | **MEDIUM** | Customers / followup | `updateWaitlistStatusAction` revalidates `/crm/waitlist` (redirect). The Customers page does not auto-refresh. | Add SWR for waitlist data or use optimistic updates in the table. |
| `revalidatePath` targets outdated routes | **LOW** | Various | Some actions revalidate `/crm/waitlist` which now redirects. | Update revalidatePath targets to `/crm/customers` where appropriate. |

---

## 8. Proposed Migration Plan

### Phase 1 — Services (immediate, lowest risk)
- Replace `CrmTabNav` in `/crm/services/page.tsx` with internal `CrmSegmentTabs` or custom tab bar.
- Remove URL-driven tab switching; use `CrmServicesWorkspace`'s existing `useState` for tabs.
- Preserve `initialTab` from `searchParams` for deep links.
- Verify all cross-links (`setup-health-content`, `service-readiness-tab`, etc.) still land on correct tab.

### Phase 2 — Staff (low risk)
- Replace `CrmTabNav` in `/crm/staff/page.tsx` with internal tab bar.
- Move `activeTab` into `CrmStaffWorkspace` local state.
- Preload onboarding requests always (or fetch client-side inside Applications tab).
- Lift `CrmEditStaffProfileModal` to workspace level if needed.

### Phase 3 — Customers (medium risk, needs lazy-loading)
- Implement client-side lazy loading for repeat/lapsed/waitlist tabs using SWR.
- Keep "All Customers" as the preloaded default tab.
- Switch tab navigation from `Link` to `router.replace` (like Today/Schedule).
- Add SWR for waitlist data so actions auto-refresh.

### Phase 4 — Polish
- Replace `router.refresh()` in Services and Staff with targeted SWR revalidation or optimistic updates.
- Update `revalidatePath` in waitlist actions to target `/crm/customers`.
- Add loading skeletons for lazy-loaded tabs.

### Phase 5 — Bookings/Setup/Today/Schedule
- No changes needed. Today and Schedule are already ideal. Bookings and Setup are not tab pages.

---

## 9. Guardrails for Implementation

### What NOT to touch
- Do not change RLS policies.
- Do not change server action logic (only how callers refresh data).
- Do not remove `revalidatePath` calls — they are still needed for route-level cache invalidation.
- Do not break existing deep links.
- Do not convert Bookings or Setup — they are not tab pages.
- Do not change global sidebar or header.

### How to preserve deep links
```tsx
// In the server page, always read ?tab and pass as initialTab:
const initialTab = parseTab(searchParams.tab);
<Workspace initialTab={initialTab} />

// In the workspace, initialize state from prop:
const [activeTab, setActiveTab] = useState(initialTab);
```

### How to preserve refresh behavior
- `router.refresh()` remains valid. It refreshes the current route, which is the unified workspace page.
- For better UX, replace `router.refresh()` with `mutate()` from SWR where possible.

### How to prevent stale data
- Use SWR for client-side data that needs to stay fresh after actions.
- Use `useTransition` for server action calls to show loading states.
- Use optimistic updates for toggles (status, visibility) where the new state is known immediately.

### How to keep modals mounted safely
- Render modals at the workspace level, not inside tab panels.
- Use `open` / `onOpenChange` props controlled by workspace state.
- Example: `CrmServicesWorkspace` already lifts `CrmEditStaffProfileModal` — follow this pattern.

---

## 10. Final Recommendation

**Safest next implementation step:**

> **Convert `/crm/services` to internal tabs first.**

Reasons:
1. `CrmServicesWorkspace` already manages tab state internally with `useState`.
2. All tab data is already preloaded by the server page.
3. Only the tab navigation shell (`CrmTabNav`) needs to change.
4. Deep-link preservation is straightforward (`initialTab` prop).
5. No backend changes needed.
6. It is a fast, visible UX win that proves the pattern.

After Services is proven, apply the same pattern to `/crm/staff` (Phase 2).  
Defer `/crm/customers` until a lazy-loading strategy is implemented (Phase 3).

---

*No code changes were made in this audit.*  
*Ready for approval before implementation.*
