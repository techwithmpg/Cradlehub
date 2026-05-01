# 🎯 CURRENT TASK

| Field | Value |
|-------|-------|
| **Task ID** | `CSR-001` |
| **Description** | `Add CSR Head and CSR Staff roles to existing CRM workspace with role-based access` |
| **Agent** | `Kimi DevCoder` |
| **Status** | `COMPLETE` |

## Changes Summary

### New Roles Added
- `csr_head` — Front-desk supervisor (can cancel/reassign bookings)
- `csr_staff` — Front-desk team member (basic booking/customer operations)
- Existing `csr` role treated as backward-compatible alias for `csr_staff`

### New Files
- `src/lib/permissions.ts` — Centralized RBAC with role constants, permission helpers, nav filtering, route access rules
- `supabase/migrations/20260501000002_csr_roles.sql` — DB migration expanding system_role CHECK constraint
- `src/app/(dashboard)/crm/today/page.tsx` — CSR daily operations queue (stats, next appointment, booking queue, home service, day progress)
- `src/app/(dashboard)/crm/bookings/page.tsx` — Filterable booking list for CSR (date, status, type filters)
- `src/app/(dashboard)/crm/customers/page.tsx` — Customer search/list with quick actions
- `src/app/(dashboard)/crm/schedule/page.tsx` — Schedule view reusing DailyScheduleBoard

### Updated Files
- `src/components/features/dashboard/nav-config.ts` — Role-based nav configs for csr_head and csr_staff
- `src/components/features/dashboard/sidebar.tsx` — CSR workspace meta badges (colors, icons, labels)
- `src/components/features/dashboard/role-badge.tsx` — CSR Head / CSR Staff badge styles
- `src/app/globals.css` — CSS tokens for csr_head and csr_staff accent colors
- `src/proxy.ts` — Middleware route access: CSR allowed into /crm/* and select /manager/* routes, blocked from /owner, /dev, /manager/staff, /manager/operations, /manager/reports
- `src/lib/actions/inhouse-booking.ts` — Expanded allowed roles to include all CSR variants
- `src/app/(dashboard)/manager/bookings/actions.ts` — Granular permissions: CSR Head can cancel/reassign, CSR Staff cannot
- `src/app/(dashboard)/manager/walkin/actions.ts` — Expanded allowed roles for walk-in creation
- `src/app/(dashboard)/crm/bookings/new/page.tsx` — Expanded allowed roles for in-house booking wizard
- `src/app/(dashboard)/crm/actions.ts` — Already had CSR roles in requireCrmAccess()

### Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm build`: ✅ Passing (49 routes)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
