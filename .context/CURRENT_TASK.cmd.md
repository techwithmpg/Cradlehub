# CURRENT TASK: STAFF-TIER-001 — Staff Display Tier Eligibility Fix (Complete)

## Overview
Fixed Staff page display mapping so service tier labels only appear for tier-eligible service staff. No RBAC, auth, booking, schema, public page, or staff CRUD changes.

## Completed
- Added `getStaffDisplayRole(staff)` in `src/components/features/staff/staff-management-utils.ts`.
- Tier display is now gated by `staff_type` and `system_role`, not by raw tier presence.
- Managers, owners, CSR roles, CRM, drivers, utility, service heads, managerial, and salon heads never show tier even if legacy seed data says `tier = junior`.
- Therapist rows still show tier when a known tier is present.
- Staff row subtitle now uses the same helper and appends phone in the requested `Role · Tier · Phone` format.

## Verification
- `pnpm type-check`: passing
- `pnpm lint`: passing
- `pnpm build`: passing, 68 app routes

## Status
Complete. Ready to commit.
