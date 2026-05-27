# Page-By-Page Figma Prompts

Use these prompts after generating the shared design system.

## Design System Frame

```text
Create a CradleHub CRM design system frame for a premium spa operations workspace. Use a dark sidebar, cream/off-white workspace background, forest green primary actions, warm gold accents, soft orange warning states, and red only for critical blockers.

Include reusable components: CRMPageShell, CRMSidebar, CRMTopHeader, CRMPageHeader, SystemReadinessBar, ReadinessIssueDrawer, OperationsKpiStrip, PrimaryActionRow, RightRailSummaryCard, CRMDataTable, CompactStaffStatusRow, AvailabilityBoardColumn, AvailabilityIssueGroup, WorkspaceActionCard, PageHelpDisclosure, EmptyStateCard, StatusBadge, DetailSidePanel, BookingQueueTable, DispatchQueuePanel, CustomerProfilePanel, and PaymentSummaryCard.

Show desktop component variants and mobile variants. Keep components compact, professional, accessible, and suitable for daily front-desk operations. Do not invent new business logic.
```

## Today / Daily Operations Center

```text
Design the CRM Today / Daily Operations Center desktop page for CradleHub.

This is the daily command center for front-desk staff. Keep the main action above the fold. Include a compact SystemReadinessBar at the top with a drawer trigger, CRMPageHeader, PrimaryActionRow, OperationsKpiStrip, booking queue, right rail summary, staff readiness snapshot, payment/dispatch signals, emergency actions, and related tool links.

Make the layout feel calm, premium, fast, and operational. Do not let warnings or explanations dominate the page. Preserve existing workflows and do not invent new booking logic.
```

## Live Availability & Check-In Center

```text
Design the CRM Live Availability & Check-In Center desktop page.

Make it a compact live operations board. Include SystemReadinessBar, CRMPageHeader, compact metric chips, tab or filter controls, and a dense availability board with columns for Not Checked In, Available Now, Busy/Assigned, and Needs Attention. Staff rows should show avatar, name, role, check-in/time status, current booking context, status badge, and action button.

Include schedule issues and driver readiness as secondary tabs or panels. Use progressive disclosure for educational help. On mobile, convert board columns into tabs or stacked sections. Preserve check-in and availability logic.
```

## Rules & Setup Center

```text
Design the CRM Rules & Setup Center desktop page.

This page is a setup/configuration hub, not a long error report. Include SystemReadinessBar, CRMPageHeader, setup health cards, booking flow rules, workspace setup tiles, booking impact matrix, and right rail guidance. Detailed readiness issues should open in a drawer.

Use calm status colors and clear grouping for Schedule, Services, Spaces, Dispatch, Payment, and System. Preserve existing setup workflows and route structure.
```

## Services & Therapists

```text
Design the CRM Services & Therapists desktop page.

The page must support many services without becoming too long. Use a compact professional table with filters, pagination, KPI strip, and a right rail summary. Include columns for service, category, assigned therapists, status, and actions. Provider details and assignment controls should open in a side panel.

Show status badges for Well Assigned, Low Coverage, and Needs Assignment. Keep service visibility and in-spa/home-service signals readable. Do not invent new provider assignment rules.
```

## Bookings

```text
Design the CRM Bookings desktop page as a professional booking control table.

Include CRMPageHeader, PrimaryActionRow, search and filters, KPI strip, CRMDataTable, row action menu, status badges, payment badges, visit type/source indicators, pagination, and a DetailSidePanel for selected booking details. The table should support fast scanning by front-desk staff.

Preserve existing booking workflows, payment actions, status controls, and route structure. Do not invent new booking states.
```

## Dispatch

```text
Design the CRM Dispatch desktop page as a home-service operations board.

Include dispatch KPI cards, alert/readiness summary, three main modes or tabs: Dispatch Flow, Live Map, and Travel Progress. The Dispatch Flow view should have a left booking queue, selected booking readiness checklist, therapist/driver/payment/address/GPS status, and assignment area. The Live Map view should show active trips and honest location data. The Travel Progress view should show a compact progress table.

Use strong status badges and keep the layout operational, not decorative. Preserve existing dispatch logic and do not add fake tracking behavior.
```

## Customers

```text
Design the CRM Customers desktop page as a customer service desk.

Use a search-first layout with CRMPageHeader, customer search/filter bar, customer table, and CustomerProfilePanel. Show name, contact, last visit, next booking, customer status, notes indicator, and related booking history. The profile panel should show customer identity, contact actions, recent bookings, preferences, notes, and quick links to booking context.

Keep it fast, calm, and useful for front-desk lookup. Do not invent new CRM automation or outreach workflows.
```

## Reconciliation

```text
Design the CRM Reconciliation desktop page as an end-of-day close and payment summary.

Include CRMPageHeader, date selector, PaymentSummaryCard group, payment method breakdown, exception queue, completed bookings table, unpaid/mismatch indicators, closeout checklist, and right rail totals. Critical issues should be visible without overwhelming the page.

Use professional finance-safe visual hierarchy. Preserve existing payment logic, booking status logic, and audit expectations.
```

## Mobile CRM Workspace Version

```text
Design a mobile version of the CradleHub CRM workspace.

Convert the desktop CRM shell into a mobile-friendly operational workspace. Use stacked sections, tappable actions, compact KPI chips, bottom navigation or drawer navigation, full-screen detail sheets, and tabbed board sections instead of wide tables or columns.

Include mobile adaptations for Today, Live Availability, Bookings, Dispatch, Customers, and Reconciliation. Keep primary actions early, prevent horizontal overflow, and preserve every workflow from desktop.
```
