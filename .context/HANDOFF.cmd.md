# HANDOFF — CRM/CSR Backend Stabilization: COMPLETE

## Status: Backend Verified ✅ — UI Polish Phase Next

---

## What Was Done (2026-05-30 backend stabilization pass)

### Migrations applied to live Supabase (lsrbwqhvzjfpiabeolkv)

| Migration | What it does | Applied |
|-----------|-------------|---------|
| `20260530000001_crm_operational_rls_bookings.sql` | Adds `crm` role INSERT + UPDATE on bookings (branch-scoped) | ✅ Live |
| `20260530000002_crm_operational_rls_customers.sql` | Adds `crm` + `csr_*` UPDATE on customers (via bookings branch scope) | ✅ Live |
| `20260530000003_crm_operational_rls_resources.sql` | Fixes `branch_resources` cross-branch read; adds crm+csr_head UPDATE | ✅ Live |
| `20260530000004_crm_operational_rls_misc.sql` | Tightens 4 internal tables `public`→`authenticated`; adds csr_staff booking_events read; adds crm onboarding read | ✅ Live |

### Earlier migrations (also applied)
- `20260529000003` — staff UPDATE + staff_services ALL for operational roles
- `20260529000001` — branch_services CRM read + update
- `20260529000002` — schedule RLS for CRM/CSR roles

### Code fixes shipped

| File | Fix |
|------|-----|
| `crm/actions.ts` `updateCustomerAction` | `.select("id")` + 0-row detection |
| `crm/bookings/actions.ts` `confirmBookingPaymentAction` | `.select("id")` on primary + fallback booking update |
| `crm/waitlist/actions.ts` `updateWaitlistStatusAction` | `.select("id")` + 0-row detection |
| `crm/reconciliation/actions.ts` `approveReconciliationAction` | `.select("id")` + 0-row detection |
| `lib/actions/crm-schedule-availability.ts` `getScheduleEditContext` | Specific error per failure mode; case-insensitive branch UUID compare (fixes `z.guid()` case preservation bug) |
| `lib/actions/crm-staff-services.ts` | `z.guid()` instead of `z.string().uuid()` — Zod v4 compat fix |
| `owner/staff/actions.ts` | `.select("id")` 0-row detection for `updateStaffAction` and `toggleStaffActiveAction` |

---

## Browser Verification Results

| Operation | csr_staff result | Policy involved |
|-----------|-----------------|-----------------|
| Staff profile edit (nickname/phone/tier) | ✅ PASS | `staff_operational_update_branch` |
| Service capability assignment | ✅ PASS | `staff_services_operational_all` |
| Schedule update (weekly hours) | ✅ PASS | `staff_schedules_operational_*` |
| Customer update | ✅ PASS | `customers_csr_update_branch_related` (new) |
| Booking payment confirm | ✅ PASS | `bookings_csr_update` (csr_staff) |
| Branch resources read | ✅ PASS | `branch_resources_crm_read` (branch-scoped, fixed) |
| Owner regression | ✅ PASS — owner still works |

---

## Remaining Watch Items (do NOT reopen these)

- **`booking_payment_logs`** — any-authenticated INSERT/SELECT by business decision. Leave as-is.
- **`departments` table** — 4 rows, 0 RLS policies, not used by CRM. Requires separate cleanup decision (backup + FK check + code reference check before drop).
- **Unused schedule helper tables** (`schedule_health_checks`, `schedule_suggestions`, `scheduling_rules`, `staff_scheduling_preferences`) — 0 rows each, now tightened to `authenticated`. Candidates for later archival — do NOT drop without explicit approval.
- **`crm` role booking reads** — still unscoped (`bookings_crm_read_all` across all branches). Intentional for operator visibility; not a security hole.

---

## Current UI Task

**Centered tabbed Edit Staff Profile modal** for `/crm/staff?tab=management`.

The backend is stable. The UI work can proceed without RLS surprises.

Files being worked on:
- `src/components/features/crm/staff/crm-edit-staff-profile-modal.tsx` — main modal shell
- `src/components/features/crm/staff/tabs/` — tab content components

Existing action: `updateStaffAction` from `owner/staff/actions.ts` — already supports csr_staff and has 0-row detection.

---

## Build Status
`pnpm type-check` ✅ · `pnpm lint` ✅ · `pnpm build` ✅ (89 routes)
