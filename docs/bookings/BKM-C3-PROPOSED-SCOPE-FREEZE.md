# BKM-C3 — Proposed booking-modal scope freeze

**Status:** Proposed for exact owner acceptance; not an implementation or release authorization. **Baseline:** accepted remote `main` `9934d51b6d2dd325b2ef89b1bae70635deb46989`, reconciled with the current local branch `stage/walkin-booking-modal-prototype` at `2f62fff7c3dbb35815947d4ef9a1fd1433de9cfd`. Product direction is accepted by the owner; this document's exact boundaries remain proposed.

## Product boundary

One shared CRM booking modal adapts to Walk-in, Phone/Future, and Home Service. Phone/Future is one visual mode while the saved source remains `phone` or `standard_future`; the CSR chooses a source when the entry point has not established one. Existing CRM entry points and customer, branch, service, staff, date, and time prefills remain. Customer identity uses the existing name autocomplete with phone and optional notes. The branch-eligible service catalogue remains searchable, categorized, and navigable without a nested catalogue modal.

Each guest has a fully expanded, vertically stacked card with independent services, line durations, and therapist choice. All guests in one order share a start time; their services run sequentially within each guest. In-spa groups receive authoritative automatic room allocation and CSR review; a single in-spa booking retains its authorized room choice. Home Service uses a Places-verified destination, authoritative travel fee, and no room requirement. A compact Booking Summary shows service amounts, transportation fee where applicable, unpaid or explicitly recorded payment state, and Save/Cancel. The desktop target keeps the essential workflow within the modal, with vertical scrolling in Guests & Services; accessible responsive fallback is required when viewport or zoom makes that impossible.

## Therapist boundary

For **new, explicitly marked CRM requests**, `per_guest_exact_v1` allows each attendee to omit a therapist for automatic allocation or specify one exact `selectedStaffId`, with optional `customerRequestedTherapist` provenance. An exact selection must be assigned to that attendee or fail before booking creation. The server checks qualifications, schedule, attendance where required, overlapping bookings, Home Service travel, and joint group conflicts. Automatic recommendations are provisional and never converted into exact selections without CSR action. The exact request, response, error, legacy compatibility, and database review are proposed in [BKM therapist contract](BKM-PER-GUEST-EXACT-V1-CONTRACT-REVIEW.md).

Unmarked CRM and Desktop v1 group requests retain their current order-level `staffId` soft-preference behavior. Existing single-guest exact behavior and public booking behavior remain. The separate Desktop repository is outside this Web authorization. A marker must not silently change a legacy request's meaning.

## Capacity boundary

The current CRM submission contract remains **four attendees**. Expanded card rendering is a non-submitting preview only. A configurable higher capacity is a separate contract and implementation gate in [BKM capacity assessment](BKM-LARGE-GROUP-CAPACITY-CONTRACT.md). No 5+ guest Save, automatic order splitting, or inferred unlimited capacity is authorized by this scope proposal.

## Preserved authority and exclusions

- The existing branch-scoped CRM action, service eligibility and quote versions, scheduling, atomic order/payment writer, idempotency, Cash Flow, booking-change notifications, and BKM-001 unpaid default remain authoritative.
- Payment method selection alone never marks an order paid. Only the existing explicitly authorized atomic payment path may record collection, including drawer/account validation and audit.
- No Save as Draft, discount, loyalty, or new payment operation is added. No production schema, migration, RLS, grant, Desktop change, production data mutation, merge, or deployment is authorized here.
- The current local UI prototype is review evidence. Completion of C3 preparation does not authorize the C4 contract, server implementation, capacity increase, or release.

## Acceptance gates

1. Owner accepts the exact C3 and C4 text and the marked therapist contract separately.
2. Independent review verifies all shared-engine consumers and the Desktop v1 compatibility boundary before server changes.
3. A dedicated authorized implementation stage adds the marked path without changing unmarked behavior, with focused tests, review, and reconciliation against accepted main.
4. Any database or capacity implementation waits for a classified LOCAL/TEST target and required transactional verification. Merge and deployment require separate owner gates.
