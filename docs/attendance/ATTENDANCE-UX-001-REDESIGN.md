# ATTENDANCE-UX-001 — CRM Attendance Redesign

> **Historical design record (superseded 2026-07-22):** The production audit
> evolved the release surface to the canonical **Today, Review, History, Setup**
> workspace implemented by `crm-attendance-workspace.tsx`. The three-area model
> below and its intermediate components remain design history, not the current
> release contract. Use `ATTENDANCE-PRODUCTION-AUDIT-20260722.md`, the current
> CRM workspace, and its `crm-*` tests for release decisions.

## Outcome

CRM Attendance now presents three task-focused areas—Today, Fix a Scan, and
Tools & History—while reusing the existing Attendance query, actions, scan
engine, device workflows, correction service, reports, QR exports, audit data,
SWR cache, and Supabase Realtime subscription.

## Navigation mapping

| Previous visible tab / old URL | New area | Canonical URL |
|---|---|---|
| Overview / `?tab=overview` | Today | `?view=today` |
| Records / `?tab=records` | Tools & History → Attendance History | `?view=tools&tool=history` |
| Sessions / `?tab=sessions` | Tools & History → Service Sessions | `?view=tools&tool=sessions` |
| QR Codes / `?tab=qr` or `?tab=qr-codes` | Tools & History → QR Codes | `?view=tools&tool=qr` |
| Devices / `?tab=devices` | Tools & History → Staff Phones | `?view=tools&tool=phones` |
| Review Queue / `?tab=exceptions` or `?tab=review-queue` | Fix a Scan | `?view=fix-scan` |
| Reports / `?tab=reports` | Tools & History → Reports | `?view=tools&tool=reports` |

Legacy URLs are interpreted server-side and canonically replaced client-side.
Staff/date/branch deep-link filters are retained. Explicit area/tool changes use
native History API entries integrated with Next search parameters, so browser
Back and Forward restore the selected surface without a route refresh.

## Today

Today derives its entire model from the existing `AttendanceWorkspaceData`.
`dailyStaffStates` is deduplicated by `staffId`, then enriched in memory with
the existing device-registry entry, latest scan, and open exception.

- Working: current `clocked_in` or `on_service` staff without an unresolved issue.
- Not Scanned In: staff in an expected schedule window without a clock-in.
- Needs Help: unresolved scan, device, branch, schedule, or attendance state.
- Checked Out: staff whose resolved operational status is `clocked_out`.

The staff table keeps one row per staff member, supports task-oriented filters
and name search, and opens a focus-trapped right Sheet for details. Recent Scan
Activity translates outcomes to plain language and keeps raw reason/action data
inside an expandable System details disclosure.

## Issue presentation contract

`AttendanceIssuePresentation` is the only normal-workflow wording contract:

```ts
type AttendanceIssuePresentation = {
  category: AttendanceIssueCategory;
  title: string;
  summary: string;
  explanation: string;
  steps: string[];
  recommendedAction: AttendanceIssueAction;
  secondaryActions: AttendanceIssueAction[];
  severity: "info" | "warning" | "critical";
  technicalCode?: string;
};
```

The presenter maps authoritative reason/device/schedule states to:
`phone_not_connected`, `phone_revoked`, `replacement_phone_required`,
`wrong_branch`, `no_schedule`, `scan_too_early`, `scan_too_late`,
`stale_open_attendance`, `duplicate_scan`, `clock_out_review`,
`branch_assignment_review`, `device_limit_reached`, `inactive_staff`, and
`unknown_issue`. Titles, explanations, steps, and action labels are centralized
in one catalog; raw codes remain available only in Technical details.

Fix a Scan adds staff search, an identity/state summary, Current problem, What
happened, What to do next, recommended/secondary actions, technical details,
and audit history. Existing Review Queue, correction, rules, stale-record,
branch-correction, phone-recovery, and audit controls remain mounted in the
expandable advanced recovery workspace.

## Wording changes

| Technical wording | CRM wording |
|---|---|
| Review Queue | Fix Scan Problems |
| Device Registry | Staff Phones |
| Activate Phone | Connect Phone |
| Recovery Link | Connect Replacement Phone |
| Exception | Needs Review |
| Attendance Record | Clock-in / Clock-out Record or Attendance History |
| Revoke Device | Disconnect Phone |
| Reset Next Scan State | Fix Next Scan |
| Branch Assignment Issue | Wrong Branch |

Underlying action names, database values, reason codes, and audit terminology
were not renamed.

## Component architecture

- `attendance-workspace.tsx`: composition, canonical navigation, optimistic action reconciliation.
- `use-attendance-live-workspace.ts`: the single SWR/Realtime lifecycle.
- `attendance-primary-tabs.tsx`: accessible three-area navigation.
- `today/*`: summary, deduplicated roster, and plain-language activity.
- `fix-scan/*`: staff selection and shared issue presentation.
- `attendance-staff-drawer.tsx`: responsive, focus-trapped staff detail Sheet.
- `tools/attendance-tools-view.tsx`: card navigation around the five existing tools.
- `lib/attendance/*presentation*`: shared typed diagnostic vocabulary.

Visited functional panels remain mounted and are hidden with the native
`hidden` attribute when inactive. No `router.refresh()` or second Realtime
channel was introduced.

## Preserved business logic and security

No migration, schema, RLS, permission, scan-rule, cron, report-calculation, or
Manager-workspace change is part of this task. First/next scan interpretation,
windows, debounce, stale recovery, branch correction, device registration and
disconnection, recovery links, QR generation/export, report calculations, audit
history, and production enforcement continue through their existing services.

## Responsive and accessibility behavior

- Desktop: four summary cards, compact staff table, and a right-side detail Sheet.
- Tablet: two-column summaries and wrapping task controls.
- Mobile: two-column summaries, stacked staff rows, full-width right Sheet, and stacked tool cards.
- The three primary tabs use tablist/tab/tabpanel semantics, roving tab stops,
  Arrow/Home/End keys, visible focus, and text labels independent of color.
- Hidden panels use `hidden`, preventing inactive controls from entering the
  accessibility tree or keyboard order.
- The Base UI Sheet provides focus trapping, Escape/close behavior, and focus
  restoration. Live refresh and action results use polite/assertive status regions.
- No custom required-motion animation was added.
