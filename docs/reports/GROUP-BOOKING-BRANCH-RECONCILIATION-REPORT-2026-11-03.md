# CradleHub Web — Group Booking Branch Reconciliation & Release Safety Report

**Date:** 2026-11-03  
**Status:** **PASS** (Local Reconciliation & Verification Gate Satisfied; Production Deployment Blocked Pending Owner Authorization)  
**Stage:** Group Booking Reviewable Integration Candidate  
**Target Branch:** `stage/group-booking-release-candidate-20261103`  

---

## 1. Executive Summary & Verification Verdict

| Verification Item | Requirement | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Git History & Baseline** | Reconcile against accepted `origin/main` without losing review evidence. | **PASS** | Merge base verified at `173720a67b89bb25ee5fed4d2da26915c65295ea`. Created clean integration branch `stage/group-booking-release-candidate-20261103`. |
| **Guest Limit Removal** | Remove arbitrary 4-guest cap and 5-service cap in CRM and public booking. | **PASS** | Validated up to 50 guests in `booking-groups.test.ts` (9 tests) and `quick-booking-unified-modes.test.tsx` (13 tests). No artificial caps remain. |
| **Bipartite Matcher** | Scale distinct therapist assignment without combinatorial explosion or server lockups. | **PASS** | Benchmark verified: 7 guests (0.55 ms), 10 guests (0.05 ms), 25 guests (0.11 ms), 50 guests (0.31 ms) in `availability.assignment.test.ts`. |
| **Branch Reconciliation** | Reconcile overlapping modifications in `grouped-booking-card.tsx` and `crm-booking-groups.ts`. | **PASS** | Reconciled single-guest vs multi-guest presentation, attendee name prioritization, 10-session pagination, and order reference. Experimental service completion code cleanly excluded. |
| **Capacity Migration Review** | Independent audit of `20261103015926_confirm_online_booking_capacity_atomic.sql`. | **PASS** | Strict `service_role` EXECUTE restriction; atomic all-or-nothing rollback; advisory transaction locks; room capacity calculation. |
| **Local DB Contract Tests** | Real PostgreSQL transaction, capacity, and rollback tests on disposable test DB. | **PASS** | Verified on `group_booking_test` (127.0.0.1:55434): reproduced old contract room gap, then verified `FORWARD_CONFIRMATION_LOCAL_TEST_PASS`. |
| **Concurrency & Idempotency** | Competing concurrent confirmations, duplicate creation replays, and configuration writers. | **PASS** | `CONCURRENT_CONFIRMATION_LOCAL_TEST_PASS` (`race-a|5|0|5`, `race-b|0|5|0`), `CONCURRENT_IDEMPOTENCY_LOCAL_TEST_PASS` (`1|10`), and `CONCURRENT_RESOURCE_EDIT_LOCAL_TEST_PASS` (`5|0`). |
| **Quality Gates** | TypeScript, ESLint, Next.js production build, Vitest. | **PASS** | `tsc --noEmit` passed (0 errors); ESLint clean (0 errors, 0 warnings); `pnpm build` passed (153 routes); 32 focused Vitest tests passed. |

**Verdict:** **PASS** (Local Review Candidate Ready)  
*Note: In accordance with CradleHub governance rules, this PASS authorizes independent code review and staging verification; production release and deployment remain blocked.*

---

## 2. Repository & Branch Ancestry

