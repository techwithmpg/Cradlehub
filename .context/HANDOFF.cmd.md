# HANDOFF — CRM Premium Work-Area Component Layer + Customers Upgrade: COMPLETE

## Status: ✅ Build verified (89 routes · type-check ✅ · lint ✅ · build ✅)

---

## What Was Done (2026-05-30)

### New: `src/components/features/crm/premium/` — 12 components

| Component | Purpose |
|-----------|---------|
| `crm-motion-section.tsx` | CSS fade-up entrance wrapper for CRM sections |
| `crm-kpi-card.tsx` | Premium KPI card — `.cs-metric` + `CountUpNumber` |
| `crm-segment-tabs.tsx` | Unified tabs — pill + underline variants, Link + button |
| `crm-table-row.tsx` | Animated `<tr>` — stagger entrance, selected state |
| `crm-preview-rail-shell.tsx` | Desktop aside + mobile Sheet structural shell |
| `crm-empty-state.tsx` | Premium empty state — default, search, filtered |
| `crm-status-badge.tsx` | Unified badge — 17 variants, CSS variables only |
| `crm-loading-shimmer.tsx` | Warm skeleton — kpi-row, table, rail, card-grid |
| `crm-inline-action-button.tsx` | Inline loading button with spinner |
| `crm-filter-bar.tsx` | Search + filters + actions toolbar shell |
| `crm-table-shell.tsx` | `.cs-table-wrap` with header/empty/pagination slots |
| `index.ts` | Barrel export |

### CSS added to `src/app/globals.css`
- `crm-fade-up` keyframe + class (0.28s, reduced-motion safe)
- `crm-row-enter` keyframe + class (0.22s, index-staggered)
- `.crm-row-selected td:first-child { box-shadow: inset 3px 0 0 var(--cs-sand) }` — left border on selected rows
- `.crm-shimmer-wrap` + `crm-shimmer-sweep` keyframe — warm gradient shimmer

### Customers Workspace upgraded (6 files)

| File | What changed |
|------|-------------|
| `customer-kpi-row.tsx` | `CrmMotionSection` + `CrmKpiCard` (numeric values count up) |
| `customer-segment-tabs.tsx` | Delegates to `CrmSegmentTabs` (underline variant) |
| `all-customers-table.tsx` | `CrmTableShell` + `CrmTableRow` + `CrmEmptyState` + `CrmStatusBadge` |
| `customer-preview-rail.tsx` | `CrmPreviewRailShell` shell + `CrmStatusBadge` + `CrmLoadingShimmer variant="rail"` + `CrmMotionSection` on activity list |
| `customers-workspace.tsx` | `CrmMotionSection delay={80}` wrapper on table+rail area |
| `crm/customers/loading.tsx` | Full warm shimmer skeleton (header, tabs, KPIs, toolbar, table) |

---

## Key Decisions Made

