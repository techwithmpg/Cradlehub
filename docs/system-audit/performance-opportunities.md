# Performance Opportunities

Captured: 2026-07-10

This is an audit-only list. No performance behavior was changed in this pass.

## High Signal Opportunities

1. `/crm/today` has a wide server loader.
   - It already uses `Promise.all` for the first batch, but then performs follow-up work for resource names, tracking tokens, and driver names.
   - Opportunity: move queue hydration into a dedicated query helper that batches related IDs once and returns the view model.

2. `/crm/staff` preloads all staff tabs.
   - Roster, pending applications, branches, services, provider assignments, onboarding requests, and branch corrections can all load for one page view.
   - Opportunity: keep the first visible tab server-rendered and load secondary tab payloads lazily or via cached route-level helpers.

3. `/crm/customers` fetches tab data and then stats.
   - Opportunity: fetch `getCrmStats(branchId)` in parallel with the tab-specific query.

4. `/crm/setup` performs a required second phase for provider assignments.
   - This is structurally reasonable because it depends on active service IDs.
   - Opportunity: cache branch service/assignment summaries or fetch assignment data only when services/providers tabs are active.

5. `/crm/dispatch` is intentionally dynamic.
   - Google Maps is client-loaded and should remain gated by `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.
   - Opportunity: memoize map selection callbacks and avoid re-instantiating the map when only selected booking changes.

6. `/crm/attendance` combines server-loaded workspace data with client realtime updates.
   - Opportunity: keep realtime patch scope narrow and avoid refreshing the full workspace for actions that only affect devices, QR points, or exceptions.

## Query Hygiene Opportunities

- Standardize CRM context lookup so page loaders do not repeat staff/branch/role queries.
- Prefer view-model helpers for large operational pages instead of assembling UI models directly in page files.
- Keep admin-client use isolated to server-only helpers with clear branch checks.
- Use `unstable_cache` or equivalent local caching only for data that is safe to share by branch and does not need immediate mutation visibility.

## Non-Goals

- No database indexes were added.
- No RLS policy changes were made.
- No route was converted to static rendering.
- No Suspense or streaming boundaries were added.
- No client state model was replaced.

