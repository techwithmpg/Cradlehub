# CRM Authorization Inventory — CRM-AUTHORIZATION-CONSISTENCY-001

Date: 2026-06-17  
Scope: CRM Staff service-capability save path plus a code/migration scan of CRM workspace authorization drift.

## Operational role model

CRM workspace roles are centralized in `src/lib/auth/crm-permissions.ts`.

| Role | CRM workspace | Staff service capability save | Branch scope |
| --- | --- | --- | --- |
| `owner` | Yes | Yes | All branches |
| `manager` | Yes | Yes | Own branch for staff-services RPC/RLS |
| `assistant_manager` | Yes | Yes | Own branch for staff-services RPC/RLS |
| `store_manager` | Yes | Yes | Own branch for staff-services RPC/RLS |
| `crm` | Yes | Yes | Own branch |
| `csr_head` | Yes | Yes | Own branch |
| `csr_staff` | Yes | Yes | Own branch |
| `csr` | Yes | Yes | Own branch |
| `staff`, `therapist`, `driver`, `utility`, `nail_tech`, `aesthetician`, `salon_head` | No general CRM workspace authority | No | N/A |

## Staff service assignment workflow

| Surface | UI visible to role | Server action roles | RLS/grant expectation | Branch-scoped | Admin client used | Expected behavior | Mismatch / fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/crm/staff?tab=assignments` | owner, manager, assistant_manager, store_manager, crm, csr, csr_head, csr_staff | `updateStaffServicesFromCrmAction` uses `canManageStaffServices()` | `staff_services` authenticated grants + owner policy + operational command policies | Owner all branches; everyone else own branch | No | Load active branch staff, active branch services, and assigned capabilities | Fixed hidden `staff_services` read errors and branch-scoped assignment query |
| Staff Management → Edit profile → Services | same as `/crm/staff` | same action | same `staff_services` policy/RPC path | same | No | Show assignment summary only when assignment query succeeds | Fixed by passing load error into modal instead of rendering false empty summary |
| Staff Management → Manage Services sheet | same as `/crm/staff` | same action | same `staff_services` policy/RPC path | same | No | Save updates local state immediately and refreshes route | Fixed stale props-only state and removed timeout-based close |
| `replace_staff_service_capabilities` RPC | callable by authenticated roles only | N/A | SECURITY INVOKER; RLS remains active; execute revoked from `public`/`anon` | Owner all branches; everyone else own branch | No | Validate actor, target, branch-active services; delete/insert atomically; return final service IDs | Added forward migration `20260617141348_crm_staff_service_capabilities_rpc.sql` |

## CRM workspace scan notes

| Area | Representative files | Observed authorization source | Notes |
| --- | --- | --- | --- |
| Today | `src/app/(dashboard)/crm/today/page.tsx` | inline allowed role list | Branch-scoped page context; not changed in this task |
| Bookings | `src/app/(dashboard)/crm/bookings/actions.ts` | inline allowed role list + branch checks | Existing actions check branch/owner before mutations; not changed |
| Schedule / availability | `src/app/(dashboard)/crm/schedule/actions.ts`, `src/app/(dashboard)/crm/staff-availability/actions.ts`, `src/lib/actions/staff-schedule-groups.ts` | schedule role sets + `canAdjustStaffSchedule()` | Previous task repaired group-rule RLS for legacy `csr`; not changed here |
| Staff | `src/app/(dashboard)/crm/staff/page.tsx`, `src/lib/actions/crm-staff-services.ts` | page role list + centralized CRM staff-service helper | Staff-service path fixed in this task |
| Services / provider assignments | `src/app/(dashboard)/crm/services/actions.ts` | `CRM_SETUP_ROLES` and explicit branch scope | Direct provider add/remove still uses separate insert/delete actions with last-provider protection; staff bulk replacement now uses atomic RPC |
| Dispatch | `src/app/(dashboard)/crm/dispatch/page.tsx` | inline allowed role list | Branch-scoped route; not changed |
| Waitlist | `src/app/(dashboard)/crm/waitlist/actions.ts` | inline allowed role list | Branch-scoped actions; not changed |
| Reconciliation | `src/app/(dashboard)/crm/reconciliation/page.tsx`, `actions.ts` | inline allowed role list | Page includes assistant/store manager; action list omits assistant/store manager and should be reviewed later |
| Setup Center | `src/app/(dashboard)/crm/setup/page.tsx` | inline `ALLOWED_ROLES` | Existing setup permissions are broader than some action-level helpers; not changed |

## Live database inspection status

The Supabase CLI is available at v2.95.6, but linked-project operations hung from this environment:

- `supabase db query --linked "select current_database(), current_user;"` timed out after 124 seconds.
- `supabase db push --linked --dry-run` hung and was manually terminated.
- `supabase db lint --local --schema public` failed because local Postgres on `127.0.0.1:54322` is not running.

Therefore this inventory verifies checked-in source and migrations, but not the live `pg_policies` state. Apply and inspect the new migration from an environment with working Supabase Management API or direct DB credentials before calling the live database portion complete.