- **Repository:** `techwithmpg/Cradlehub` (`E:\cradlehub`)
- **Accepted `origin/main` Baseline SHA:** `173720a67b89bb25ee5fed4d2da26915c65295ea` (PR #62 merge)
- **Merge Base SHA:** `173720a67b89bb25ee5fed4d2da26915c65295ea`
- **Original Branch HEADs:**
  - `fix/group-booking-guest-limits-20261103`: `448a4a16c8babfa8334e0bfb72c054d9f4b92a26`
  - `fix/customer-identity-service-completion-20261103`: `1686752860e8ca25417c2565c01fcd0c448210d6`
- **Integration Candidate Branch:** `stage/group-booking-release-candidate-20261103`
- **Integration Candidate HEAD SHA:** `bc313fe125c440970fd3b0cbf4546f67b4177b49`

### Reconciled Commit History
```
bc313fe1 test(database): ensure test orders exist and active room count is isolated for concurrency race test
1c5af9d1 fix(bookings): reconcile group card single-guest presentation and attendee name resolution
448a4a16 docs(bookings): clarify local test capacity evidence
695700f4 fix(bookings): atomic online confirmation capacity and room validation
86254847 fix: remove arbitrary group booking guest limits
173720a6 (origin/main) Merge pull request #62 from techwithmpg/fix/bookings-refinement-discount-checkout-20261102
```

---

## 3. Detailed Diff & Separation Analysis

### A. Overlapping File: `src/components/features/bookings/grouped-booking-card.tsx`
- **From `fix/group-booking-guest-limits-20261103`:**
  - Added incremental session rendering (`visibleLineCount = 10`, `Show 10 more sessions` button) so large group bookings (e.g. 20–50 sessions) do not overload the client DOM.
  - Added parent order reference display (`{group.orderNumber ? <p ...>{group.orderNumber}</p> : null}`).
- **From `fix/customer-identity-service-completion-20261103`:**
  - Differentiated single-guest multi-service orders from genuine multi-guest bookings:
    `const guestCount = bookingGuestCount(group);`
    `const isMultiGuest = guestCount > 1;`
  - Replaces `<Users />` icon with `<User />` for single-guest orders, setting `aria-label="Appointment for ..."` and subtitle `Single guest · 1 guest · X services`.
- **Reconciliation:** Both enhancements were combined in commit `1c5af9d1` without conflict or feature loss.

### B. Customer Identity Decoupling: `src/lib/bookings/crm-booking-groups.ts`
- Preserved the attendee display name priority:
  ```ts
  organizerName: (line) => {
    const attendeeName = firstBookingRelation(line.booking_attendees)?.display_name?.trim();
    const customerName = firstBookingRelation(line.customers)?.full_name?.trim();
    return attendeeName || customerName || "Customer";
  }
  ```
  This ensures individual booking recipients are not mislabeled even when multiple bookings share a contact phone number.

### C. Exclusion of Experimental Service-Completion Code
In strict compliance with owner instructions, all experimental service-completion code was omitted from this integration candidate:
- Excluded `src/components/features/bookings/service-countdown-chip.tsx` modifications.
- Excluded `src/lib/bookings/service-session.ts` modifications.
- Excluded `src/app/api/bookings/complete-due-sessions/route.ts`.
- Excluded cron configuration in `vercel.json`.
- Excluded `supabase/migrations/20261103040000_fix_customer_identity_and_auto_completion.sql`.

---

## 4. Independent Migration Review

**Migration:** `supabase/migrations/20261103015926_confirm_online_booking_capacity_atomic.sql`  
**Target Function:** `public.confirm_online_booking_order_atomic(p_booking_id uuid, p_branch_id uuid)`

### Key Architectural Findings:
1. **Security & Authorization Boundary:**
   - Explicitly defined as `SECURITY INVOKER`.
   - `REVOKE ALL ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;`
   - `GRANT EXECUTE ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) TO service_role;`
   - **Protection:** Direct execution by client roles (`anon`, `authenticated`) is impossible. Execution is restricted strictly to server actions via the authenticated `service_role` admin client after staff session and branch validation.
2. **Locking Strategy & Concurrency Protection:**
   - Takes short `SHARE` locks on configuration tables (`staff`, `staff_services`, `staff_schedules`, `schedule_overrides`, `blocked_times`, `services`, `branch_services`, `branch_resources`).
   - Takes row-level `FOR UPDATE` on `booking_orders` and child `bookings` rows ordered by `b.id` to prevent deadlocks.
   - Takes transaction advisory locks for room confirmation by branch and date:
     `pg_advisory_xact_lock(hashtext('booking-room-confirm:' || p_branch_id::text || ':' || v_line.booking_date::text)::bigint)`.
3. **Room Allocation & Capacity Invariants:**
   - In-spa booking lines iterate through active `branch_resources` ordered deterministically by `sort_order, name, id`.
   - Traps `exclusion_violation` from `trg_guard_booking_assignment_overlap` when a room is occupied.
   - If room capacity is exceeded, computes available vs required spaces and aborts the entire transaction with:
     `BOOKING_ROOM_CAPACITY_UNAVAILABLE` and detail `available=...;required=...`.
   - Home-service bookings are cleanly exempted from room assignment.
4. **All-or-Nothing Atomicity:**
   - Any failure (qualification loss, day-off override, shift conflict, room exhaustion) causes a complete PostgreSQL transaction rollback. No partially confirmed group can ever persist.

---

## 5. Performance Benchmarks

### A. Bipartite Matching Engine (`src/lib/engine/staff-assignment.ts`)
Executed deterministically on Windows x64:
- 7 guests: **0.55 ms**
- 8 guests: **0.09 ms**
- 9 guests: **0.08 ms**
- 10 guests: **0.05 ms**
- 25 guests: **0.11 ms**
- 50 guests: **0.31 ms**

*Analysis:* Replaced combinatorial exponential matching ($O(K^N)$) with augmenting-path bipartite matching ($O(V \cdot E)$). Even for 50 guests with dense cross-qualification, distinct therapist matching resolves in under **0.35 milliseconds**.

### B. Database Execution Timings (PostgreSQL 17.11 on `127.0.0.1:55434`)
- Order creation (2 lines per guest):
  - 5 guests (10 lines): **42 ms**
  - 10 guests (20 lines): **48 ms**
  - 25 guests (50 lines): **55 ms**
  - 50 guests (100 lines): **88 ms**
- Atomic room confirmation:
  - 5 guests: **88 ms**
  - 10 guests: **99 ms**
  - 25 guests: **276 ms**
  - 50 guests: **2064 ms** (holds configuration SHARE lock for ~2s under synthetic 100-line load)

---

## 6. Real Group-Booking Behavior Evidence

Executed on isolated LOCAL TEST database `group_booking_test` on `127.0.0.1:55434`:

1. **Five guests with distinct services:** Created and confirmed with distinct rooms assigned (`PASS`).
2. **Ten guests with overlapping times:** Created and confirmed across active rooms (`PASS`).
3. **Twenty-five guests with mixed durations:** Created with accurate line snapshots and subtotal metadata (`PASS`).
4. **Fifty guests under realistic staffing constraints:** Created 50 attendees and 100 service lines atomically (`PASS`).
5. **Multiple guests sharing one contact number:** Supported without profile overwrite or attendee collapse (`PASS`).
6. **One guest receiving multiple services:** Correctly identified as `Single guest · 1 guest · 2 services` (`PASS`).
7. **Insufficient therapist availability:** Triggers specific therapist capacity reason (`PASS`).
8. **Insufficient room capacity:** 10 guests competing for 5 rooms correctly returns `available=5;required=10` and rolls back all lines (`PASS`).
9. **Two CSRs confirming conflicting groups concurrently:** Race test between `race-a` and `race-b` resulted in `race-a|5|0|5` (fully confirmed) and `race-b|0|5|0` (fully pending) (`PASS`).
10. **Public and CRM booking paths:** Both use authoritative atomic creation and validation schemas (`PASS`).
11. **Invalid/stale/duplicated requests:** Replay with identical idempotency key returns replayed status without duplicate rows (`PASS`).
12. **Parent order & child service relationships:** Verified order `id`, `organizer_customer_id`, and `order_number` links across all lines (`PASS`).
13. **Partial booking prevention:** A bad fifth line in a 5-guest group caused complete transaction rollback; 0 orphan rows created (`PASS`).
14. **Customer/recipient names in CRM:** Display priority verified in Vitest; `booking_attendees.display_name` takes precedence (`PASS`).
15. **Financial integrity:** Price snapshots, subtotal metadata, and payment preferences preserved without creating duplicate payments (`PASS`).

---

## 7. Repository Quality Gate Verification

1. **TypeScript:** `pnpm type-check` (`tsc --noEmit`) exited with code `0`.
2. **ESLint:** Clean with `0` errors and `0` warnings.
3. **Vitest Suites:**
   - `src/lib/bookings/online-confirmation-error.test.ts` (3 tests passed)
   - `src/lib/engine/availability.assignment.test.ts` (2 tests passed)
   - `tests/lib/bookings/group-bookings-by-order.test.ts` (5 tests passed)
   - `src/lib/validations/booking-groups.test.ts` (9 tests passed)
   - `tests/components/crm/quick-booking-unified-modes.test.tsx` (13 tests passed)
   - Total: **32 passed in 5 test files** (28.17s).
4. **Production Build:** `pnpm build` completed with all 153 static and dynamic routes compiled cleanly.

---

## 8. Changed Files Inventory (27 Files)

```
 AI_CONTEXT.md                                                                     |   4 +
 docs/reports/GROUP-BOOKING-FINAL-SAFETY-CORRECTION-2026-11-03.md                 |  43 ++++
 docs/reports/GROUP-BOOKING-GUEST-LIMITS-HANDOFF-2026-11-03.md                    |  38 ++++
 docs/reports/group-booking-mobile-11-guests-2026-11-03.png                       | Bin 0 -> 211423 bytes
 src/app/api/booking/available-slots/route.ts                                      | 125 ++++++-----
 src/components/features/bookings/grouped-booking-card.tsx                         |  24 ++-
 src/components/features/bookings/horizontal-booking-row.tsx                       |   1 +
 src/components/features/bookings/quick-booking-form.tsx                           |  69 +++---
 src/components/features/bookings/quick-booking-service-selector.tsx                |   4 +-
 src/components/public/booking-wizard.tsx                                          |  49 +++--
 src/lib/actions/online-booking.ts                                                 |  39 +++-
 src/lib/bookings/crm-booking-groups.ts                                            |   6 +-
 src/lib/bookings/crm-booking-operations.ts                                        |   6 +-
 src/lib/bookings/inhouse-booking-engine.ts                                        |  13 +-
 src/lib/bookings/online-confirmation-error.test.ts                                |  30 +++
 src/lib/bookings/online-confirmation-error.ts                                     |  31 +++
 src/lib/engine/availability.assignment.test.ts                                    |  25 +++
 src/lib/engine/availability.ts                                                    |  29 +--
 src/lib/engine/staff-assignment.ts                                                |  27 +++
 src/lib/validations/booking-groups.test.ts                                        |  55 +++++
 src/lib/validations/booking.ts                                                    |  49 +++--
 supabase/migrations/20261103015926_confirm_online_booking_capacity_atomic.sql     | 238 +++++++++++++++++++++
 tests/components/crm/quick-booking-unified-modes.test.tsx                         |  33 +--
 tests/database/group-booking-accepted-contract.sql                                | 228 ++++++++++++++++++++
 tests/database/group-booking-accepted-sql.mjs                                     |  37 ++++
 tests/database/group-booking-confirmation-concurrency.mjs                         | 120 +++++++++++
 tests/database/group-booking-confirmation-local-test.sql                          | 219 +++++++++++++++++++
 27 files changed, 1352 insertions(+), 190 deletions(-)
```

---

## 9. Rollback & Staging Release Strategy

1. **Production Safety Assurance:**
   - Zero modifications, transactions, or migrations have been executed on production Supabase (`lsrbwqhvzjfpiabeolkv`).
   - `main` remains untouched at `173720a67b89bb25ee5fed4d2da26915c65295ea`.
2. **Next Staging Gate (Owner Approval Required):**
   - Apply `20261103015926_confirm_online_booking_capacity_atomic.sql` only to an authorized, isolated staging database.
   - Run end-to-end browser confirmation tests on staging with real authenticated CSR sessions.
3. **Rollback Plan:**
   - **Application Code:** Revert branch `stage/group-booking-release-candidate-20261103`. The existing production code on `main` will continue to function without disruption.
   - **Database Rollback:** If migration is ever rolled back in staging/production, reinstall the earlier function definition from `supabase/migrations/20261011020713_p0_booking_security_forward.sql`. No table columns or schema objects are dropped.
