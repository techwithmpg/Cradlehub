# CURRENT TASK: Fix Public Booking Wizard Not Showing CRM-Enabled Home-Service Services

## Status
DONE

## Task ID
CRM-HOME-SVC-FIX-001

## Root Causes Found & Fixed
1. **`updateBranchServiceEligibilityAction` silent failures** — `.select().maybeSingle()` returned null data even when update succeeded in some scenarios. Fixed: removed the select dependency; now does update + separate existence check.
2. **Missing public route revalidation** — action only revalidated CRM/owner/manager paths, not `/`, `/services`, `/book`. Fixed: added public path revalidation.
3. **No `Cache-Control: no-store` on booking-context API** — browser could cache old API response. Fixed: added header + `export const dynamic = "force-dynamic"`.
4. **Home Service toggle shows no warning for inactive/CSR-only services** — users toggled home service ON but service was inactive or not public, so nothing appeared. Fixed: contextual warnings added in both table toggle and editor rail.
5. **Readiness checklist had no fix notes** — users didn't know how to fix "Active service" or "Public visibility enabled" failures. Fixed: added guidance notes.
