# Existing Workflows And Functions

This file describes the current CRM operational flows at a high level for Figma and UX planning. It is not a request to change workflow logic.

## Start Of Day Flow

- Trigger: Front-desk staff begins the workday.
- User action: Open Today, review readiness, check Live Availability, confirm staff presence, inspect schedule and dispatch issues.
- System data involved: Daily schedule, staff check-ins, bookings for today, readiness issues, services, spaces/resources, payment and dispatch signals.
- Expected result: Staff understands whether the branch is ready to serve customers and which items need attention first.
- UI needs: A command-center layout with primary actions, compact KPIs, issue drawer, staff readiness summary, and clear next-step links.

## Walk-In Booking Flow

- Trigger: Customer arrives or contacts the front desk for immediate in-spa service.
- User action: Find or create customer, select service, choose available staff/time/resource, create booking, confirm payment state when needed.
- System data involved: Customers, branch services, staff availability, staff check-ins, schedule, bookings, spaces/resources, payment status.
- Expected result: Walk-in booking is created safely using existing booking rules and live operational availability.
- UI needs: Fast customer lookup, prominent create-booking action, compact availability cues, and clear booking status feedback.

## Online Request Review Flow

- Trigger: Public booking or online request requires front-desk review or operational follow-up.
- User action: Review booking/request details, verify service/staff/payment state, update status through approved controls, contact customer if needed.
- System data involved: Public booking data, customer profile, service eligibility, provider assignment, booking status, payment records, notifications or workflow tasks.
- Expected result: Online request is either accepted, updated, followed up, or routed to the correct operational page.
- UI needs: Review table, status badges, source indicators, customer/service details, and safe row-level actions.

## Home-Service Booking Flow

- Trigger: Booking is for home service or needs field dispatch.
- User action: Review address, confirm therapist, assign driver through existing dispatch controls, monitor trip progress, resolve missing GPS/payment/driver issues.
- System data involved: Booking, customer address metadata, service type, assigned therapist, assigned driver, driver check-in, dispatch status, payment state, location snapshots.
- Expected result: Home-service visit is ready, dispatched, monitored, and completed without losing operational visibility.
- UI needs: Dispatch queue, readiness checklist, selected booking detail, active trips area, map or honest map placeholder, progress table.

## Staff Check-In / Availability Flow

- Trigger: Staff arrives, leaves, or availability changes during the day.
- User action: Check staff in or out, review not checked-in staff, inspect schedule issues, confirm driver readiness.
- System data involved: Staff records, staff schedules, staff shift check-ins, bookings, active assignments, driver status.
- Expected result: Live Availability reflects who can be assigned right now while schedule remains the planned source.
- UI needs: Compact live board, clear status columns, staff rows with action controls, schedule issue grouping, refresh action.

## Therapist Assignment Flow

- Trigger: Services need eligible providers or a booking needs staff assignment.
- User action: Review service coverage, open provider assignment panel, assign or remove eligible therapists through existing actions.
- System data involved: Branch services, staff records, staff types, staff service assignments, service visibility, in-spa/home-service flags.
- Expected result: Services have proper provider coverage, especially public services that need available therapists.
- UI needs: Service table, coverage KPIs, missing coverage filters, provider chips, assignment side panel, guardrail messages.

## Driver Readiness / Dispatch Flow

- Trigger: A home-service booking needs driver readiness or trip dispatch.
- User action: Review driver assignment, confirm checked-in driver, inspect address/GPS readiness, monitor active trips.
- System data involved: Drivers, staff check-ins, dispatch items, booking address metadata, dispatch status, location snapshots.
- Expected result: Driver-dependent work is visible and ready before service delivery begins.
- UI needs: Driver readiness badges, dispatch status chips, missing-data warnings, active trip grouping, quick links to fix address or schedule issues.

## Customer Lookup Flow

- Trigger: Staff needs to identify a customer for booking, support, retention, or issue resolution.
- User action: Search customer, open profile, review past and future bookings, check notes and contact information.
- System data involved: Customer records, booking history, repeat/lapsed/waitlist context, contact information, notes.
- Expected result: Front desk has enough customer context to serve or follow up quickly.
- UI needs: Search-first customer desk, results table, profile side panel, booking timeline, compact contact actions.

## Emergency Action Flow

- Trigger: Something urgent happens during operations, such as dispatch issue, payment issue, schedule blocker, or customer problem.
- User action: Open emergency or related tool links, inspect issue detail, route to the correct operational page.
- System data involved: Readiness issues, dispatch alerts, booking status, payment status, staff presence, spaces/resources.
- Expected result: Staff can jump directly to the right workspace without hunting through navigation.
- UI needs: Compact emergency action row, issue drawer, related links, severity badges, clear "fix this" destinations.

## End-Of-Day Reconciliation Flow

- Trigger: Branch prepares to close the day.
- User action: Open Reconciliation, review completed bookings, verify payments, inspect unpaid or mismatched records, summarize totals and exceptions.
- System data involved: Today's bookings, payment status, payment logs, booking status, customer and service details, totals by method or state.
- Expected result: Staff can close the day with confidence and clear exception visibility.
- UI needs: Payment KPI strip, closeout checklist, exception queue, payment summary cards, compact completed booking table.
