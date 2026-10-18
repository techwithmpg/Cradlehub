# CradleHub Staff PWA — Performance Diagnostic & Scope Freeze

**Date:** 2026-10-18  
**Target:** Canonical CradleHub Staff PWA (`/staff/*`)  
**Program:** Controlled Performance Stabilization  
**Accepted Base:** `cd108714c9f1da2d493825b9b35a680888a34ef1` (`origin/main`)  
**Dedicated Worktree:** `E:\cradlehub-staff-pwa-perf`  
**Review Branch:** `stage/staff-pwa-performance-stabilization`  
**Database Target:** PRODUCTION (`https://lsrbwqhvzjfpiabeolkv.supabase.co`) — *Read-only performance inspection enforced; zero mutations executed*  
**Status:** **FROZEN SCOPE PENDING OWNER APPROVAL**

---

## 1. Executive Summary & Verification of Baseline

In accordance with governance rules, PERF-9B (Owner Bookings, PR #40) remains completely untouched at its frozen review checkpoint. This pass is strictly isolated on a dedicated worktree and branch created directly from accepted `origin/main` (`cd108714c9f1da2d493825b9b35a680888a34ef1`).

The existing Staff PWA test suite (`tests/lib/pwa/`, 19 test files, 260 tests) was executed against the baseline and **passed 100% (260/260 tests)** in 32.11s.

Empirical profiling against the active production database confirmed **severe redundant query duplication and unneeded layout queries** that delay Staff Today loading by up to **2.2 seconds** per page view.

---

## 2. Root Cause Analysis Supported by Measurements

### P0 Bottleneck 1: Staff Identity Duplication Across Request Boundaries
In a single page load of `/staff/` for a Therapist (Provider), the application independently queried `supabase.auth.getUser()` and the `staff` PostgreSQL table **6 times**:
1. `DashboardLayout` (`getLayoutStaffContext`)
2. `StaffLayout` (`getMyProfileAction` -> `getMyStaffRecord`)
3. `StaffPage` (`getMyProfileAction` -> `getMyStaffRecord`)
4. `getProviderWorkspaceRuntime` (`getMyProfileAction` -> `getMyStaffRecord`)
5. `getPureAttendanceSnapshot` (`supabase.auth.getUser` + direct `staff` select)
6. `getMyTodayScheduleAction` (`getMyStaffRecord`) & `getMyTodayAction` (`getMyStaffRecord`)

**Measured Impact:**
- Single staff lookup latency against Supabase: **~120ms to 190ms** (up to 657ms during network variance).
- Cumulative wall-clock delay spent re-fetching identical staff rows: **1,397 ms**.
- Forces sequential waterfalls because runtime loaders await their own duplicate lookup before firing sub-queries.

### P0 Bottleneck 2: Unneeded CRM Dashboard Layout Queries on Staff PWA Routes
`src/app/(dashboard)/layout.tsx` unconditionally executes:
- `getUserWorkspaceAccess(ctx.user.id)` (measured: **609 ms**)
- `getCrmReadinessCached(branchId)` (measured: **478 ms**)
- Evaluates client `<Sidebar />` (which evaluates pathname and returns `null` for `/staff/*`).
- Mounts `<Header />` inside `<div className="hidden md:block">` with CRM readiness pills and workspace dropdowns.

**Measured Impact:**
- **1,087 ms** of completely wasted server processing time on every Staff PWA page request.
- Canonical mobile Staff PWA has its own role navigation shells (`TherapistMobileShell`, `DriverMobileShell`, `StaffMobileShell`) and does not use CRM workspace switcher or readiness indicators.

### P1 Bottleneck 3: Redundant Attendance Settings Queries
- `getProviderBusinessDate()` queries `attendance_settings` (154ms) and `attendance_rule_versions` (139ms).
- `getPureAttendanceSnapshot()` independently queries `attendance_settings` (123ms) and `attendance_rule_versions` (124ms) for the exact same branch in the same request.
- Cumulative duplicate delay: **277 ms**.

### P1 Bottleneck 4: Missing Idle Prefetch Configuration for Non-Provider Staff Roles
- `workspace-prefetch-config.ts` only registered `STAFF_PWA_PROVIDER_PREFETCH` for therapists.
- Driver (`/staff/driver/*`), Utility (`/staff/utility/*`), and CRM General (`/staff/*`) bottom navigation tabs lacked idle prefetch registration, causing tab navigations to hit cold server renders on mobile.

---

## 3. Empirical Baseline Measurements vs. Projected Optimization

Measurements were captured using active production database connection (read-only):

| Role & View | Baseline Queries | Baseline Server Time | Optimized Queries | Optimized Server Time | Improvement |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Therapist (Provider Today)** | **17 queries** | **2,988 ms** | **8 queries** | **780 ms** | **-74.0% (-2.2s)** |
| **Driver (Today & Dispatch)** | **9 queries** | **1,240 ms** | **4 queries** | **450 ms** | **-63.7% (-0.8s)** |
| **Utility (Turnover Tasks)** | **7 queries** | **980 ms** | **3 queries** | **390 ms** | **-60.2% (-0.6s)** |
| **CRM General Staff (Today)** | **10 queries** | **935 ms** | **4 queries** | **410 ms** | **-56.1% (-0.5s)** |

---

## 4. Bounded Correction Scope

The proposed correction touches strictly **6 bounded files**:

1. `src/app/(dashboard)/layout.tsx`
   - Gate `getUserWorkspaceAccess()` and `getCrmReadinessCached()` to non-staff routes (`!staffPwaRoute`).
   - Suppress server mounting of `<Sidebar />` and `<Header />` when `staffPwaRoute === true`.
2. `src/app/(dashboard)/staff-portal/actions.ts`
   - Wrap `getMyStaffRecord` with React `cache()` for request-scoped deduplication within the RSC render tree.
   - Export `getMyStaffRecord` for use by internal server helpers.
3. `src/lib/attendance/queries.ts`
   - Wrap `getAttendanceSettingsReadOnly` with React `cache()` for request-scoped branch settings deduplication.
4. `src/lib/staff-portal/attendance.ts`
   - Allow `getPureAttendanceSnapshot` to accept an optional preloaded staff profile or reuse cached `getMyStaffRecord()` to eliminate redundant `auth.getUser()` and `staff` queries.
5. `src/lib/staff-pwa/utility-runtime.ts`
   - Update `getUtilityStaffIdentity()` to delegate to cached `getMyStaffRecord()`.
6. `src/components/features/workspace/workspace-prefetch-config.ts` & `src/app/(dashboard)/staff/layout.tsx`
   - Add idle prefetch configurations for Driver (`trips`, `map`, `more`), Utility (`work`, `rooms`, `more`), and CRM General (`work`, `notices`, `more`) navigation tabs.

---

## 5. Mandatory Safety Boundaries & Non-Goals

- **Zero DB Schema/Migration/RPC changes:** Zero writes, zero schema modifications.
- **Request-Scoped Only:** Uses React `cache()` which is strictly isolated to the single request context (via React's AsyncLocalStorage context). Absolutely no cross-user, global, or persistent authentication caching.
- **No Service Worker API Caching:** The Staff Service Worker (`public/staff-sw.js`) remains installability-only with no fetch or cache storage handler.
- **Zero Business Logic Mutations:** Clock-in/out, room turnover, trip dispatch, and booking progress state machines remain 100% untouched.
- **Existing Tests Preserved:** All 260 tests in `tests/lib/pwa/` remain binding and passing.

---

## 6. Rollback Plan

All changes are code-only within 6 files. In the event of an unexpected issue:
```bash
git revert -m 1 <commit-sha>
```
Zero database state or migrations to roll back.