- **No motion library** — all animations are CSS-only. `motion` can be added later if approved.
- **CrmStatusBadge** replaces `CustomerSegmentBadge`. VIP → gold (spa-appropriate).
- **Selected row left border** — `inset box-shadow` on `td:first-child` via `.crm-row-selected` CSS rule (borders don't work on `<tr>` in standard table layout).
- **Scope strictly respected** — only `/crm/customers` upgraded. Sidebar, header, auth, RLS untouched.

---

## What's Next

- Apply premium layer to other CRM workspaces: Staff, Services, Schedule, Today, Bookings.
- The proof-of-concept pattern is now established and stable.

---

## Build
`pnpm type-check` ✅ · `pnpm lint` ✅ (0 errors) · `pnpm build` ✅ · 89 routes

---

## 2026-05-30 — CRM Route-Tab Risk Audit (AUDIT-001)

**Task:** Audit CRM workspaces for risks before converting route-link tabs to internal in-page tabs.

**Report:** `docs/audits/CRM_ROUTE_TAB_RISK_AUDIT.md`

**Key Findings:**
- **Today** and **Schedule** already use the ideal internal-tab pattern (`useSearchParams` + `router.replace` + dynamic imports).
- **Services** is 90% ready — `CrmServicesWorkspace` already holds tab state in `useState`. Only the `CrmTabNav` shell needs replacement.
- **Staff** is mostly ready — server preloads all tab data; `CrmStaffWorkspace` uses `switch(activeTab)`.
- **Customers** needs a lazy-loading strategy first — each tab has a different heavy query.
- **Bookings** and **Setup** are not true tab pages; no conversion needed.

**Highest Risks Identified:**
1. Deep links with `?tab=` params must continue to work after conversion.
2. `router.refresh()` in Services/Staff will reload the entire workspace instead of one tab.
3. Modals rendered inside tab content may unmount on tab switch unless lifted to workspace level.
4. Waitlist actions revalidate `/crm/waitlist` (now a redirect); Customers followup tab may show stale data.

**Recommended Migration Order:**
1. Phase 1: Services (fastest win, lowest risk)
2. Phase 2: Staff (low risk)
3. Phase 3: Customers (needs lazy-loading strategy first)
4. Phase 4: Replace `router.refresh()` with targeted SWR/optimistic updates

**No code changes were made.**

---

## 2026-05-31 - CRM Route-Tab Risk Audit Refresh

**Task:** Audit CRM route-tab architecture risks before converting to in-page tabs.

**Status:** Complete. Audit-only. No implementation code changed.

**Refined findings:**
- Services is the safest first conversion. Its workspace already has client tab state and preloads the needed services/provider assignment data; the remaining risk is the outer `CrmTabNav` URL-link shell plus many `router.refresh()` save flows.
- Staff is safe for management, assignments, and status, but applications should stay lazy-loaded or route-like until the onboarding approval/rejection reload behavior is addressed.
- Schedule should be partial only. `/crm/schedule` already has internal panels, but tab URL sync uses `router.replace()` while the page awaits `searchParams`; heavy availability/setup/staff panels should stay lazy-loaded.
- Today can keep internal panels, but `/crm/control` should remain separate or lazy because it is a heavier operational console.
- Customers should not preload every tab. All/repeat/lapsed/followup use different heavy queries and should be lazy if converted.
- Bookings should keep `date` and `bookingId` URL-driven. Status/type filters can become internal, but booking deep links need normalization first.

**Fragile dependencies to fix or preserve before implementation:**
- Several CRM links use `/crm/bookings?highlight=...`, but Bookings currently selects records by `bookingId`, not `highlight`.
- Several Schedule links use `/crm/staff-availability?tab=...`, but the staff availability page does not consume that `tab` param.
- Waitlist followup lives under `/crm/customers?tab=followup`, while waitlist status actions revalidate `/crm/waitlist`, creating stale UI risk.

---

## 2026-05-31 - CRM Staff Internal Tabs

**Task:** Convert `/crm/staff` route-link tabs into fast in-page workspace tabs.

**Status:** Complete. Type-check, lint, and build passed. Authenticated browser click-through is still blocked by the local browser redirecting CRM routes to `/login`.

**Implementation notes:**
- Staff page no longer renders `CrmTabNav` or imports `STAFF_TABS`.
- `CrmStaffWorkspace` now receives `initialTab`, owns local tab state, renders CRM premium `CrmSegmentTabs`, and uses `window.history.replaceState` to update `?tab=` without a route navigation.
- Staff-specific route-link tab config was removed from `crm-tab-nav.tsx`; incoming links like `/crm/staff?tab=assignments` are still preserved and resolve through the server page.
- Management, Assignments, Status, and Applications panels are mounted together and hidden when inactive.
- Applications now preloads submitted onboarding requests only when `canReviewOnboarding` is true, preserving the Applications panel without adding a new client fetch or API route.
- Existing Staff modals/actions remain in their original tab components; `router.refresh()` after saves is unchanged.

**Verification notes:**
- `pnpm type-check`: pass
- `pnpm lint`: pass with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: pass, 89 routes
- Browser route checks redirected to `/login` for Staff, Customers, and Services because the in-app browser did not have an authenticated CRM session.

---

## 2026-05-31 - Notification Bell Business List

**Task:** Simplify the notification bell popover into one business-readable notification list.

**Status:** Complete. Type-check and build passed. Lint passed with the same 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`.

**Implementation notes:**
- `NotificationBell` now uses the existing `Popover` primitive instead of a manual absolute dropdown and outside-click listener.
- Badge polling remains on `getUnreadCountAction()` and still pauses while the popover is open or the document is hidden.
- Opening the bell still fetches `getRecentNotificationsAction(20)` and `getUnreadCountAction()` in parallel.
- `BookingNotificationSound` remains mounted for the same role set.
- `NotificationPopover` no longer imports `NotificationTabs` or `NotificationRow`; the bell popover renders one newest-first list.
- `notification-display.ts` maps raw notifications into business display fields with safe metadata/title/body fallbacks.
- `notification-popover-row.tsx` is bell-specific, so the full notification center's category sections and existing row/card components are untouched.
- Mark read, mark all read, and dismiss use the existing notification actions. Dismiss updates local UI only after the action resolves; thrown failures show a Sonner error toast.

**Verification notes:**
- `pnpm type-check`: pass
- `pnpm lint`: pass with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: pass, 89 routes
- Static check confirmed `NotificationTabs`, `Action Required`, `Updates`, `Resolved`, and `Activity` are no longer present in the bell popover files.
- Browser route checks for `/crm/today`, `/crm/customers`, `/crm/staff`, and `/crm/services` redirected to `/login` in the in-app browser because no authenticated CRM/CSR session was available. Re-run authenticated click-through once a CRM/CSR browser session is available.
