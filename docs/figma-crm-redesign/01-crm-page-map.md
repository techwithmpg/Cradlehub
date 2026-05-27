# CRM Page Map

This page map describes the CRM / Front Desk Workspace as a set of operational tools. Use it to guide Figma frames without changing the underlying workflows.

## Today / Daily Operations Center

Route: `/crm/today`

- Purpose: The daily command center for front-desk staff starting and running the day.
- Main user goal: See what needs attention now, serve customers quickly, and move bookings through the day.
- Main actions: Create walk-in booking, review today's bookings, record payment status, open dispatch or schedule tools, handle urgent operational issues.
- Main data shown: Readiness issues, daily KPIs, today's booking queue, staff readiness, payment and dispatch signals, emergency links, related tools.
- UI problem to solve: The page can become overloaded if readiness warnings, help text, and booking work compete for the first viewport.
- Desired UX direction: Make Today the compact daily command center with primary actions and live KPIs above the fold, issues available in a drawer, and booking work organized as the core task surface.

## Live Availability & Check-In Center

Route: `/crm/availability`

- Purpose: A live operations board for staff presence, service availability, and driver readiness.
- Main user goal: Know who is present, available, busy, missing, or needs review right now.
- Main actions: Check staff in or out, review not checked-in staff, inspect schedule issues, confirm driver readiness, refresh live status.
- Main data shown: Scheduled staff counts, checked-in staff, available staff, busy staff, drivers ready, staff without schedule, attention groups.
- UI problem to solve: A wide Kanban board can feel sparse and force operators to scan too much empty space.
- Desired UX direction: Make Live Availability a compact live operations board with dense staff rows, clear status columns, quick filters, and mobile tabs or sections.

## Rules & Setup Center

Route: `/crm/setup`

- Purpose: A setup and configuration hub that explains whether CRM operations are ready for the day.
- Main user goal: Understand setup health and jump to the exact page needed to fix readiness blockers.
- Main actions: Review readiness issues, inspect booking flow rules, open services, spaces, schedule, dispatch, or payment setup pages.
- Main data shown: System readiness status, setup health cards, booking flow rules, setup tiles, booking impact matrix.
- UI problem to solve: Long warnings and setup explanations can make the page feel like an error report instead of a hub.
- Desired UX direction: Make Rules & Setup a calm configuration hub with compact readiness summary, grouped setup cards, and progressive disclosure for detailed explanations.

## Services & Therapists

Route: `/crm/services`

- Purpose: Manage branch services and therapist/provider assignments for operational readiness.
- Main user goal: Keep services available, correctly configured, and covered by eligible providers.
- Main actions: Review active services, update service availability settings, open therapist assignment drawer, assign or remove providers, filter services with missing coverage.
- Main data shown: Service names, category, duration, price, visibility, in-spa and home-service eligibility, assigned therapists, coverage status.
- UI problem to solve: Many services and provider chips can make the page too long and hard to scan.
- Desired UX direction: Handle many services with a professional compact table, KPI strip, strong filters, paginated rows, and provider management in a side panel.

## Bookings

Route: `/crm/bookings`

- Purpose: The booking control table for finding, editing, and monitoring bookings.
- Main user goal: Quickly locate bookings, understand status, and take approved booking or payment actions.
- Main actions: Search, filter, inspect booking details, update status, record payment, open customer profile, review visit details.
- Main data shown: Booking date and time, customer, service, staff, branch, status, payment state, visit type, source, operational flags.
- UI problem to solve: Booking rows can carry too much information if every detail is shown at once.
- Desired UX direction: Make Bookings a professional booking control table with compact rows, strong status badges, row actions, sticky filters, and detail side panel.

## Dispatch

Route: `/crm/dispatch`

- Purpose: A home-service operations board for driver assignment, trip readiness, travel progress, and dispatch issues.
- Main user goal: Know which home-service bookings need driver action and which trips are ready, active, or blocked.
- Main actions: Select booking, review dispatch readiness, assign driver through existing actions, inspect active trips, open address or schedule tools.
- Main data shown: Home-service bookings, driver assignment, therapist assignment, address/GPS status, payment state, trip status, ETA/location snapshots, alerts.
- UI problem to solve: Dispatch can look fragmented if queue, readiness, map, and progress views are not visually connected.
- Desired UX direction: Make Dispatch a home-service operations board with queue, selected-detail panel, readiness checklist, active-trip map area, and progress table.

## Live Map

Route: `/crm/live-operations`

- Purpose: A live operations view for location-aware activity and field service awareness.
- Main user goal: See where active home-service work stands and identify trips that need operational attention.
- Main actions: Inspect active trips, review location status, open dispatch, open booking details, check missing address or coordinate issues.
- Main data shown: Active trips, map or map placeholder, driver/therapist/customer details, latest location snapshots, missing coordinates, trip states.
- UI problem to solve: A map view can overpromise if live tracking data is incomplete or unavailable.
- Desired UX direction: Use an honest map-first layout that clearly separates live data, missing data, and dispatch actions.

## Schedule

Route: `/crm/schedule`

