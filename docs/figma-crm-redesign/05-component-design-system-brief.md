# Component Design System Brief

Use these component briefs to generate a reusable CRM design system before designing individual pages.

## CRMPageShell

- Purpose: Standard CRM workspace canvas that holds sidebar, header, main content, and optional rail.
- Where used: All CRM pages.
- Design behavior: Stable navigation, cream/off-white content background, consistent spacing and max-width behavior.
- Important content: Sidebar, top header, page body, optional right rail, responsive main area.
- Responsive behavior: Sidebar collapses or becomes mobile navigation; main content stacks vertically.

## CRMSidebar

- Purpose: Role-aware CRM navigation grouped by operational domain.
- Where used: CRM, CSR Head, CSR Staff workspaces.
- Design behavior: Dark sidebar, grouped labels, active route state, clear icon rhythm.
- Important content: Main Operations, Customer Management, Service & Resource Setup, Staff & Internal Work, Finance / End-of-day.
- Responsive behavior: Collapse to drawer, bottom nav, or compact icon rail on mobile.

## CRMTopHeader

- Purpose: Global workspace header for branch context, user context, and high-level actions.
- Where used: CRM shell.
- Design behavior: Quiet and functional, not visually heavier than the page header.
- Important content: Branch name, user menu, global notifications, optional readiness badge.
- Responsive behavior: Hide secondary labels, keep critical actions tappable.

## CRMPageHeader

- Purpose: Page-level title, description, and primary action area.
- Where used: Every CRM page.
- Design behavior: Strong title, compact description, action row aligned to the right or below on small screens.
- Important content: Page name, short purpose, primary CTA, secondary links.
- Responsive behavior: Stack title and actions; keep primary action visible early.

## SystemReadinessBar

- Purpose: Compact summary of critical and warning issues.
- Where used: Today, Rules & Setup, Availability, and future CRM pages.
- Design behavior: Single-line bar with status, counts, categories, and drawer trigger.
- Important content: Status label, critical count, warning count, "Review issues" action.
- Responsive behavior: Wrap counts into one line if possible; drawer opens full-width on mobile.

## ReadinessIssueDrawer

- Purpose: Detailed issue review panel that keeps warnings out of the main layout.
- Where used: Pages with readiness issues.
- Design behavior: Slide-over panel grouped by scope and severity.
- Important content: Issue title, problem, impact, fix, action link, severity, source page.
- Responsive behavior: Full-screen sheet on mobile with sticky close/action area.

## OperationsKpiStrip

- Purpose: Compact row of operational metrics.
- Where used: Today, Availability, Dispatch, Bookings, Reconciliation.
- Design behavior: Small metric cards or chips with color-coded dots and short labels.
- Important content: Count, label, status color, optional trend or attention flag.
- Responsive behavior: Wrap into two-column chips or horizontal scroll inside a bounded container.

## PrimaryActionRow

- Purpose: Fast access to the most important page actions.
- Where used: Today, Bookings, Customers, Dispatch, Reconciliation.
- Design behavior: Button row with primary green action and secondary neutral actions.
- Important content: Create booking, refresh, review issues, open related tools.
- Responsive behavior: Convert to stacked buttons or segmented action grid.

## RightRailSummaryCard

- Purpose: Supporting context that should not interrupt the main task.
- Where used: Today, Services, Bookings, Dispatch, Customers, Reconciliation.
- Design behavior: Fixed-width rail cards with compact summaries and links.
- Important content: Totals, selected item details, guidance, related links, exceptions.
- Responsive behavior: Move below main content or into a drawer on mobile.

## CRMDataTable

- Purpose: Dense professional table for operational records.
- Where used: Bookings, Services, Customers, Waitlist, Reconciliation, Dispatch progress.
- Design behavior: Sticky header, compact rows, strong status badges, row actions, filters.
- Important content: Search, filters, columns, badges, row actions, pagination, empty state.
- Responsive behavior: Convert rows to cards or condensed list with primary fields first.

## CompactStaffStatusRow

