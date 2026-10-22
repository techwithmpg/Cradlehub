# BKM — Proposed `per_guest_exact_v1` CRM contract and compatibility review

**Status:** Proposed exact contract for owner acceptance. The owner has approved the product behavior in principle and authorized reconciliation. Server implementation is **not yet authorized by an accepted contract**. This document does not change the Desktop repository or the database.

## Request shape and validation

The new CRM modal sends the existing `createInhouseBookingMultiAction` payload with the additive marker and attendee fields below. Required attendee ID, name, organizer, service IDs, service-line quotes, branch, schedule, location, payment and idempotency fields retain their existing meanings.

```ts
type MarkedCrmTherapistInput = {
  therapistAssignmentContract: "per_guest_exact_v1";
  attendees: Array<{
    id: string; // existing UUID, stable within the request and its retry
    name: string;
    isOrganizer: boolean;
    serviceIds: string[];
    serviceLines?: ServiceLineRequest[]; // existing exported validation type
    selectedStaffId?: string; // exact only when explicitly chosen by the CSR
    customerRequestedTherapist?: boolean; // valid only with selectedStaffId
  }>;
};
```

For the marked path, `attendees` is required even for one guest, exactly one first-position organizer is required, IDs must be unique, and the service union and quote-version checks remain. `selectedStaffId` is a branch-scoped UUID. `customerRequestedTherapist: true` without `selectedStaffId` is invalid. To avoid two competing sources of truth, marked requests reject top-level `staffId` and top-level `customerRequestedTherapist`; attendee fields are authoritative. Automatic recommendations are omitted from `selectedStaffId`. The current maximum of four attendees remains until the separate capacity contract passes its gate. Unsupported marker values and marker-specific fields on unmarked requests are rejected rather than silently interpreted.

The marker is available only through the authorized CRM action. Desktop v1 must explicitly reject marked requests at its route boundary until a separate Desktop version is reviewed and authorized. The public booking path does not add the marker. These origin checks supplement, and do not replace, the existing authenticated role and branch authorization.

## Allocation and failure semantics

The server resolves service quotes and durations before allocation. It validates each exact guest's staff member for branch membership, active status, service qualification, schedule and attendance rules, precise start and full service/travel window, and existing conflicts. It reserves all valid exact assignments first and rejects duplicate overlapping exact assignments. It then jointly assigns distinct qualified therapists to automatic guests against the same order and existing bookings. Group guests retain one shared start; a guest's service lines remain sequential. No exact guest is silently substituted, including on retry. A customer-requested exact assignment has the same hard constraint and preserved provenance.

Proposed additive errors, all returned before the atomic writer is called:

```ts
type MarkedTherapistFailure = {
  ok: false;
  code: "EXACT_THERAPIST_UNAVAILABLE" | "EXACT_THERAPIST_UNQUALIFIED" |
    "GROUP_THERAPIST_CONFLICT" | "GROUP_CAPACITY_UNAVAILABLE";
  message: string;
  guestId: string;
  guestIndex: number; // one-based display index
};
```

If several guests contribute to a conflict, `guestId` identifies the first actionable guest in input order; a future additive `conflictingGuestIds` list may be returned if its privacy and UI behavior are reviewed. Errors must not reveal another branch's private schedule. The server still owns the final availability decision and may reject a provisional UI suggestion.

## Recommendation and persistence

The current `/api/booking/crm-availability` endpoint checks one attendee at a time. Client-side distinct suggestions are useful preview data but are not a jointly validated group recommendation. A read-only, branch-authorized group availability contract is required before presenting a suggestion as jointly available; its request must include each guest's services and quoted durations, shared start, delivery mode, verified Home Service destination/travel data, and explicit selections. Its response must identify each guest's provisional candidate and accurately label unavailable/conflicting options. Save repeats all checks server-side.

The current writer already creates one booking line per guest service under one atomic order. For a marked exact guest, every line in that guest's chain carries the selected assigned staff ID. The existing `bookingCreationProvenance` metadata and `bookings.requested_staff_id` / `therapist_selection_source` columns appear capable of representing `customer_selected`, `front_desk_selected`, and `system_assigned` per line. This is a source-level finding, **not** proof that the migration and trigger are present or correct in any target database. Verify on classified LOCAL/TEST before concluding that no schema change is needed. Existing price, payment, cash drawer/account, idempotency, and notification behavior stay in the atomic path. The group input hash must include marker and per-guest selections so a retry with changed assignments conflicts rather than replays a different intent.

## Existing-consumer compatibility findings

| Consumer | Current source contract | Marked-path boundary |
| --- | --- | --- |
| New CRM modal | `quick-booking-form.tsx` currently sends one top-level `staffId`; group manual Save is blocked. | Serialize attendee choices only after marker implementation and verification; keep automatic suggestions out of exact fields. |
| CRM action | `createInhouseBookingMultiAction` authenticates user and enforces the Owner-selected Front Desk branch, then calls the shared engine. | Allow marked CRM only after contract acceptance. Preserve all role and branch checks. |
| Desktop v1 | `/api/desktop/v1/bookings` calls `executeInhouseBookingCreation` directly after bearer authorization. | Explicitly reject marker at v1 boundary. Preserve existing unmarked payload and response; no Desktop repository change. Independent Desktop contract review remains required. |
| Public wizard inhouse path | Its staff-operated `inhouse` mode calls the CRM action without attendee marker. | Preserve its current single-guest/top-level staff behavior; do not inject marker automatically. |
| Public online booking | `createOnlineBookingMultiAction` uses the shared `assignTherapistsForOrder` with a soft `preferredStaffId`, and the public schema permits up to ten attendees. | Do not change its semantics while adding marked CRM logic. |
| Legacy CRM group | Engine passes top-level `staffId` as `preferredStaffId` to `assignTherapistsForOrder`. The helper source currently prioritizes it in every attendee candidate list despite a comment referring to attendee 0. | Preserve actual unmarked behavior. Correcting or redefining the legacy preference is a separate compatibility decision. |
| Single CRM guest | `resolveExactCrmBookingTime` enforces a selected top-level staff member. | Preserve unmarked exact single behavior; marked one-guest request uses attendee exact field. |
| Order readers | CRM Today, Schedule, Bookings, Cash Flow and notifications read booking lines/order projections. | Verify per-line staff/provenance and group labels without altering financial order identity. |

## Safer additive implementation seam and gates

Prefer a marked CRM allocator entry point that reuses the existing candidate and quote primitives while leaving the unmarked `assignTherapistsForOrder` path unchanged. Do not globally reinterpret `preferredStaffId`. Review the marked path, Desktop v1 rejection, public/inhouse parity, guest-specific errors, provenance, replay, and room/transport interactions independently before implementation authorization. No database execution against the configured production-linked `.env.local` is allowed under this packet. The owner must accept this exact text and authorize an implementation stage before server code changes.
