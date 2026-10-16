# CRM Therapist Assignment Provenance — bounded handoff

**Status:** Local implementation PASS; database verification gate OPEN.
**Authorization:** Owner supplied independent PASS for `fix/crm-grouped-order-display` at `38a99c1304f8a77203f05d73429dfb1cccee5e7c`, then authorized this provenance stage only.
**Branch:** `fix/crm-therapist-assignment-provenance` from `38a99c1304f8a77203f05d73429dfb1cccee5e7c`. Final commit is the branch tip accompanying this report.

## Implemented contract

- One forward migration adds `bookings.requested_staff_id` (nullable staff FK, `ON DELETE SET NULL`) and `therapist_selection_source` (default `legacy_unknown`, constrained to four allowed values). Existing rows are not inferred or backfilled.
- Public and CRM server paths derive provenance independently for each booking service line. The current atomic order RPC receives a server-authored line metadata transport object; a `BEFORE INSERT` trigger moves it into the dedicated columns and removes the transport object before storage. The existing CRM-MB1 migration is unchanged.
- CRM Quick Booking has a small, default-off “Customer requested this therapist” checkbox beside explicit therapist selection. First available is automatic; a manual choice without the checkbox is front-desk selected. The server validates the selected staff through existing branch, service, time, and authorization checks before claiming customer choice.
- CRM reschedule, therapist assignment, manager booking edit, and approved scheduling suggestion mutations update the source in the same booking update as `staff_id`. They omit `requested_staff_id`, preserving the customer's original request. Manual reassignment back to the requested staff remains `front_desk_selected` unless an authoritative customer-request fulfillment path is added later.
- A database trigger blocks `customer_selected` unless assigned and requested staff match, prevents direct authenticated provenance writes, and clears stale customer-choice provenance if an uninstrumented staff reassignment occurs. A CHECK constraint independently enforces the match.
- Compact badges appear beside service-line therapists in Cradle Flow, grouped order details, and single booking details. `front_desk_selected` and `legacy_unknown` display no badge. The parent order has no provenance badge.

## Verification

- Focused booking, grouping, allocation, and payment run: 111 tests passed across 18 files.
- Provenance badge and grouped display follow-up: 20 tests passed across 6 files.
- Manager branch/safety follow-up: 21 tests passed across 4 files.
- Targeted ESLint: passed. `pnpm type-check`: passed. `pnpm build`: passed. `git diff --check`: passed.
- A broader run had four existing `tests/app/crm/booking-actions.test.ts` assertion failures (including a duplicate in `.claude/worktrees/global-brand-logo`): the tests expect `{ success: true }`, while the unchanged action returns that plus booking ID/date/delivery type. This stage did not modify that action or test.
- Database target classification: **UNKNOWN**. No database connection, migration application, or live query was run. The migration's live behavior and PostgREST schema refresh remain unverified.
- Production verification: **NOT PERFORMED**. Production migration: **NOT APPLIED**.

## Changed files

- Migration and types: `supabase/migrations/20261016001208_therapist_assignment_provenance.sql`, `src/types/supabase.ts`.
- Creation and reassignment: `src/lib/actions/online-booking.ts`, `src/lib/bookings/inhouse-booking-engine.ts`, `src/lib/bookings/crm-booking-operations.ts`, `src/lib/bookings/therapist-provenance.ts`, `src/lib/validations/booking.ts`, `src/app/(dashboard)/manager/bookings/actions.ts`, `src/lib/scheduling/rules/apply-approved-suggestion.ts`.
- Query and view models: `src/lib/queries/bookings.ts`, `src/lib/crm/cradle-flow.ts`, `src/components/features/bookings/booking-workspace-types.ts`, `src/app/(dashboard)/crm/today/page.tsx`.
- CRM interface: `src/components/features/bookings/quick-booking-form.tsx`, `src/components/features/bookings/booking-list-row.tsx`, `src/components/features/bookings/selected-booking-command-pane.tsx`, `src/components/features/bookings/selected-booking-summary-band.tsx`, `src/components/features/bookings/therapist-provenance-badge.tsx`, `src/components/features/crm/today/cradle-flow-booking-dialog.tsx`, `src/components/features/crm/today/cradle-flow-group-dialog.tsx`, `src/components/features/crm/today/cradle-flow-ticket.tsx`.
- Tests and handoff: `src/lib/bookings/therapist-provenance.test.ts`, `src/components/features/bookings/therapist-provenance-badge.test.tsx`, this report.

## Scope and next gate

The existing CRM-MB1 migration `20261015105000_crm_mb1_attendee_line_resources.sql` was not edited or applied. The owner brief reports it as production-unapplied; this handoff does not independently verify that state. Unrelated pre-existing deletions in `docs/figma-crm-redesign/` were left untouched and excluded from this branch's commit.

Next permitted action is independent review and an authorized, classified LOCAL/TEST database migration verification. A checkpoint merge, deployment, production migration, and Service Duration Extension remain unauthorized.

**Rollback considerations:** Before migration application, reverting this commit removes the implementation without a database rollback. After migration application, preserve provenance columns and recorded customer requests during an application rollback; dropping them would discard newly captured data. Deploy code and schema in a reviewed sequence.
