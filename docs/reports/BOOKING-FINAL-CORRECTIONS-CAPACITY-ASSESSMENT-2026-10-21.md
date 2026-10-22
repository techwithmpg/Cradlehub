# Unified booking modal: final corrections and group-capacity assessment

Status: **CORRECTION REQUIRED** for a larger booking contract and release verification. This is local, uncommitted review evidence on `stage/walkin-booking-modal-prototype` at `2f62fff7c3dbb35815947d4ef9a1fd1433de9cfd`. The local `origin/main` reference is `9934d51b6d2dd325b2ef89b1bae70635deb46989`; it was not refreshed or independently accepted in this pass.

## Local UI behavior

- Each expanded guest card has one therapist select. Automatic displays a provisional qualified, available candidate from the existing CRM availability endpoint. Group suggestions reserve distinct candidates in guest order in the client. The server remains authoritative and can assign a different automatic therapist. Manual selection is exact for one guest through the existing `staffId` path. Manual selections for any group guest remain visible and isolated in form state, but Save is blocked because the per-guest exact contract is unavailable. Unavailable providers are disabled and explicit selections are retained with feedback when inputs change. This UI does not claim joint authoritative availability or persisted group exact assignments.
- Home Service customer details show one Places-backed location field, compact confirmed address, and Review map link. Precise coordinates and Place ID remain in the submitted payload but are not displayed. The travel quote is invalidated on a location change; the transportation fee and recalculation state appear only in Booking Summary. The final server quote remains authoritative. The customer-device location is not used.
- The service selector holds a stable number of CSS grid slots. One or two filtered cards stay left aligned at their normal width. The existing catalogue, categories, arrows, guest selections, quotes, and duration controls remain.
- Cards are expanded and vertically stacked, with the desktop guest list as the intended scroll region. Production Add Guest remains capped at four. A bounded `previewGuestCapacity` prop supports non-submitting 5/10/20-card layout tests; Save is disabled above four and the UI says the larger group is a layout preview. Therapist availability requests are limited to the first four cards in that preview.

## Therapist contract gate

`per_guest_exact_v1` is absent in `src/lib/validations/booking.ts` and `src/lib/bookings/inhouse-booking-engine.ts`. Attendees have service lines and names, but no per-attendee therapist field. Group `staffId` reaches `assignTherapistsForOrder` as `preferredStaffId`, a soft preference. The availability helper currently prioritizes that preferred ID in every attendee candidate list, although its comment says attendee 0. Changing legacy semantics in place would affect CRM and external Desktop inputs. Preserve unmarked legacy behavior. A separately accepted, marked CRM contract should carry per-attendee exact therapist ID and customer-requested provenance; the server must reject unavailable or conflicting exact choices with guest-specific errors while solving remaining automatic guests jointly. Review Desktop and public consumers independently before adding it. No Desktop change is included here.

## Larger-group bounded assessment

| Boundary | Source finding | Required before increasing CRM capacity |
| --- | --- | --- |
| Request | CRM `createInhouseBookingMultiSchema` limits `attendees` to 4 and each attendee to 5 services; public booking schema separately allows 10. | Authorize a configurable CRM capacity and enforce it on both client and server. Do not infer CRM capacity from the public flow. |
| Identity and lines | `inhouse-booking-engine.ts` builds attendee sequences and service-line sequences, hashes group input for idempotency, and checks replay row counts. | Test 5/10/20 attendee-line mapping and replay against classified LOCAL/TEST. |
| Therapists | `assignTherapistsForOrder` fetches candidates per attendee and uses recursive distinct assignment. Current failures are order-level `SLOT_UNAVAILABLE`; no per-guest exact constraint or error. | Add marked exact contract, joint conflict and preference rules, guest-specific failures, and measured solver performance. Candidate enumeration and backtracking may become expensive with larger groups. |
| Rooms | CRM group rooms use `allocateResourcesForAttendees`; Home Service skips room allocation. | Verify capacity, service compatibility, and overlapping reservations for higher guest counts. Keep CSR review of assigned rooms. |
| Schedule and travel | Group attendees share a start time; services within a guest run sequentially. Home Service travel and dispatch are order-level. | Check feasibility for many concurrent staff and Home Service travel buffers, including conflicts with other orders. |
| Atomic creation/payment | The engine calls `create_inhouse_order_with_payment_atomic`, which delegates to BKG3 and then creates service payable items and any travel fee in one database transaction. The source wrapper does not establish a tested high-group limit. | Run classified LOCAL/TEST transactional creation, rollback, invalid payment, cash-drawer, idempotency, retry, and amount tests at the intended capacity. No SQL was run here. |
| Consumers | CRM Today, Schedule, Bookings, Cash Flow, public booking, and Desktop v1 depend on booking/order projections. | Check pagination, totals, attendee labels, room/staff display, notifications, and external compatibility at the proposed limit. |

No safe maximum above four is established by source inspection alone. Do not automatically split one group across financial orders.

## Verification and environment limits

Six focused CRM test files passed, 43 tests, under Node 24 after the corrections in this pass. Non-submitting jsdom card-add measurements in the final run: 5 guests 584 ms, 10 guests 1814 ms, 20 guests 6927 ms. These timings are diagnostic and are not browser frame or network measurements. Type check reports 954 project diagnostic lines, including missing `@testing-library/react` type exports in these tests; it reports no booking component diagnostic in the filtered output. Local ports 3000–3002 had no listener. Browser screenshot and viewport verification were unavailable; no screenshot evidence is claimed. The configured database target is **UNKNOWN**; no transactional query was attempted. No build or release outcome is claimed.

## Next owner decision

Accept and authorize a marked per-guest exact therapist contract and its independent CRM/Desktop/public compatibility review. Separately approve a proposed configurable CRM group capacity only after a classified LOCAL/TEST database target is available for transactional and performance verification. Until then, retain the four-guest submit cap and keep this branch for local review only.
