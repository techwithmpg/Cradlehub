# Attendance Reference Implementation

Date: 2026-07-10
Scope: CRM Attendance workspace only.

## Intent

Attendance is the CRM reference implementation for a dense operational workspace. This phase keeps existing behavior and data contracts intact while standardizing hierarchy, shared presentation primitives, tab accessibility, and toolbar consistency.

## Tab Audit

| Tab | Primary purpose | Primary action | Secondary actions | Supporting information | Contract fit | Duplication / shared opportunity |
| --- | --- | --- | --- | --- | --- | --- |
| Overview | Live branch attendance posture. | Scan the live staff board and active sessions. | Jump to Sessions, Records, or Recovery from contextual cards. | Recent scan activity and exceptions rail. | Strong primary/support split already. | Reuses `Panel`, `StatusPill`, `EmptyState`; keep as reference dashboard composition. |
| Records | Search and review attendance records. | Filter records and inspect the selected record. | Export, view staff, open Recovery. | Selected record rail with timeline, issue details, and correction entry points. | Strong task model; filter toolbar was local. | Replaced local select/search wrappers with shared toolbar primitives. |
| Sessions | Monitor checked-in staff and service countdowns. | Watch live staff/service sessions. | Open related records/sessions from cards. | Insights, recent activity, live board rail. | Good content model; header duplicated workspace shell and had inert buttons. | Reused `WorkspaceSection` and `ContextChip`; passed existing tab navigation callback through. |
| QR Codes | Manage attendance and room QR points. | Generate, export, print, deactivate QR points. | Filter by type/status/search and select bulk rows. | Selected QR panel and QR configuration notice. | Strong table/detail workflow; toolbar was local. | Reused shared toolbar primitives and shared notice component. |
| Devices | Manage trusted devices and recovery links. | Generate device recovery link. | Rename/revoke devices, revoke/replace pending links, switch branch when allowed. | Selected device rail and pending links. | Good registry/detail split; toolbar was local and title used hard-coded colors. | Reused shared toolbar primitives and default action styling. Deeper device table/dialog token cleanup remains. |
| Recovery | Triage blocked scans and repair attendance state. | Select recovery view, resolve/repair selected issue. | Open Devices, open Records, update rules, archive test data. | Queue, selected issue panel, rules safety, audit log. | Strong recovery cockpit; header duplicated Sessions pattern. | Reused `WorkspaceSection` and `ContextChip`; added explicit selected state for recovery view buttons. |
| Reports | Summarize/export attendance metrics. | Select report and inspect metric output. | Export, CSV, print. | Report list and metric table. | Lightweight but aligned enough for current scope. | Reused `Panel` description and shared toolbar primitives. Export wiring remains placeholder as before. |

## Standard Applied

Workspace order now follows the Attendance contract:

1. Workspace header
2. Module tabs
3. Toolbar / alert strip where relevant
4. Primary content
5. Optional right support rail
6. Dialogs
7. Toast and workspace notice feedback

## Extracted Shared Components

Shared Attendance primitives live in `src/components/features/attendance/attendance-ui.tsx`:

- `ContextChip`
- `WorkspaceNotice`
- `WorkspaceSection`
- `WorkspaceSectionHeader`
- `ToolbarShell`
- `ToolbarSelect`
- `ToolbarSearch`
- `AttendanceTabPanel`

Existing primitives were extended without breaking current callers:

- `Panel` now supports `description`.
- `EmptyState` now supports optional `icon`, `action`, and `className`.
- `StatusPill` now uses a shared local tone type.

## Accessibility Improvements

- Attendance tabs now expose stable `id` and `aria-controls`.
- Tab panels now expose matching `id`, `aria-labelledby`, focus outlines, and stable hidden states.
- Branch/date context in Attendance, Sessions, and Recovery is no longer rendered as fake buttons.
- Recovery view buttons expose `aria-pressed`.
- Workspace notices use `role="status"` or `role="alert"` with appropriate live regions.
- Toolbar search/select fields now consistently use visible labels.

## Remaining Inconsistencies

- Device subcomponents still contain older stone/brown token usage and hard-coded accent colors in tables, dialogs, and selected panels.
- QR detail/print subcomponents still contain QR-specific hard-coded brand accents.
- Records detail cards and selected rail still use local tile/card styling; they are behaviorally stable but not fully generalized.
- Reports export/filter behavior remains a placeholder from the existing implementation; this phase did not add reporting features.
- Browser-authenticated interaction QA is limited by the current in-app browser script execution issue documented in `authenticated-crm-qa.md`.

## Verification

- `pnpm type-check`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `pnpm test -- --run`: passed, 83 files / 674 tests.
- Browser QA: attempted to navigate to `/crm/attendance`, but browser control was blocked by the current tool usage limit. No browser interaction result is claimed for this phase.

## Booking Workspace Recommendation

Apply the Attendance pattern to Bookings in this order:

1. Inventory each Bookings tab by primary task, secondary actions, and support rail.
2. Replace fake context controls with `ContextChip`-style noninteractive status chips.
3. Normalize filters/search/action rows onto a shared toolbar shell.
4. Give Bookings tabs stable button/panel IDs before changing visual density.
5. Extract repeated booking status badges and empty/error/loading states only after the tab audit confirms duplicated semantics.
