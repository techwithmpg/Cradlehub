# CradleHub Web — C3 Booking Stabilization Scope Freeze (DRAFT FOR OWNER REVIEW)

**Track:** Web — CONTROLLED STABILIZATION  
**Stage:** C3 — Scope Freeze, documentation and review only  
**Status:** PROPOSED / OWNER APPROVAL PENDING — **NOT AN IMPLEMENTATION AUTHORIZATION**  
**Verified base:** `47b456d46fd5b492080ae0037cb0393ae696ca89` (`main` at review)  
**Documentation branch:** `stage/web-c3-booking-scope-freeze-20261110`  
**Production impact:** NONE authorized. No production SQL, application deploy, merge, or migration replay.  
**Local backend:** existing Docker Supabase `cradlehub-p0-local-auth-test`, agent-reported C2 database structural-parity PASS; independently audited local artifacts and actual application simulations remain separate acceptance evidence. No production data copied.

## 1. Problem and target outcome

The CRM booking modal currently displays only `activeGuestId`'s editing card; adding an additional guest makes the organizer/main client editing card disappear from view. The booking form's service presentation, preliminary therapist recommendations, and authoritative server booking allocation do not consistently explain or preserve the same choices. We must prevent avoidable CSR mistakes while preserving correct availability, authentication, payment, and room/therapist capacity.

**Target:** a predictable group-booking modal and a single authoritative booking contract from quote/preview through confirmed allocation, including qualified/on-duty recommendations, capacity-safe groups, and explicitly permitted late service starts.

## 2. Scope boundaries and critical sequencing

This document freezes the **proposed correction scope**, not implementation or release. Proceed in this order only after the appropriate stage decision/authorization:

- **P0 security prerequisite (separate isolated fix branch):** `src/lib/actions/attendance-queue.ts` exports `getAttendanceQueueSuggestionAction` and `getAttendanceQueueStatusAction` using privileged `createAdminClient()` with untrusted `branchId` and no visible caller/branch authorization. Agent-reported isolated direct-action tests returned queue data without a caller identity; external HTTP exploitability is not independently established. Inspect all consumers; implement a minimal fail-closed, server-side identity/role/branch check (and prefer caller-scoped queries), preserving authorized outputs. Test both actions through actual Next.js Server Action transport with synthetic anonymous, staff, cross-branch, CSR, manager, owner cases. No permission expansion, RLS bypass or unrelated FIFO redesign. This is a **P0 release gate**, not part of Pass 1.
- **Pass 1 — P1 booking modal:** preserve organizer/main-client card first; append each additional guest card vertically within the existing size-constrained internal scroll. Keep each guest editable without switching the entire panel to one active guest. Target validation scrolling/focus to the actual invalid guest/field, maintain stable guest IDs/draft state, keyboard access, add/copy/remove, sticky save/summary visibility, responsive desktop behavior. Avoid broad redesign or changing booking backend.
- **Pass 2 — P1 service catalogue / capability:** show discoverable active, branch-configured services; do not hide a valid service because a therapist cannot provide it. Respect delivery-mode eligibility: mode-incompatible services should be shown unavailable with a reason rather than made silently bookable. Filter *selectable and recommended staff* by authoritative ability to perform **every selected service**, branch eligibility, date/time, shift/attendance as applicable, current conflicts, and resource rules. Eliminate inconsistent permissive role/name inference unless its authoritative policy is demonstrated. Preserve server-side validation.
- **Pass 3 — P1 fair recommendations:** unify single and group allocation candidate criteria and ordering. Qualification, service coverage, actual slot availability, staff schedule, booking conflicts, explicit client request, and hard business rules take precedence. Use verified check-in timestamps for same-day on-duty candidate ordering, not incidental staff-query order. **Owner decision pending:** whether fairness means simple earliest eligible check-in or rotation after a therapist receives work; no rotation change may be implemented before explicit policy approval. Capture stable tie-breakers, restart/rescan, split-shift and checked-out cases. Future scheduled bookings need a distinct defined policy.
- **Pass 4 — P1 group booking consistency:** per-guest names, services, durations and therapist preferences must be visible, editable, and unambiguous. Do not imply guaranteed per-guest exact therapist selection until server support and owner policy are approved; current server returns `EXACT_THERAPIST_UNSUPPORTED_FOR_GROUP`. For each guest allocate distinct qualified staff for simultaneous appointments and available rooms when needed; no arbitrary group cap if true operational capacity permits. Preview must be explicitly provisional until final authoritative transaction; if allocation changed or failed, inform CSR before confirmation, never silently imply the preview was committed. Preserve transaction rollback, race locking, idempotency and price snapshots. Review existing unmerged group booking safety work before any replacement.
- **Pass 5 — P1 late-booking integrity:** Main Spa owner-requested **22:30 home-service latest booking START**, not an arbitrary end-of-service cutoff; do not change SM Branch automatically. Existing production `branch_booking_rules.home_service_end_time` was read-only verified as **22:00** at earlier review and needs a separately authorized, exact production change if approved for release. Establish business-date/cross-midnight timestamp semantics, shift/overtime/travel/driver and resource occupancy, allow valid work after closing only when approved by actual constraints. Do not bypass schedule authorization or silently change business rules. Test 22:29, 22:30, 22:31, overnight rollover, extended duration, concurrency, in-spa vs home service.
- **Pass 6 — P0/P1 regression and release gates:** booking-to-payment lifecycle, discounts/quotes and cash drawer, reschedule/cancellation, staff and room atomic conflicts, branch RLS/privileged authorization, attendance isolation, notification transport, two authenticated CRM browsers, reconnect and no-duplicate reconciliation, large groups constrained by true capacity, API/server-action errors, browser screenshots, and rollback evidence.

