# HANDOFF — STAFF-TIER-001 Staff Display Tier Eligibility Fix

## Date
2026-05-09

## Agent
Codex

## Summary
Fixed the Staff page role/tier display helper so legacy default `staff_type = therapist` and `tier = junior` values on admin/support rows cannot render as therapist tier labels. No auth, RBAC, booking, schema, public page, or staff CRUD changes.

## Files Changed
- `src/components/features/staff/staff-management-utils.ts`
  - Added typed `StaffDisplayRole` return shape.
  - Added `getStaffDisplayRole(staff)` and `getStaffDisplaySubtitle(staff)`.
  - Uses `job_title` first when present.
  - Falls back through staff type / protected system-role labels.
  - Allows tier only for therapist staff rows and suppresses tier for owners, managers, CSR roles, CRM, service heads, drivers, utility, managerial, and salon heads.
- `src/components/features/staff/staff-table-row.tsx`
  - Uses `getStaffDisplaySubtitle()` for the row subtitle so phone is appended consistently.

## Behavior Notes
- Managers no longer display `Therapist · Junior`.
- Therapist rows still display `Therapist · Junior` / `Therapist · Senior` when applicable.
- Staff row subtitle format is now `Role · Tier · Phone` for eligible service staff and `Role · Phone` for non-tier roles.
- Existing branch grouping, tabs, filters, selected panel, and actions remain unchanged.

## Verification
- `pnpm type-check`: passing.
- `pnpm lint`: passing.
- `pnpm build`: passing, 68 app routes.

## Remaining Notes
- Existing unrelated working tree changes were left untouched.
