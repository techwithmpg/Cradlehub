# HANDOFF — CradleHub

> Last updated: 2026-05-29

## Current Phase
CRM-HOME-SVC-FIX-001 complete — Home-service service visibility bug fixed

## What Just Happened (CRM-HOME-SVC-FIX-001)

Fixed the bug where CRM enabling a service for Home Service didn't result in it appearing in the public booking wizard.

**Root causes fixed:**
1. `updateBranchServiceEligibilityAction` — removed fragile `.select().maybeSingle()` pattern; now uses plain update + separate existence check. Added revalidation of `/`, `/services`, `/book` public routes.
2. `updateBranchServiceDeliveryModeAction` — added same public route revalidation.
3. `/api/public/booking-context` — added `export const dynamic = "force-dynamic"` and `Cache-Control: no-store` to prevent any CDN/browser caching of stale service data.
4. CRM `HomeServiceToggleSection` — contextual warnings when service is inactive or CSR-only.
5. CRM `HomeServiceToggle` (table) — ⚠ indicator when home service is ON but service won't appear publicly.
6. Readiness checklist — guidance notes on how to fix each failing item.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (89/89 routes)

## Follow-up Fix (same session)

**Root cause confirmed**: `unstable_cache` in `getBranchServicesPublicCached` was NOT being reliably busted by `revalidateTag` in Next.js 16.2.4. The cache served stale `available_home_service: false` data even after CRM toggle updated the DB.

**Definitive fix**: Added `getBranchServicesForPublicBooking()` — same query as the cached variant but using `createAdminClient()` with NO cache. `/api/public/booking-context` now uses this for the `publicOnly=true` path, so every booking page load fetches fresh service availability from the DB. Cache-Control: no-store header also added so browser doesn't cache either.

**Files:** `src/lib/queries/branches.ts` (new function), `src/app/api/public/booking-context/route.ts` (swap cached → uncached)

## Previous Phase
CRM-SVC-HOME-TOGGLE-001 complete — Home Service toggle added to CRM Service Customization table

## What Just Happened (CRM-SVC-HOME-TOGGLE-001)

The CRM Service Customization table now has a compact **Home Service** toggle column. CRM can quickly enable/disable home-service availability per service directly from the table.

**Key changes:**

- `src/components/features/crm/services/service-customization-table.tsx` — New "Home Service" column with Switch toggle + ON/OFF label; optimistic UI with error revert
- `src/components/features/crm/services/selected-service-editor-rail.tsx` — Matching standalone Home Service toggle row added below Delivery Mode cards
- Reuses existing `updateBranchServiceEligibilityAction()` and `branch_services.available_home_service` field
- Public booking wizard already filters by `availableHomeService` when customer selects home-service delivery

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (91/91 routes)

## Previous Phase
CRM-SVC-CUSTOM-001 complete — CRM Service Customization tab built
(See previous HANDOFF content below)

The CRM Services workspace (`/crm/services`) now has 4 tabs:
- **Services** — existing service-centric provider assignment table
- **Service Customization** — metric cards, filterable table, selected-service editor rail for controlling delivery mode, public visibility, and booking readiness
- **Provider Assignments** — renamed from "Staff Capabilities"; staff-centric service capability summary
- **Readiness Issues** — existing readiness check list

**Key changes:**

- `src/components/features/crm/services/service-customization-tab.tsx` — Main tab shell
- `src/components/features/crm/services/selected-service-editor-rail.tsx` — Right-side sticky editor with delivery mode selector, public visibility toggle, readiness checklist
- `src/components/features/crm/services/service-customization-metric-grid.tsx` — 6 KPI cards
- `src/components/features/crm/services/service-customization-filter-bar.tsx` — Search + category + delivery mode + status filters
- `src/components/features/crm/services/service-customization-table.tsx` — Paginated table
- `src/components/features/crm/services/customization-rows.ts` — Data enrichment helper
- `src/components/ui/switch.tsx` — Custom toggle switch
- `src/app/(dashboard)/owner/branches/actions.ts` — Added `updateBranchServiceDeliveryModeAction()`
- `src/components/features/crm/crm-tab-nav.tsx` — Added `CRM_SERVICES_TABS`
- `src/components/features/crm/services/crm-services-workspace.tsx` — 4-tab workspace

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (91/91 routes)

## Recommended Next Steps
1. **Browser verification** — open `/crm/services?tab=customization`, select a service, toggle Home Service ON/OFF from both table and editor rail, verify public booking respects it
2. **Unused components cleanup** — `crm-setup-health-cards.tsx`, `crm-setup-issues-list.tsx`, `crm-setup-workspace-tiles.tsx`, `spaces-rules-health-summary.tsx`, `spaces-rules-access-notice.tsx`, `crm-readiness-badge.tsx`, `crm-readiness-badge-wrapper.tsx` are no longer imported by active pages. Safe to remove when confirmed.
3. **Owner/Manager workspace reactivation** — when ready, revert `owner/layout.tsx` and `manager/layout.tsx` from `redirect("/crm")` back to full layouts.
