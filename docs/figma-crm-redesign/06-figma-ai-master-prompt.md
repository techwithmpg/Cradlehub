# Figma AI Master Prompt

Paste this prompt into Figma AI after uploading the context docs and screenshots.

```text
We are redesigning the CradleHub CRM / Front Desk Workspace.

CradleHub is a premium spa operations system. The CRM workspace is used by front-desk and CSR staff to run daily operations, serve customers, manage bookings, review live staff availability, coordinate home-service dispatch, manage service/provider readiness, and close the day with payment reconciliation.

Important: the application logic and workflows already exist. Do not invent new business logic. Do not remove workflows. Do not redesign the Supabase data model. Do not change route structure, permissions, booking logic, staff availability logic, check-in logic, schedule logic, dispatch logic, or payment logic.

Improve only UI/UX hierarchy, layout, spacing, component consistency, responsive behavior, and interaction design. Treat this as a presentation-layer redesign over existing workflows.

Use the uploaded screenshots and markdown documents as context. Design desktop first, then mobile.

Visual style:
- Premium spa operations command center
- Calm, elegant, professional, and simple for non-technical staff
- Dark sidebar
- Cream/off-white workspace background
- Forest green primary actions and success states
- Warm gold accents
- Soft orange attention states
- Red only for critical blockers
- Clean SaaS typography, strong titles, readable body text, compact labels
- Compact operational density without feeling crowded

Layout principles:
- Main action above the fold
- Readiness warnings compact at the top
- Detailed issues in a drawer or side panel
- Right rail for summaries and selected item context
- Progressive disclosure for explanations
- Compact tables, KPI strips, tabs, side panels, status badges, and empty states
- No marketing landing-page layout
- No decorative hero sections

Create a reusable design system first. Include components for:
- CRMPageShell
- CRMSidebar
- CRMTopHeader
- CRMPageHeader
- SystemReadinessBar
- ReadinessIssueDrawer
- OperationsKpiStrip
- PrimaryActionRow
- RightRailSummaryCard
- CRMDataTable
- CompactStaffStatusRow
- AvailabilityBoardColumn
- AvailabilityIssueGroup
- WorkspaceActionCard
- PageHelpDisclosure
- EmptyStateCard
- StatusBadge
- DetailSidePanel
- BookingQueueTable
- DispatchQueuePanel
- CustomerProfilePanel
- PaymentSummaryCard

Then generate page designs one by one for these CRM pages:
- Today / Daily Operations Center
- Live Availability & Check-In Center
- Rules & Setup Center
- Services & Therapists
- Bookings
- Dispatch
- Live Map
- Schedule
- Customers
- Repeats
- Lapsed
- Waitlist
- Spaces & Rules
- Staff Applications
- Notifications
- Reconciliation

Important page direction:
- Today should become the daily command center.
- Live Availability should become a compact live operations board.
- Rules & Setup should become a setup/configuration hub.
- Services & Therapists should handle many services without becoming too long.
- Bookings should be a professional booking control table.
- Dispatch should be a home-service operations board.
- Customers should be a CRM customer desk.
- Reconciliation should be an end-of-day close and payment summary.

For each page:
- Preserve existing workflows.
- Show realistic operational sections based on the provided context.
- Use compact, professional layouts.
- Show desktop frame first.
- Include mobile adaptations where useful.
- Use clear component names and consistent auto layout.
- Use side panels and drawers for detail-heavy content.
- Keep warnings and help text accessible but not dominant.

The goal is a polished CRM operations workspace that feels premium, calm, fast, and safe for daily front-desk work.
```
