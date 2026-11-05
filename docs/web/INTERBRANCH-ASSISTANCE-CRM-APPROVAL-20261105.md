# WEB — CSR-only inter-branch assistance decision correction (2026-11-05)

## Owner decision (supersedes Stage A/B manager-approval assumption)
The existing `Schedule → Assistance` workflow remains fully inside CRM:
- CSR at the **requesting branch** submits and may cancel their branch's pending request.
- CSR at the **lending branch** independently reviews the request, selects provisional staff and approves or declines.
- Staff from either Main Spa or SM can be requested; both directions follow the same branch-scoped rule.
- **No manager or owner sign-off** and no manager/owner bypass in the operational server actions.
- Each action is bound to the authenticated CSR's currently assigned branch. Requesting-branch CSR cannot decide their own outgoing request. Staff may not be offered to the same branch.
- Existing app roles are canonicalized by `getActor()`; `crm` is the canonical CSR system role.
- This updates the former accepted Stage A/B manager-authority assumption; preserve earlier documents as historical decisions, not active guidance.

## Exact changes
- `src/lib/staff/interbranch-assistance-request-policy.ts`: restrict create, lend-branch review, requester cancellation to canonical CRM.
- `src/lib/staff/interbranch-assistance-contract.ts`: align pure authorization helper with the same CRM rules; unchanged eligibility/overlap checks.
- `src/app/(dashboard)/crm/schedule/assistance-actions.ts`: server-side denial messages and notifications say lending branch CSR.
- `src/components/features/schedule/tabs/staff-assistance-tab.tsx`: show Review only to CSR in lending branch, update instructions and decision note.
- Targeted tests for Main → SM / SM → Main, wrong branch, absent branch, manager/owner rejection, pending cancellation restrictions.
- No unrelated Schedule, Booking, Attendance, Payroll, Dispatch, or Desktop changes.

## Observed runtime/catalog evidence and release state
- Live **read-only** Supabase query on 2026-11-05: `public.staff_assistance_requests` and `public.staff_assistance_events` do not currently exist in the connected production DB.
- PR #69 was already merged as main SHA `5004e15b4e4e5c8601d301856ce271f1490f1b00` before this correction.
- CRM-only source branch `fix/interbranch-assistance-crm-approval-20261105`, base `5004e15b4e4e5c8601d301856ce271f1490f1b00`.
- Existing `supabase/migrations/20261105153000_interbranch_assistance_requests.sql` is **unchanged and not replayed**. It has broader historical **read-only** RLS for owner/management oversight, but direct client writes are denied and the server actions now deny all non-CRM workflows. Audit viewing does not make those roles approvers.
- The server-side flag remains default OFF, and migration/QA/release requires a separate approved step.

## Non-negotiable protections
- A CSR's affirmative provisional decision **does not make visiting staff bookable** and does not generate attendance or payroll records.
- Keep actor identity derived from server session and canonical staff role; never trust a submitted branch ID for authorization.
- Approval still requires exactly named eligible staff and rejects known appointment or other provisionally approved assistance overlaps. These are not transactional booking guarantees; cross-branch availability/attendance requires a separate authorized stage.
- No Home Service at SM; obey existing branch booking rules.
- Incoming/outgoing visibility remains branch-scoped; notifications go to `crm` in the respective branch.

## Release gates, not claimed executed
- `pnpm type-check`
- `pnpm exec vitest run tests/lib/staff/interbranch-assistance-contract.test.ts tests/lib/staff/interbranch-assistance-request-policy.test.ts`
- `pnpm exec eslint src/lib/staff/interbranch-assistance-contract.ts src/lib/staff/interbranch-assistance-request-policy.ts src/app/'(dashboard)'/crm/schedule/assistance-actions.ts src/components/features/schedule/tabs/staff-assistance-tab.tsx tests/lib/staff/interbranch-assistance-contract.test.ts tests/lib/staff/interbranch-assistance-request-policy.test.ts`
- Independent review + role allow/deny tests for Main CSR, SM CSR, manager, owner, no session, and branch mismatch; ensure unauthorized cross-branch review/cancel cannot bypass server checks.
- Authenticated desktop/mobile browser verification of request and review UI after separately approved migration and flag enablement.
- No production database writes, live browser tests, CI builds or deployment were performed during this correction.
- Rollback: revert this fix on authorized branch; preserve historical request/event records if database migration is later enabled. No SQL rollback necessary for this specific permission-only correction.
