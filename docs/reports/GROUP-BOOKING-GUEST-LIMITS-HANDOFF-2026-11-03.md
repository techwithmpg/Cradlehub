# Group booking guest limits — local review handoff

**Authorization:** 2026-11-03 owner-approved request to remove artificial CRM and public guest and total-service caps, preserve operational capacity and atomic booking behavior, and prepare review without migration execution, push, merge, or deployment.

**Branch:** `fix/group-booking-guest-limits-20261103` from accepted `origin/main` `173720a67b89bb25ee5fed4d2da26915c65295ea`. Implementation head is the local commit on this branch; resolve the exact handoff SHA with `git rev-parse HEAD`. **Review verdict:** LOCAL CODE PASS; RELEASE CORRECTION REQUIRED. Independent review and database-backed acceptance are outstanding.

## Changed scope and decisions

- `src/lib/validations/booking.ts`: removed attendee, total-service and per-guest service-count caps for CRM and public booking; require public recipient names, distinct IDs, organizer consistency, and service-union consistency.
- `src/components/features/bookings/quick-booking-form.tsx`, `quick-booking-service-selector.tsx`: Add Guest and Save no longer enforce four guests or five services; compact guest navigation shows one editable card at a time and requires real names. Availability preview queries follow the selected guest rather than silently stopping after three additional guests.
- `src/components/public/booking-wizard.tsx`: removed both public ten-guest guards; group availability uses POST so large attendee requests are not constrained by URL length; slots load only after every guest has services; names are required before continuing; confirmation list is height-bounded.
- `src/app/api/booking/available-slots/route.ts`: accepts any attendee count and service-line count within a 512 KB request-size safeguard; retains the existing service eligibility and scheduling engine.
- `src/lib/engine/staff-assignment.ts`, `availability.ts`: replaced combinatorial therapist matching with distinct bipartite matching, preserving per-guest qualification and time candidates; capacity failures now explain the number of available therapists when count is the constraint.
- `src/lib/actions/online-booking.ts`: enlarged the public payload byte guard to 512 KB, checks concurrent room capacity before public group submission, returns therapist capacity reasons, and refuses to report success when RPC attendee or line counts differ.
- `src/lib/bookings/inhouse-booking-engine.ts`: checks the atomic RPC response counts before reporting CRM success.
- `src/components/features/bookings/grouped-booking-card.tsx`, `horizontal-booking-row.tsx`: group expansion displays ten sessions at a time with an explicit load-more control; group and individual rows show the parent order reference.
- Tests: `src/lib/validations/booking-groups.test.ts`, `src/lib/engine/availability.assignment.test.ts`, `tests/components/crm/quick-booking-unified-modes.test.tsx`.
- Browser evidence: `docs/reports/group-booking-mobile-11-guests-2026-11-03.png`.

No discount migration, historical migration, payment writer, authorization policy, or database schema was changed.

## Evidence actually obtained

- `pnpm exec vitest run ... --exclude '**/.tmp/**'`: **40 tests passed in 7 files**, including 1, 4, 5, 10, 11, 20, 25, and 50 guest inputs with two services per guest; duplicate IDs and missing names rejected; CRM 50-guest editor remained navigable in jsdom.
- `pnpm type-check`: passed. Scoped `pnpm exec eslint`: passed. `pnpm build`: passed. `git diff --check`: passed.
- Matcher baseline, infeasible dense group: 7 guests 0.94 ms, 8 guests 4.23 ms, 9 guests 18.75 ms, 10 guests 211 ms. After change: 10 guests 0.03 ms and 50 guests 0.13 ms on the same machine and test runner. These are pure matching timings, not database booking throughput.
- CRM jsdom rendering and addition of 50 guests: 4.77 s in the final focused run. This includes test-event overhead and is not a browser load measurement.
- Read-only browser at local `http://localhost:3000/book`, configured to **PRODUCTION** Supabase public catalog: added an 11th guest after the former ten-guest threshold; Add Guest stayed enabled. At a 390 px viewport, document width was 390 px. No booking submission or customer/payment mutation occurred.

## Remaining limitations and release gate

1. No classified isolated LOCAL/TEST database target was available. The 1–50 guest cases were schema and UI tests, not end-to-end booking inserts. Atomic rollback, concurrent insert conflict handling, price snapshots, recipient discounts, payments, and measured booking-creation load remain unverified.
   Docker Desktop's Linux engine was not running and no local `psql` executable was available. No database target was inferred from `.env.local` for mutation.
2. Public online orders retain the existing `pending_crm_confirmation` workflow. The existing atomic public RPC inserts service lines with `resource_id = NULL`. The new room preflight rejects insufficient room capacity at submission time, but it does not reserve rooms atomically or protect against another concurrent request taking capacity before CRM confirmation. This is a release-blocking gap against the owner's room/concurrency acceptance criteria. A reviewed forward database change and isolated transactional test are needed; historical and installed discount migrations must remain unchanged.
3. Grouped and individual display code passed type/build checks, but no authenticated CRM browser session was available for visual acceptance. Public browser verification covered eleven guests on mobile, not a live 50-guest booking.
4. The 512 KB request-size safeguard is an infrastructure/abuse boundary. If a valid group exceeds it, the UI reports the precise size limit and directs the user to the branch; it does not silently truncate guests.

**Next permitted action:** independent review, then isolate a LOCAL/TEST database and complete atomic booking, capacity, concurrency, discount/payment, and load tests. A forward room-reservation correction requires its own reviewed migration and target-aware execution gate. **Not authorized here:** production migration, production booking mutation, push, merge, or deployment.
