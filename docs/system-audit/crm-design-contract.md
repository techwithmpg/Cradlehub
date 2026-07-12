# CRM Design Contract

Captured: 2026-07-10

## Intent

CRM screens are operational work surfaces. They should optimize scan speed, branch context clarity, and low-friction action handling. They should not behave like landing pages, marketing pages, or decorative dashboards.

## Existing Source Of Truth

- Use CRM and operational primitives before creating route-specific UI: `CrmTabNav`, `CrmPanel`, `CrmMetricCard`, `CrmEmptyState`, `CrmStatusBadge`, `CrmTableShell`, `CrmPreviewRailShell`, `ScheduleWorkspaceShell`, `AttendanceWorkspace`, and `HomeServiceDispatchWorkspace`.
- Use shared app primitives where they already exist: `Button`, `Badge`, `Alert`, `Tabs`, overlay components, dashboard `PageHeader`, readiness components, and schedule panels.
- Use CSS variables already present in the app: `--cs-surface`, `--cs-surface-warm`, `--cs-border`, `--cs-border-soft`, `--cs-text`, `--cs-text-muted`, `--cs-success`, `--cs-warning`, and related tokens.
- Prefer lucide icons already used in the area over new hand-drawn SVGs.

## Page Shell Contract

Operational CRM pages should follow this structure:

1. Branch/date/role context visible near the top.
2. Optional horizontal tab/navigation row when multiple related modes exist.
3. A compact metric or status strip only when it helps triage.
4. Primary work area with stable grid columns and no layout jump when counts or labels change.
5. Optional support rail for selected detail, readiness, history, or secondary actions.
6. Error/empty/loading states inside the same shell footprint.

## Interaction Contract

- Mutations must preserve current branch/date context after refresh or revalidation.
- Destructive or irreversible actions need explicit confirmation, reason capture, or guarded action copy.
- Home-service dispatch actions must preserve GPS, driver, therapist, and timed-release checks.
- Attendance actions must route action results through the workspace notice and refresh flow.
- Booking reschedule or reassignment actions must keep the customer time unless the user explicitly changes it.

## Current Variants

- Newer operational shells: `/crm/today`, `/crm/bookings`, `/crm/dispatch`, `/crm/attendance`, `/crm/schedule`.
- Mixed or legacy shell usage: `/crm/staff`, `/crm/staff-availability`, `/crm/setup`, `/crm/reconciliation`.
- Inline styling is most visible in reconciliation and staff availability. This should be migrated gradually, route by route.

## Alignment Rules

- Do not introduce new colors, radii, typography scales, roles, or workflow categories for alignment work.
- Do not move business logic into display components.
- Do not replace specialized workspaces with a generic shell when they already own complex tab state.
- Shell adoption should start with low-risk pages that already render one form or one history rail.
- Route visual changes should be validated with type-check, lint, build, and at least a local smoke check when the app can run.

## Prepared Shared Shell

A small `CrmOperationalPageShell` may safely standardize the older CRM pages. It should only own:

- outer spacing and constrained width
- title/description/context line
- optional tabs/actions/status slot
- optional support rail grid
- responsive primary/support layout

It must not own auth, data fetching, route state, tab semantics, or mutations.

