# BKM — Proposed larger-group capacity contract

**Status:** Assessment and proposed gate only. Four CRM guests remain the maximum that can be submitted. This document does not authorize a higher limit, database change, deployment, or order splitting.

## Current source boundary

The CRM `createInhouseBookingMultiSchema` accepts at most four attendees, at most five services per attendee, and at most twenty distinct order service IDs. The public online schema independently allows ten attendees and is not evidence of CRM capacity. CRM group attendees share a start time; each guest's service lines run sequentially while guest chains run concurrently. The engine generates one order with attendee and line sequences, invokes `assignTherapistsForOrder`, allocates in-spa rooms via `allocateResourcesForAttendees`, computes Home Service travel at order level, and calls `create_inhouse_order_with_payment_atomic`. The wrapper delegates to BKG3, creates service payable items and a Home Service fee within the database transaction, and preserves the current payment and idempotency checks. Source inspection does not prove the installed database function version or higher-capacity correctness.

At twenty guests, five services per guest could produce one hundred booking lines even though the distinct-service union is at most twenty. The current source does not establish an accepted total-line or operational-staff limit. The room allocator uses sequential first-fit allocation against active resources and existing reservations; a higher limit needs a feasibility and conflict audit. The recursive distinct-staff matcher can backtrack; a fast feasible synthetic case is not a worst-case bound. Existing group failures are order-level rather than guest-specific.

## Proposed configuration boundary for owner decision

If higher capacity is approved, introduce one server-owned effective `maxCrmGroupAttendees` with a default of four, scoped by branch or rollout policy. The upper ceiling, configuration storage, maximum aggregate booking lines, and operational launch branches remain undecided. The client reads this authoritative value and the server enforces it; neither a UI prop nor the public-booking limit may raise live CRM capacity. A request above capacity fails before pricing or writes with an explicit limit. One group remains one financial order. No automatic multi-order split is permitted.

## Required capacity verification

| Area | Evidence needed before a higher limit |
| --- | --- |
| Validation | Valid/invalid 5, 10 and 20 attendee payloads; duplicate IDs, service union and total-line cap, quote versions, precise Home Service destination, branch scope, and marked therapist fields. |
| Joint staff allocation | Real branch candidate counts and schedules, exact pins, shortage/conflict cases, attendance and qualifications, overlapping bookings and travel buffers; measure p50/p95 and worst safe cases. No caching that bypasses authoritative checks. |
| Rooms | Capacity and overlap at different service durations; cases where first-fit fails despite a feasible alternative; no rooms for Home Service. |
| Atomic booking/payment | Classified LOCAL/TEST transactions for 5/10/20 guests: attendee/line mapping, totals, transport charge, invalid payment rollback, cash drawer/account rejection, idempotent replay and changed-payload conflict. |
| Consumers | CRM Today, Schedule, Bookings, Cash Flow, notifications, public booking and Desktop v1 projections under large orders; pagination, labels, totals, performance, and branch authorization. |
| Browser UI | Real 1920×1080, 1440×900 and 1366×768 measurements for 5/10/20 non-submitting cards, scrolling, focus, summary/actions and memory. Diagnose before optimizing. |

Performance acceptance thresholds and the first capacity above four require owner and operational review after realistic LOCAL/TEST measurements. A source-only or mocked pass cannot establish transactional or production safety.

## Safe local measurements and diagnosis

The local 5/10/20-card jsdom add sequence was 584/1814/6927 ms in the final prior run. The form maps every attendee to a fully expanded `renderBookingGuest` tree on each addition; the service selector and duration controls are not memoized by guest. Sequential additions therefore rerender a growing set of cards and can explain the superlinear jsdom time. This is a source-level diagnosis, not a browser frame measurement or proof that rendering is the only cost. The current production Add Guest limit remains four.

The existing pure `findDistinctStaffAssignment` function was measured with overlapping but feasible synthetic candidate lists (100 runs per size): 5 guests p50 0.002 ms / p95 0.009 ms, 10 guests 0.001 / 0.002 ms, 20 guests 0.002 / 0.007 ms. This excludes database candidate enumeration, quotes, room checks, transaction work, realistic shortages, and pathological backtracking. It does **not** authorize a larger capacity or algorithm change.

The configured `.env.local` Supabase project is recorded in repository evidence as **PRODUCTION**. No LOCAL/TEST target was identified or queried in this pass. The capacity gate remains closed.