## 3. Explicitly out of scope

No boutique features, general UI redesign, new booking product, experimental architecture, worker/queue feature not needed for defects, bulk data seeding, copy of production PII, destructive migration cleanup, unapproved shift rule changes, production SQL execution, deployment, or merges. Do not refactor existing consumers without an owner-approved behavior contract and regression safety. Preserve C2 Docker state and historical diagnostic worktree; create independent clean stage/fix worktrees from verified accepted `main` when authorized.

## 4. Source-of-truth and known dependencies

- CRM form: `src/components/features/bookings/quick-booking-form.tsx` — current `activeGuestId` conditional rendering confirmed in repository.
- Exact-time CRM availability: `src/lib/engine/exact-crm-booking-time.ts` — current cross-midnight unsupported code path and differing recommended provider ordering.
- Group allocation: `src/lib/engine/availability.ts` (`assignTherapistsForOrder`) — current seniority ordering, all-attendee preferred staff prioritization.
- Booking write contract: `src/lib/bookings/inhouse-booking-engine.ts` — exact customer requested therapist unsupported for groups.
- Attendance queue: `src/lib/actions/attendance-queue.ts` — P0 authorization and separate queue-ordering concern.
- Already merged: PR #88, public/CRM booking consistency and Realtime bridge; preserve.
- **Open draft:** PR #91 (`fix/web-p1-booking-operations-20261109`) touches booking operations, public booking, reminders/holds, and CRM views. Compare before changing overlapping files. Do not silently fold its proposed SQL or unmerged code into these passes.
- Historic unmerged `fix/group-booking-guest-limits-20261103` may contain review-only room-confirmation correction. Verify base/head, consumer impact and current accepted contract before using. No speculative replay.
- **Production verification caution:** repository/agent evidence must not be promoted into a claim of executed production testing; label any such claims `REPOSITORY-RECORDED PRODUCTION EVIDENCE`. Actual database structure and current deployment SHA require targeted read-only verification when relevant to a release.

## 5. Acceptance criteria and test gates

### Pass 1
- One guest: booking form unchanged in normal behavior; add 2–10 guests while organizer stays first and editable without navigation toggle.
- Modal outer dimensions stable at approved front-desk desktop resolutions; only guest section scrolls; no missing save/summary.
- Add/remove/copy services preserves per-guest state; invalid field focuses correct card; quote totals and save payload unchanged.
- CSR Playwright browser evidence and component regression tests.

### Pass 2–3
- Same selected services yield identical eligible staff whether previewed as single/group; unqualified staff never selectable; no missing valid branch service.
- Arrival and tie-break cases deterministic; checked-out/unscheduled/busy staff not incorrectly recommended; client-selected qualified therapist is not silently overridden.
- Targeted role/branch and capability tests at both UI and server.

### Pass 4
- Preview flagged provisional; committed allocations shown from server response; each guest gets compatible staff and resource with no collision.
- Two simultaneous group submissions either reserve capacity atomically or return a recoverable conflict with no partial order/payment integrity loss.
- Failure and retry idempotency tests, plus 1/5/10/20/50-guest capacity tests in isolated LOCAL/TEST when suitable.

### Pass 5–6
- Time window tests respect latest start vs finish, midnight date rollover, travel buffer and staff approval rules.
- Booking-to-payment and cancellation/rescheduling pass; two authenticated CRM sessions render correct updates without manual refresh, including after reconnect.
- Current targeted repo quality gates: `pnpm type-check`, `pnpm lint`, `pnpm exec vitest run <targeted tests>`, `pnpm build` as applicable; record exact commands, exit codes and scope. Browser/native/database/production evidence must never be invented.

## 6. Owner decisions required before implementation

1. **Fairness policy:** strict earliest checked-in eligible person, or a rotation based on elapsed wait/work already allocated? Define when queue position resets.
2. **Group exact therapist:** permit per-guest guaranteed selection (subject to final availability) or keep non-guaranteed suggestions until a separate contract is approved?
3. **Mode-incompatible services:** visible but disabled with reason (proposed), or separate mode tabs? Both must preserve backend restrictions.
4. **Late bookings:** authorize Main Spa 22:30 home-service **latest start** and define explicit overtime/travel approval conditions for crossing midnight. SM Branch stays unchanged.
5. **UI freeze:** accept compact stacked editing cards with internal scroll and a visible summary/save, with no broader modal redesign.

## 7. Handoff and decision record

**C3 review verdict: DRAFT — OWNER REVIEW REQUIRED.**  
No implementation, tests, SQL, deployment or merge occurred as part of drafting this scope document. Completion of C2 does not by itself authorize C3 or subsequent correction stages; this draft is for the owner's review, freeze decision and approval record. After owner freezes this scope, use Web C4 for the UI/workflow plan; implement only separately authorized corrections in C5+ on targeted fix/stage branches. Each pass must produce target, branch, base/head SHAs, changed files, tested consumers, checks, safe rollback, external review and owner approval before merge. Web and Desktop governance remain distinct.
