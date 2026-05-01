# 🎯 CURRENT TASK

| Field | Value |
|-------|-------|
| **Task ID** | `DEV-001` |
| **Description** | `Fix dev auth bypass for staff portal and all role guards` |
| **Agent** | `Kimi DevCoder` |
| **Status** | `COMPLETE` |

## Changes Summary

### Problem
- Middleware had `DEV_ALLOW_ALL_MODULES` bypass but dashboard layout, staff portal actions, and page guards all independently checked for staff records
- Staff portal showed "Unauthorized" in dev mode because `getMyStaffRecord()` returned null
- No centralized helper for dev bypass — logic duplicated in proxy.ts and login/actions.ts

### Solution
- Created `src/lib/dev-bypass.ts` — centralized helper with:
  - `isDevAuthBypassEnabled()` — checks `NODE_ENV !== "production"` AND (`DEV_AUTH_BYPASS=true` OR legacy `DEV_ALLOW_ALL_MODULES=true`)
  - `getDevBypassLayoutStaff()` — mock staff profile for dashboard layout
  - `getDevBypassStaffRecord()` — mock staff record for staff portal actions
  - `devBypassAuthMessage()` — helpful dev-mode error message

### Files Updated
- `src/lib/dev-bypass.ts` — new centralized helper
- `src/proxy.ts` — uses `isDevAuthBypassEnabled()`
- `src/app/(auth)/login/actions.ts` — uses centralized helper
- `src/app/(dashboard)/layout.tsx` — falls back to mock staff in dev bypass mode
- `src/app/(dashboard)/staff-portal/actions.ts` — returns mock staff + empty data in dev bypass
- `src/app/(dashboard)/crm/today/page.tsx` — dev bypass in `getCsrContext()`
- `src/app/(dashboard)/crm/bookings/page.tsx` — dev bypass in `getCsrContext()`
- `src/app/(dashboard)/crm/customers/page.tsx` — dev bypass in `getCsrContext()`
- `src/app/(dashboard)/crm/schedule/page.tsx` — dev bypass in `getCsrContext()`
- `src/app/(dashboard)/manager/page.tsx` — dev bypass in `getManagerContext()`
- `src/app/(dashboard)/manager/schedule/page.tsx` — dev bypass in `getManagerContext()`
- `src/app/(dashboard)/manager/bookings/page.tsx` — dev bypass in `getOperationsContext()`
- `src/app/(dashboard)/owner/services/actions.ts` — dev bypass in `requireOwner()`
- `src/app/(dashboard)/owner/branches/actions.ts` — dev bypass in `requireOwner()`
- `src/app/(dashboard)/owner/staff/actions.ts` — dev bypass in `requireOwner()` and `requireOwnerOrManager()`
- `src/app/(dashboard)/owner/bookings/actions.ts` — dev bypass in `requireOwner()`
- `src/app/(dashboard)/crm/actions.ts` — dev bypass in `requireCrmAccess()`
- `src/app/(dashboard)/manager/walkin/actions.ts` — dev bypass with safe fallback
- `src/app/(dashboard)/manager/staff/actions.ts` — dev bypass in `getManagerContext()`
- `src/app/(dashboard)/manager/bookings/actions.ts` — dev bypass in `getOperationsContext()`
- `src/lib/actions/inhouse-booking.ts` — dev bypass with explicit branchId requirement

### Tests Added
- `tests/lib/dev-bypass.test.ts` — 10 tests covering:
  - Returns true in non-production with env flag
  - Returns false in production even with env flag
  - Legacy `DEV_ALLOW_ALL_MODULES` support
  - Mock staff profile shapes
  - Auth message behavior

### Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm build`: ✅ Passing (49 routes)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm test`: ✅ Passing (18 tests)