- Purpose: Daily staff and booking schedule view for operational coordination.
- Main user goal: Understand today's staff schedule, bookings, manual adjustments, and conflicts.
- Main actions: Review schedule by staff or time, inspect booking details, make permitted manual adjustments, open schedule setup, update booking status when allowed.
- Main data shown: Daily bookings, staff assignments, schedule windows, blocked time, overrides, payment and booking progress indicators.
- UI problem to solve: Daily schedule information can become dense when staff, bookings, adjustments, and payment states are shown together.
- Desired UX direction: Use compact schedule lanes or tables, strong filters, readable time blocks, and side panels for detail.

## Customers

Route: `/crm/customers`

- Purpose: The CRM customer desk for lookup, profile context, and customer service support.
- Main user goal: Find a customer quickly and understand their booking history, preferences, and current needs.
- Main actions: Search customers, open profile, create or edit customer records, view past bookings, identify repeat or lapsed customers.
- Main data shown: Customer name, contact details, last visit, next booking, notes, history, status, related bookings.
- UI problem to solve: Customer records need enough context without becoming a full admin database screen.
- Desired UX direction: Make Customers a CRM customer desk with search-first layout, results table, profile side panel, and quick booking history.

## Repeats

Route: `/crm/repeats`

- Purpose: A customer retention view for repeat customers and recurring visit opportunities.
- Main user goal: Identify frequent customers and support personalized follow-up.
- Main actions: Filter repeat customers, inspect visit history, open customer profile, start follow-up or booking actions where supported.
- Main data shown: Customer frequency, service patterns, last visit, preferred service/provider, upcoming bookings, contact details.
- UI problem to solve: Repeat customer data can look like generic analytics unless framed as service follow-up work.
- Desired UX direction: Use a focused retention list with customer context, repeat indicators, and profile drill-in.

## Lapsed

Route: `/crm/lapsed`

- Purpose: A reactivation desk for customers who have not visited recently.
- Main user goal: Find lapsed customers and identify who should be contacted or reviewed.
- Main actions: Filter by lapse period, open customer profile, review service history, start approved outreach or booking action.
- Main data shown: Customer name, last visit, days since visit, last service, contact details, value indicators, notes.
- UI problem to solve: Lapsed lists can feel punitive or noisy if priority and context are unclear.
- Desired UX direction: Show clear recency bands, concise customer history, and calm reactivation priority indicators.

## Waitlist

Route: `/crm/waitlist`

- Purpose: Manage customers waiting for slots, providers, or service availability.
- Main user goal: Match waiting customers to available times or follow up when capacity opens.
- Main actions: Search waitlist entries, filter by service/date/provider, contact customer, convert to booking where supported, close outdated entries.
- Main data shown: Customer, desired service, preferred date/time, provider preference, urgency, contact info, created date, status.
- UI problem to solve: Waitlist entries need quick triage without losing customer preference detail.
- Desired UX direction: Use a compact queue table with priority chips, filters, and a detail panel for preferences and notes.

## Spaces & Rules

Route: `/crm/spaces-rules`

- Purpose: Manage physical spaces/resources and view booking rules that affect service capacity.
- Main user goal: Keep rooms and resources usable, understand rule impact, and resolve resource conflicts.
- Main actions: Add/edit/toggle spaces and resources where permitted, inspect conflicts, view booking rules, open setup guidance.
- Main data shown: Resource inventory, room status, conflict list, booking rules, active rule summary, capacity indicators.
- UI problem to solve: Resources and booking rules are related but not the same, so the page can feel mixed.
- Desired UX direction: Separate spaces, conflicts, and read-only rules into clear tabs with readiness summaries and compact resource cards.

## Staff Applications

Route: `/crm/staff-applications`

- Purpose: Review operational staff applications from the CRM workspace when permitted.
- Main user goal: Process normal operational applicants without needing the full manager workspace.
- Main actions: Review applicant details, approve permitted operational roles, reject or defer applications, identify manager-only applications.
- Main data shown: Applicant profile, requested role, branch, services, contact info, approval status, permission guardrails.
- UI problem to solve: Application review must be clear about what CRM can approve and what requires manager/owner.
- Desired UX direction: Use review cards or table rows with strong role guardrails, clear applicant summary, and safe action states.

## Notifications

Route: `/crm/notifications`

- Purpose: Show operational notifications and workflow signals relevant to CRM staff.
- Main user goal: See recent updates and unresolved actions without being overwhelmed.
- Main actions: Review notification groups, open related pages, mark or resolve items where supported.
- Main data shown: Notification type, priority, source, related entity, timestamp, status, destination link.
- UI problem to solve: Notifications can become a noisy second inbox if not grouped by workflow relevance.
- Desired UX direction: Group by action needed versus informational updates, keep priority visible, and route users back to the right workspace page.

## Reconciliation

Route: `/crm/reconciliation`

- Purpose: End-of-day close, payment review, and operational summary.
- Main user goal: Confirm the day's payment and booking state before closing operations.
- Main actions: Review unpaid or mismatched bookings, summarize payments, inspect completed bookings, identify exceptions, prepare closeout.
- Main data shown: Completed bookings, paid/unpaid/refunded states, payment methods, totals, exceptions, audit or payment log indicators.
- UI problem to solve: Financial closeout must feel reliable and compact without hiding exceptions.
- Desired UX direction: Make Reconciliation an end-of-day close and payment summary with KPI totals, exception queue, payment method breakdown, and closeout checklist.
