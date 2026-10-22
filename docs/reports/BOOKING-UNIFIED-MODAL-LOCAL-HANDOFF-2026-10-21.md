# Unified booking modal — local design-contract addendum

Status: **CORRECTION REQUIRED for release**. This document records local implementation evidence and proposed booking-specific C3/C4 additions; it does not record owner acceptance of a new server or Desktop contract.

## C3 scope reconciliation

- One CRM modal now renders the same vertically stacked, expanded guest card for Walk-in, Phone/Future, and Home Service. The existing four-guest and five-services-per-guest server limits remain.
- Each card retains independent service selections and quote-backed service-line durations. One order start time remains shared by guests; services within a guest run in sequence.
- The Phone/Future tab retains the distinct `phone` and `standard_future` sources. Choosing the tab from another mode requires an explicit compact Call/Future choice. The shared guest schedule shows only available slot times returned by the existing CRM availability response and allowed by branch hours and an explicit single-guest therapist selection.
- Home Service adds a Service Location (GPS) field under customer details. It uses the existing Places selection, validated place identity and coordinates, the server distance preview, travel fee, and no room. A map review link is available. The current booking server contract requires a Places identity, so free-text coordinates and map-click capture are not offered as independently saveable destinations.
- Payment defaults to unpaid across modes. A payment method alone does not mark payment received. The existing authorized booking/payment action remains the only writer.

## C4 workflow reconciliation

- Header, mode tabs, customer details, summary heading, total/payment state, and Save/Cancel stay outside the guest-list scroll container at desktop widths. Guest cards fill one column; only their container has vertical overflow at `lg` width. The summary paginates group guest rows two at a time instead of scrolling at desktop widths. Smaller viewports retain outer scrolling as an accessibility fallback. Actual pixel overflow has not been measured.
- Each guest shows the same service carousel, searchable catalogue, duration buttons, therapist mode control, shared date/time, provisional price and finish. In-spa guests show the existing single-guest room control or server-assigned group room state. Home Service shows no room.
- Automatic therapist assignment is the default. For one guest, Manual exposes the existing server-authoritative exact `staffId` path, with available and unavailable provider states and an optional customer-requested provenance checkbox. Selecting Manual without choosing a provider blocks submission.
- Group guests show Automatic and a disabled Manual control with an explicit contract explanation. An existing selected `staffId` cannot be submitted as a group soft preference from this new UI without the CSR explicitly choosing Automatic; the form blocks Save rather than silently changing the meaning of that selection.

## Therapist contract dependency

`createInhouseBookingMultiSchema` has one order-level `staffId`; attendee records have no therapist field. The booking engine passes that value as a soft `preferredStaffId` to group assignment. It uses an exact selected provider only for a single attendee. Therefore this local UI does **not** implement or claim `per_guest_exact_v1` persistence.

The safest proposed next contract is additive or explicitly versioned for **new CRM requests only**: add a version marker and per-attendee assignment choice, distinguish Automatic from exact staff selection, preserve customer-requested provenance per attendee, reject unavailable/unqualified/conflicting exact selections atomically, and never silently substitute an exact selection. Unmarked legacy CRM and external Desktop group requests must keep their current soft order-level preference behavior. Desktop consumer verification, schema/storage implications, independent server tests, and final owner acceptance remain required before enabling Manual for group guests. No Desktop repository or database schema was changed here.

## Evidence and limitations

- Local branch: `stage/walkin-booking-modal-prototype`, HEAD at the start of this work `2f62fff7c3dbb35815947d4ef9a1fd1433de9cfd`; accepted local `origin/main` `9934d51b6d2dd325b2ef89b1bae70635deb46989`. Changes remain uncommitted.
- Focused Vitest: **9 files, 53 tests passed** on Node 24. The jsdom regressions exercise all three modes, source choice and returned time slots, vertical guest cards, summary pagination, duration quote refresh, automatic/manual UI states, single-guest manual payload, GPS Places identity and coordinates, distance-fee preview, room omission, prefills, and unpaid defaults. Mocked engine authorization tests also pass. These mocks do not establish server persistence or transactional rollback.
- Targeted ESLint and `git diff --check` pass. Whole-repository `tsc --noEmit` exits 2 with **946 diagnostics**, including testing-library export type errors in the new test; no diagnostics reference the changed booking UI components. This is not a passing type-check gate.
- Database target: **UNKNOWN**. No transactional booking, payment, migration, or SQL verification was run. No push, merge, or deployment occurred.
- `http://localhost:3000/crm/today` has no listening server in this session. The prior browser URL-policy refusal remains unresolved. No authenticated browser screenshots or viewport overflow measurements are available, so visual acceptance remains open.
- Build, authenticated save, precise server assignment, transactional payment, and runtime browser verification remain untested against a classified target.
