# WEB Stage B — Inter-Branch Assistance Requests & Manager Decisions

## Control record
- Target: CradleHub Web (not Desktop); controlled stabilization, authorized Stage B.
- Authorized by owner 2026-11-05 after CSR interview and review of UI mockup.
- Branch: `stage/interbranch-assistance-request-ui-20261105`
- Verified base `main`: `3b671b1670535b5d070392112ec8bdbb6e7e7bd4` (Stage A merged).
- **No production data migration executed by this branch.** No implicit authorization to deploy/merge.
- CRM location: `/crm/schedule?tab=assistance`. Cradle Flow shortcut in side rail.
- Server flag: `CRADLEHUB_INTERBRANCH_ASSISTANCE_ENABLED=true` **only after** database migration, local/preview/browser QA and owner authorization. Default OFF.

## Business decisions (approved)
- Main and SM can request help from each other through CRM.
- CSR requests, lending branch manager/authorized management roles select and approve named staff. Owner can approve cross-branch.
- Staff types: therapist, nail technician, aesthetician/facialist.
- Main can request staff for in-spa or authorized Main Home Service; SM remains in-spa only.
- Manager confirms original-branch coverage before releasing staff. Selected staff remain employed by original branch and are expected to continue duty at receiving branch until shift ends.
- No automatically initiated transfer from a shortage warning in Stage B. Notifications are request/decision only; live shortage threshold unmeasured.

## Source of truth / scope
- `staff.branch_id`, `staff_schedules`, `staff_shift_checkins`, `bookings`, `booking_orders`, `branch_booking_rules`, and payroll remain **unchanged**.
- New `staff_assistance_requests` stores requesting/lending branch, role, count, required time window, visit type, notes, provisional selected staff, decision and actor ID.
- `staff_assistance_events` is append-only transition evidence inserted by an atomic row trigger. No routine delete grants.
- Server action checks authenticated CRM identity and branch, manager authority, active branches, home-service branch rule, exact named staff count, candidate staff home branch/service type and known cross-branch booking/assistance overlaps. Conditional update requires original status requested. Audit SQL trigger forbids changes to request identity or post-decision updates.
- Booking-conflict review is **provisional** only. It is not a replacement for the cross-branch transactional slot validator, staff schedule checks, travel-time readiness or source-branch coverage evaluation required by Stage C.
- Manager approval state `approved_pending_arrival` **does not** activate or reserve bookings, attendance, home-service dispatch or payroll. Staff cannot be assigned at the receiving branch using this record.
- The UI prominently states the limit, rather than saying staff are 'on duty' or 'bookable'.

## Implementation inventory
- Migration (unapplied): `supabase/migrations/20261105153000_interbranch_assistance_requests.sql`
- Server actions: `src/app/(dashboard)/crm/schedule/assistance-actions.ts`
- Policy/schema validation: `src/lib/staff/interbranch-assistance-request-policy.ts`
- CRM UI: `src/components/features/schedule/tabs/staff-assistance-tab.tsx`
- Schedule tabs/shell/page and Cradle Flow side rail/page/shell/dashboard adapted to show UI only under flag.
- Existing notifications types extended with three interbranch events; existing workflow notification delivery reused.
- Unit tests `tests/lib/staff/interbranch-assistance-request-policy.test.ts`.

## Release blockers / verification checklist (not claims)
1. **Migration history**: inspect production migration catalog and local-only migrations; do not bulk replay, mark applied or push anything for cleanup. Review the new SQL DDL alone. Regenerate TypeScript DB types after authorized apply.
2. **Security**: review SQL grants and both RLS policies against active staff identity, role and branch; test owner, manager (right/wrong branch), ordinary CSR (submit/deny approval), disabled/inactive staff, anon, service role and unauthorized branch. Test direct Data API INSERT/UPDATE/DELETE denial.
3. **Atomicity**: verify concurrent pending request approvals and audit trigger (all writes audited, failed/late decision unchanged). Confirm provisional cross-request candidate collision behavior, and DO NOT claim real-world booking reservation.
4. **Checks**: `pnpm type-check`; `pnpm exec vitest run tests/lib/staff/interbranch-assistance-contract.test.ts tests/lib/staff/interbranch-assistance-request-policy.test.ts`; targeted `pnpm exec eslint` on all changed TS/TSX; normal repository quality gates.
5. **Browser CRM** (authenticated, branch switching): Schedule Daily and Setup remain working; Assistance form responsive/mobile, outgoing and incoming views, manager review and candidate conflicts, default-off view, Cradle Flow quick link, notifications, and error if migration missing.
6. **Stage C** separate authorization: transactional cross-branch booking availability and hold enforcement, receiving arrival, single-shift clock out, Home Service Main dispatch, payroll and audit. Must verify in live browser and connected DB before any activation.
7. **Performance**: measure new workspace load time and query count before caching or rewrites.
8. **Production**: no deployment, live booking, native attendance or payroll verification claimed. No production change was performed in this conversation.

## Rollback
- Code: server flag OFF and revert Stage B PR.
- If migration later applied: preserve requests/events (auditable operations); do not drop production records to simplify rollback. Disable actions and follow a separately approved data-retention plan.
- Never modify existing payments, staff permanent branch or attendance records as part of this release.

## Limitations
- The signed-in CSR can submit and withdraw only pending requests. Manager of the lending branch or owner can provisionally approve or decline. After approval cancellation/amendment remains a Stage C contract.
- There is no automatic 'travelling', 'active', 'completed' or attendance transition in Stage B, no shortage prediction, and no automatic source-branch staffing check.
- Stage B is deliberately safe/partial rather than falsely presenting temporary staff as bookable.
- Exact SQL and RLS tests, unit tests, authenticated browser checks and a deployment check remain required. The repository connection commits source but does not execute pnpm.
