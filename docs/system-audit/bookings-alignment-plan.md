# Bookings Alignment Plan

Phase 6A certified Attendance as the CRM reference implementation before any Bookings UI alignment work begins. This plan defines what Bookings should inherit, what must remain booking-specific, and the safest rollout order. It does not modify Bookings.

## Reusable Components

Reuse only where the semantics match the Bookings surface:

- `ToolbarShell`: use for dense filter and action rows in Bookings lists, selected-detail tools, and dialog-adjacent controls.
- `ToolbarSearch`: use for customer, booking ID, therapist, room, service, and status search where a single text query filters a local or server-backed list.
- `ToolbarSelect`: use for date range, booking status, service type, therapist, room, payment state, source, and channel filters.
- `WorkspaceNotice`: use for save results, validation notices, blocked workflow states, and operational warnings that should be announced politely or assertively.
- `WorkspaceSection`: use for major operational panels such as booking list, selected booking detail, payment review, therapist assignment, and customer timeline.
- `AttendanceTabPanel`: reuse the tab-panel pattern and ARIA wiring, but rename or generalize before broad reuse if Bookings needs a domain-neutral primitive.
- `ContextChip`: use for branch, date, queue mode, selected service area, therapist, room, or operational status context.

Do not reuse Attendance labels, status terms, or attendance-specific data assumptions in Bookings. Reuse the interaction pattern, not the domain language.

## Booking-Specific Components

Keep these Bookings-owned because their business semantics differ from Attendance:

- Booking lifecycle controls: create, confirm, check in, reschedule, cancel, complete, no-show, refund, and reopen.
- Payment workflow: deposits, balances, discounts, vouchers, payment methods, reconciliation, refunds, and receipt state.
- Therapist assignment: eligibility, availability, service skill matching, utilization, conflicts, and reassignment rules.
- Room assignment: room/service compatibility, time blocks, resource conflicts, and turnover.
- Customer timeline: visit history, notes, preferences, contraindications, follow-up, and communication history.
- Multi-service booking: service bundles, sequence, durations, parallel resources, and per-service staff assignment.
- Follow-up workflow: callbacks, reminders, post-service notes, issue handling, and next-booking prompts.

## Rollout Order

Use a controlled alignment sequence. Complete and verify each step before moving to the next:

1. Workspace shell: match spacing, section hierarchy, scroll containment, and responsive page behavior.
2. Header: align title, description, context chips, and primary actions.
3. Navigation: align tab/segment keyboard behavior, active state, focus movement, and URL behavior.
4. Toolbar: migrate search, filters, reset, export, and responsive wrapping to the certified toolbar pattern.
5. Booking list: align row density, selected state, empty/loading/error states, overflow containment, and pagination behavior.
6. Selected detail: align support rail behavior, sticky detail panel, badges, readouts, and safe action grouping.
7. Dialogs: validate focus trap, escape/cancel behavior, labels, validation, loading, mutation feedback, and responsive sizing.
8. Loading: preserve route and section-level loading states without introducing skeletons that shift layout.
9. Empty state: align concise operational empty states with clear recovery actions.
10. Error state: align recoverable errors, destructive warnings, and action result notices with `WorkspaceNotice`.

## Guardrails

- Do not port Attendance mutations, attendance status names, QR/device/recovery actions, or attendance data assumptions into Bookings.
- Do not introduce new Bookings workflows during alignment.
- Do not change Bookings schema or server actions as part of UI alignment.
- Fix false affordances before reuse: every visible Booking action must either work, be disabled, or be removed.
- Verify Bookings with the same standard used for Attendance: authenticated JavaScript browser session, keyboard navigation, dialogs, console/network, and responsive widths of 390, 768, 1280, and 1440 pixels.
