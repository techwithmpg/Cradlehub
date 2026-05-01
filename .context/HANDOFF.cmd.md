# 🧾 HANDOFF — 2026-05-01 (CSR-001 Complete)

## What Was Shipped
- Added role support for `csr_head` and `csr_staff` in existing CRM/operations workspace.
- Implemented role-aware CRM sidebar/menu:
  - `csr_staff`: Today, Bookings, Customers, Schedule
  - `csr_head`: Today, Bookings, Customers, Schedule, Reports Lite
  - owner/manager nav preserved.
- Enforced CSR access in route guards (`proxy`) and centralized helpers (`src/lib/permissions.ts`).
- Enabled CRM in-house booking wizard access for owner/CRM/CSR roles.
- Enforced booking server-action permissions:
  - CSR Staff cannot cancel bookings
  - CSR Staff cannot reassign therapists
  - CSR Head can cancel/reassign.
- Added owner staff role assignment support for CSR roles in invite/edit forms.
- Removed dedicated manager walk-in page route by deleting:
  - `src/app/(dashboard)/manager/walkin/page.tsx`

## Key Files
- `src/lib/permissions.ts`
- `src/proxy.ts`
- `src/components/features/dashboard/nav-config.ts`
- `src/components/features/dashboard/sidebar.tsx`
- `src/app/(dashboard)/crm/bookings/new/page.tsx`
- `src/lib/actions/inhouse-booking.ts`
- `src/app/(dashboard)/manager/bookings/actions.ts`
- `src/app/(dashboard)/manager/bookings/page.tsx`
- `supabase/migrations/20260501000002_csr_roles.sql`

## Validation
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅
- `pnpm test` ✅

## Notes For Next Agent
- `pnpm test` may fail in restricted sandbox due Vitest worker spawn EPERM; rerun with elevated permissions if needed.
- Legacy `csr` role is intentionally kept and treated as `csr_staff` for backward compatibility.
- Manual QA still recommended:
  - verify CSR Staff cannot open `/crm/repeats` or `/crm/lapsed`
  - verify CSR Head can cancel/reassign from `/manager/bookings`
  - verify manager cannot access `/crm/bookings/new`