- Purpose: Dense staff row for live availability and schedule contexts.
- Where used: Live Availability, Schedule, staff readiness panels.
- Design behavior: Avatar, name, role, time/status, current assignment, action button.
- Important content: Staff name, staff type, check-in status, availability state, booking relation.
- Responsive behavior: Keep row tappable; action moves to trailing button or overflow menu.

## AvailabilityBoardColumn

- Purpose: Column grouping staff by live operational state.
- Where used: Live Availability board.
- Design behavior: Fixed-height column with scroll, count badge, status color accent.
- Important content: Column title, staff rows, empty state, attention count.
- Responsive behavior: Convert columns to tabs or stacked sections.

## AvailabilityIssueGroup

- Purpose: Group schedule or presence issues by cause.
- Where used: Live Availability Needs Attention, Schedule Issues.
- Design behavior: Header with count and compact rows beneath.
- Important content: Issue type, affected staff, quick link to schedule setup.
- Responsive behavior: Use accordion groups on mobile.

## WorkspaceActionCard

- Purpose: Link users to related operational tools.
- Where used: Rules & Setup, Today, Availability, Spaces & Rules.
- Design behavior: Compact card with icon, title, short description, action affordance.
- Important content: Destination, reason to open, status or readiness hint.
- Responsive behavior: Two-column grid on tablet, single-column on mobile.

## PageHelpDisclosure

- Purpose: Hide educational content until needed.
- Where used: Availability, Setup, Spaces & Rules, Schedule Setup.
- Design behavior: Collapsible disclosure with calm styling and clear label.
- Important content: Short explanatory sections, workflow notes, architecture boundaries.
- Responsive behavior: Full-width accordion with large tap target.

## EmptyStateCard

- Purpose: Explain no-data states without creating alarm.
- Where used: Tables, queues, boards, filters, notifications.
- Design behavior: Muted card with short title, one sentence, optional action.
- Important content: What is empty, why it may be okay, next action if needed.
- Responsive behavior: Stays compact and centered within the empty area.

## StatusBadge

- Purpose: Consistent status label across the CRM.
- Where used: All tables, cards, boards, drawers, and rails.
- Design behavior: Short text, color by status, readable contrast, no decorative excess.
- Important content: Confirmed, pending, available, busy, attention, critical, paid, unpaid.
- Responsive behavior: Use shorter labels on narrow screens.

## DetailSidePanel

- Purpose: Inspect and act on selected records without leaving the page.
- Where used: Bookings, Customers, Dispatch, Services, Waitlist, Reconciliation.
- Design behavior: Right-side drawer or rail with summary, details, and safe actions.
- Important content: Selected record title, metadata, related records, permitted actions.
- Responsive behavior: Full-screen sheet on mobile.

## BookingQueueTable

- Purpose: Manage active booking queues with scan-friendly operational detail.
- Where used: Today, Bookings, Dispatch, Reconciliation.
- Design behavior: Compact rows with status, time, customer, service, staff, payment, action menu.
- Important content: Booking status, time, customer, service, staff, visit type, payment state, issues.
- Responsive behavior: Convert each booking to a stacked card with primary status visible.

## DispatchQueuePanel

- Purpose: Show home-service dispatch work requiring attention.
- Where used: Dispatch, Today dispatch snapshot, Live Map.
- Design behavior: Left queue with selectable rows and issue badges.
- Important content: Booking, customer, address status, therapist, driver, payment, trip state.
- Responsive behavior: Queue becomes top section; selected detail opens below or in sheet.

## CustomerProfilePanel

- Purpose: Show customer context alongside customer lists or booking work.
- Where used: Customers, Bookings, Waitlist, Repeats, Lapsed.
- Design behavior: Profile header, contact info, history timeline, notes, upcoming bookings.
- Important content: Customer identity, contact, last visit, next booking, preferences, notes.
- Responsive behavior: Full-screen profile sheet on mobile.

## PaymentSummaryCard

- Purpose: Summarize payment state and closeout totals.
- Where used: Reconciliation, Bookings, Today, booking detail panels.
- Design behavior: Clear totals, method breakdown, exception indicators, payment status badges.
- Important content: Paid, unpaid, refunded, voided, method totals, exceptions, audit hints.
- Responsive behavior: Stack totals and method rows vertically.
