# CRM-PERF-002 Navigation and Refresh Audit

Date: 2026-07-21
Task: CRM-PERF-002
Status at capture: pre-implementation baseline

## Scope and guardrails

This audit covers the authenticated CRM and Owner workspaces, their shared dashboard components, and repository-wide `router.refresh()` usage so that every call has an explicit disposition. It does not change booking lifecycle rules, payment rules, permissions, RLS, schema, public APIs, or business semantics.

The working tree already contained unrelated staff branch-assignment and attendance changes. Those changes are preserved and are not part of this audit.

## Documentation and runtime checked

- Repository operating context: `.context/CHANGELOG.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.md`, `.context/ERRORS.md`, `.context/HANDOFF.md`, `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, `docs/AGENT_RULES.md`, `docs/CLAUDE.md`, and root `CLAUDE.md`.
- Previous performance records: `docs/performance/crm-performance-baseline.md` and `docs/performance/crm-performance-optimization-report.md`.
- Installed runtime: Next.js 16.2.4, React 19.2.4, SWR 2.4.1, `@supabase/supabase-js` 2.106.2.
- Bundled Next.js 16.2.4 guides: linking and navigating, instant navigation, prefetching, loading UI, layouts, `useSearchParams`, and `useLinkStatus`.
- Current Supabase Realtime guidance. Existing Postgres Changes usage remains valid; no Realtime transport or schema change is required for this task.

## Classification legend

| Class | Meaning | Default treatment |
| --- | --- | --- |
| A | The current mounted view owns the changed entity | Optimistic or targeted local/SWR reconciliation; rollback on failure |
| B | The mutation changes surrounding metrics or related rows in the same workspace | Patch the smallest related state or revalidate the relevant SWR key |
| C | Other routes or public consumers also depend on the mutation | Keep server invalidation for those consumers; do not refresh the active workspace solely for them |
| D | Auth/session/permission state changed | A router refresh can be justified because the server component tree or session boundary changed |
| E | Realtime or external data changed outside the current mutation | Revalidate a scoped cache/subscription; refresh only as a documented fallback |
| F | Explicit manual recovery or an exceptional cross-tree fallback | Keep only if the view cannot safely reconcile more narrowly |
| O | Outside CRM/Owner scope | Record for completeness; no change in CRM-PERF-002 unless shared behavior directly affects the target workspace |

## Route loading baseline

There are **22** route-level CRM/Owner loading boundaries. They all replace the page segment below the persistent dashboard layout; many render a full work-area skeleton and several repeat page padding already supplied by the dashboard shell. This creates a visible skeleton flash even when navigating between already-used operational routes.

| Route boundary | Current behavior | Impact | Decision | Risk and test |
| --- | --- | --- | --- | --- |
| `crm/loading.tsx` | Full premium workspace skeleton for the CRM group | Redirect and sibling navigation can blank the whole work area | Remove route-level boundary | Verify CRM direct entry and sibling navigation |
| `crm/today/loading.tsx` | Full page skeleton | Replaces retained operational context | Remove | Verify Today navigation and back |
| `crm/bookings/loading.tsx` | Full bookings-area skeleton | Loses visible selection context during navigation | Remove; bookings owns localized pending state | Verify selection/search retention |
| `crm/customers/loading.tsx` | Full customer page skeleton | Full-area flash | Remove | Verify customer route direct entry |
| `crm/schedule/loading.tsx` | Full schedule skeleton | Replaces schedule canvas | Remove; schedule already has scoped data state | Verify schedule navigation and mutation |
| `crm/staff/loading.tsx` | Full staff workspace skeleton | Resets perceived tab/selection continuity | Remove | Verify staff tabs and modal flow |
| `crm/setup/loading.tsx` | Full setup workspace skeleton | Resets setup tab continuity | Remove | Verify setup tabs and history |
| `crm/reconciliation/loading.tsx` | Full reconciliation skeleton | Full-area flash | Remove | Verify direct navigation |
| `crm/dispatch/loading.tsx` | Full dispatch skeleton | Hides active dispatch context | Remove; keep panel-level map/error states | Verify dispatch route and retry |
| `crm/live-operations/loading.tsx` | Full operations skeleton | Full-area flash | Remove | Verify direct navigation |
| `crm/control/loading.tsx` | Loader on a compatibility redirect | Unnecessary skeleton before redirect | Remove | Verify redirect lands without intermediate flash |
| `crm/spaces-rules/loading.tsx` | Loader on a compatibility redirect | Unnecessary skeleton before redirect | Remove | Verify redirect query is preserved |
| `crm/services/loading.tsx` | Loader on a compatibility redirect | Unnecessary skeleton before redirect | Remove | Verify redirect query is preserved |
| `crm/availability/loading.tsx` | Loader on a compatibility redirect | Unnecessary skeleton before redirect | Remove | Verify redirect query is preserved |
| `crm/staff-availability/loading.tsx` | Loader on a compatibility redirect | Unnecessary skeleton before redirect | Remove | Verify redirect query is preserved |
| `crm/staff-applications/loading.tsx` | Loader on a compatibility redirect | Unnecessary skeleton before redirect | Remove | Verify redirect query is preserved |
| `owner/loading.tsx` | Full Owner workspace skeleton | Replaces the work area between sibling routes | Remove | Verify Owner direct entry and sibling navigation |
| `owner/bookings/loading.tsx` | Full bookings skeleton | Loses visible context | Remove; bookings owns scoped pending state | Verify bookings mutation/navigation |
| `owner/reports/loading.tsx` | Full reports skeleton | Replaces prior report while query changes | Remove; add retained SWR data and inline validating state | Verify preset navigation, back, refresh, and errors |
| `owner/schedule/loading.tsx` | Full schedule skeleton | Replaces schedule canvas | Remove | Verify schedule navigation |
| `owner/services/loading.tsx` | Full services skeleton | Full-area flash | Remove | Verify direct navigation |
| `owner/staff/loading.tsx` | Full staff skeleton | Full-area flash | Remove | Verify direct navigation |

The root `src/app/loading.tsx` is also a blank full-viewport surface. Public routes already have their own loading boundary, so the root boundary will be made non-visual to prevent it from covering the authenticated shell.

## Navigation and shell audit

| File or behavior | Finding | Decision | Test |
| --- | --- | --- | --- |
| Dashboard layout | Sidebar, header, and main already live above CRM/Owner route segments | Preserve structure; add stable test identifiers for regression coverage | Shell remains mounted while route content changes |
| `workspace-route-prefetcher.tsx` | The effect is keyed by pathname and reschedules the full route batch on every navigation | Key scheduling by stable workspace configuration and de-duplicate prefetched URLs for the session | Route change does not restart the prefetch batch |
| Sidebar links | Next `<Link>` is used, with additional hover prefetch but no localized pending affordance | Add a fixed-size `useLinkStatus` descendant indicator | Pending indicator does not change link geometry |
| Internal `window.location` assignments | CRM attendance, Owner attendance devices, CRM pending payments, and coach action navigation can perform document navigation | Use App Router navigation for same-origin internal URLs; preserve `tel:` and public scan reload behavior | Static contract test plus browser back/forward |
| Owner Reports retry | Plain internal `<a href>` causes document navigation | Replace with Next navigation and scoped retry | Static contract test |
| Setup/Services/Staff URL tabs | Native history writes exist, but some tab state is local-only and panels unmount | Derive URL state from `useSearchParams`, use history entries for explicit changes, keep operational panels mounted | Back/forward restores tab; filters/selection remain |

## `router.refresh()` inventory and disposition

Every repository call present at the baseline is represented below. Line numbers are baseline references and may move during implementation.

| File and baseline line(s) | Class | Impact | CRM-PERF-002 decision |
| --- | --- | --- | --- |
| `app/(auth)/login/google-personalized-sign-in.tsx:156` | D | Session/server tree changes after login | Keep; justified auth boundary refresh |
| `components/features/dashboard/booking-action-menu.tsx:110` | A/B/C | Booking row, counts, and other route consumers change | Replace active-view refresh through mutation callback/cache reconciliation; keep server invalidation |
| `components/features/dashboard/walkin-form.tsx:177` | A/B/C | New booking affects active list and metrics | Replace with scoped booking cache reconciliation where used in CRM/Owner |
| `components/features/dashboard/payment-action-menu.tsx:79,106,140` | A/B/C | Payment status and financial summaries change | Patch booking/payment data or scoped cache; preserve cross-route invalidation |
| `components/features/dashboard/customer-create-form.tsx:44` | A/C | Customer collection changes | Replace with local insert/callback where mounted in target workspaces |
| `components/features/payroll/payroll-settings-dialog.tsx:128` | A/C | Payroll settings change | Targeted local update; preserve invalidation |
| `components/features/payroll/monthly-pay-setup-card.tsx:70` | A/C | Employee pay setup changes | Targeted local update; preserve invalidation |
| `components/features/payroll/employee-payroll-table.tsx:92,107` | A/B/C | Employee payroll row and totals change | Patch row/totals or revalidate payroll key |
| `components/features/owner/reports/report-date-filter.tsx:32` | A/F | Query change triggers full RSC refresh plus fake one-second pending timer | Replace with retained SWR data and real `isValidating` state |
| `app/(dashboard)/owner/branches/[branchId]/branch-attendance-rules-card.tsx:155` | A/C | Branch rule editor owns changed values | Patch canonical action result; preserve invalidation |
| `app/(dashboard)/owner/branches/[branchId]/attendance-category-rules-editor.tsx:158` | A/C | Category rule editor owns changed values | Patch canonical action result; preserve invalidation |
| `app/(dashboard)/owner/marketing/marketing-studio.tsx:115` | A/C | Marketing setting changes | Local canonical update; preserve public invalidation |
| `components/features/bookings/bookings-desktop-workspace.tsx:118` | A/B/C | Selected booking/list changed | Replace with SWR mutate/targeted state reconciliation |
| `components/features/crm/availability/crm-availability-client.tsx:149` | F | Explicit manual refresh | Keep only as user-requested fallback, with local pending state |
| `components/features/crm/availability/crm-availability-client.tsx:223,232,597,623` | A/B/C | Availability block, day state, and counts change | Patch local availability model or revalidate scoped availability key |
| `components/features/crm/availability/crm-availability-board.tsx:106,145` | A/B/C | Board block/date state changes | Parent callback/scoped cache revalidation |
| `components/features/bookings/bookings-table.tsx:313,482,944,1068,1166,1719,1723,1772,2009` | A/B/C/F | Booking rows, selection, counts, and explicit recovery paths change | Replace routine mutation refreshes with row/list reconciliation; retain only documented manual recovery fallback |
| `components/features/bookings/administrative-booking-modal-provider.tsx:225` | A/B/C | Created/updated booking changes active list | Emit canonical result to bookings cache/parent |
| `components/features/bookings/quick-booking-form.tsx:957` | A/B/C | New booking changes list and metrics | Emit canonical booking result/scoped revalidation |
| `components/features/crm/staff/crm-staff-management-tab.tsx:85,113,125` | A/B/C | Staff status, services, and profile change while tab owns state | Patch staff/assignment collections from canonical action result; preserve other-route invalidation |
| `components/features/crm/staff/crm-staff-branch-resolution-dialog.tsx:111` | A/B/C | Resolution changes issue counts and staff/branch state | Return canonical resolution and reconcile parent issue/count state |
| `components/features/crm/staff/crm-staff-assignments-tab.tsx:135` | A/C | Assignment collection changes | Existing parent override becomes authoritative; remove refresh |
| `components/features/bookings/selected-booking-staff-row.tsx:55,60` | A/C | Selected booking staff changes | Patch selected booking/cached row |
| `components/features/crm/services/service-customization-table.tsx:211` | A/B/C | Home-service switch and counts change | Optimistic parent patch, canonical reconcile, rollback |
| `components/features/crm/services/crm-services-workspace.tsx:188` | A/C | Staff profile changed inside services workspace | Patch retained staff collection |
| `components/features/crm/services/provider-assignment-card.tsx:275` | A/B/C | Provider assignment and counts change | Targeted assignment collection update |
| `components/features/crm/services/selected-service-editor-rail.tsx:236,303` | A/B/C | Home/visibility/delivery settings and metrics change | Optimistic parent patch, canonical reconcile, rollback |
| `components/features/crm/services/service-assignment-table-row.tsx:146` | A/B/C | Assignment switch and provider count change | Optimistic parent patch, canonical reconcile, rollback |
| `components/features/crm/services/provider-assignment-sheet.tsx:375` | A/B/C | Provider assignment and counts change | Targeted assignment collection update |
| `components/features/dispatch/dispatch-flow-tab.tsx:494` | A/B/C | Dispatch job changed | Patch dispatch state or scoped revalidation |
| `components/features/dispatch/home-service-dispatch-modal.tsx:512` | A/B/C | New/updated dispatch job changes board | Return canonical job and reconcile board |
| `components/features/manager-settings/services-offered-tab.tsx:184` | O/A/C | Manager services setting changes | Outside target route; existing `skipRefresh` supports embedded ownership |
| `components/features/manager-settings/booking-rules-tab.tsx:85` | O/A/C | Manager booking rules change | Outside target route |
| `components/features/manager-settings/scheduling-automation-tab.tsx:73` | O/A/C | Manager automation changes | Outside target route |
| `components/features/staff/staff-approval-workspace.tsx:1128,1140` | A/B/C | Staff approval/rejection changes queue and counts | Scoped queue reconciliation in target workspace |
| `components/features/attendance/attendance-workspace.tsx:104,196` | E/F | Batched realtime/manual recovery refresh | Migrate to scoped attendance revalidation where safe; retain documented fallback if server-derived aggregate cannot be reconciled |
| `components/features/schedule/schedule-workspace.tsx:293,307` | E/F | Explicit/realtime schedule fallback | Existing SWR data is authoritative; use SWR mutate instead of tree refresh |
| `components/features/staff-portal/service-progress-modal.tsx:79` | O/A/C | Staff portal job state changes | Outside target route |
| `components/features/staff-portal/booking-progress-actions.tsx:194` | O/A/C | Staff portal booking state changes | Outside target route |
| `components/features/staff-portal/staff-profile-photo-uploader.tsx:63` | O/A/C | Staff profile photo changes | Outside target route |
| `components/features/staff-portal/staff-profile-details-form.tsx:85` | O/A/C | Staff profile changes | Outside target route |
| `components/features/staff-portal/staff-attendance-clock-out.tsx:42` | O/A/E | Staff attendance changes | Outside target route |
| `components/features/staff-portal/staff-checkin-widget.tsx:79,105` | O/A/E | Staff attendance changes | Outside target route |
| `components/features/staff-portal/staff-attendance-realtime.tsx:17` | O/E | Realtime attendance event | Outside target route |
| `components/features/staff-portal/staff-today-dashboard.tsx:35` | O/E | Staff dashboard realtime event | Outside target route |
| `components/features/staff-portal/driver/driver-active-job-page.tsx:36` | O/A/E | Driver job changes | Outside target route |
| `components/features/staff-portal/driver/driver-job-details-page.tsx:56` | O/A/E | Driver job changes | Outside target route |
| `components/features/staff-portal/driver/profile/driver-profile-edit-form.tsx:34` | O/A/C | Driver profile changes | Outside target route |
| `components/features/staff-portal/driver/profile/driver-profile-photo-field.tsx:73` | O/A/C | Driver photo changes | Outside target route |

Baseline total: **74 calls**. The implementation target is not a blind zero. Auth/session refreshes, explicit manual recovery, and any narrowly justified cross-tree fallback may remain; routine CRM/Owner mutations must not use a full router refresh.

## Controlled implementation passes

1. **Persistent shell and navigation:** stabilize prefetching, add non-shifting pending indicators, replace internal document navigation, and remove route-level full-work-area loading boundaries.
2. **Retained report/setup state:** migrate Owner Reports to retained SWR data and make URL tabs history-aware while keeping panels mounted.
3. **Mutation reconciliation:** return canonical minimal results from staff/services actions, reconcile mounted collections, and remove routine refreshes with rollback/error handling.
4. **Broader high-frequency flows:** migrate availability, bookings, dispatch, schedule, and attendance refreshes only where existing state/cache ownership makes the change safe; explicitly document any remaining fallback.
5. **Verification:** targeted tests after each pass, then type-check, lint, full test suite, production build, browser navigation/history/mutation/error checks, and final refresh/loader counts.
