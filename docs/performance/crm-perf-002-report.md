# CRM-PERF-002 Implementation Report

Date: 2026-07-21
Result: **CONDITIONAL PASS — implementation and automated gates pass; authenticated Owner browser QA remains**

## 1. Overall result

The active CRM and Owner workspaces now use a continuously mounted dashboard shell, retained page data, localized pending states, optimistic/canonical mutation reconciliation, scoped SWR revalidation, and URL-backed subviews. No active CRM/Owner route module or active shared workspace component calls `router.refresh()` for an ordinary mutation. All 22 CRM/Owner route-level loading boundaries were removed.

The remaining condition is evidence-only: the available authenticated browser session had CRM/front-desk access, not Owner access. CRM shell/history/state retention was verified in the browser with no console errors. Owner Reports, Marketing, Attendance Rules, Payroll, Bookings, and Schedule behavior is covered by TypeScript, focused tests, static contracts, and the production build, but the requested authenticated Owner click-through still needs an Owner session.

## 2. Root causes confirmed

1. Twenty-two nested `loading.tsx` boundaries replaced the full route segment below the dashboard shell, producing work-area flashes and duplicated page padding.
2. Routine mutations combined server invalidation with `router.refresh()`, refetching the RSC tree after the client already knew the mutation result.
3. Several actions returned only success/failure, so clients could not reconcile the affected row, switch, assignment, settings object, or summary.
4. Owner Reports used navigation plus refresh/fixed timing rather than retained SWR data and real request state.
5. Realtime Attendance and dispatch changes invalidated the whole route instead of one branch/date cache key.
6. Some tabs were temporary local state or used replacement history, so Back/Forward could not restore explicit subview changes.
7. Five active internal navigation paths used document navigation or a plain internal anchor.
8. Workspace prefetch scheduling restarted as the pathname changed and could repeat the same high-value route batch.

## 3. Files changed

The task-specific change set spans the persistent dashboard shell, CRM/Owner route boundaries, retained workspaces, authenticated server actions, focused regression tests, and project context. The principal implementation files are:

- Shell/navigation: `src/app/(dashboard)/layout.tsx`, `src/app/loading.tsx`, `src/components/features/dashboard/sidebar.tsx`, and `src/components/features/workspace/workspace-route-prefetcher.tsx`.
- Retained data: Owner Reports/Bookings, Attendance, Dispatch, and Schedule server/client modules under `src/app/(dashboard)` and `src/components/features`.
- Targeted mutations: CRM Services/Staff, Owner Marketing/Attendance Rules, Payroll, Bookings, Dispatch, and Schedule actions/components.
- Regression coverage: `tests/lib/navigation/crm-owner-navigation-contract.test.ts`, `tests/lib/bookings/bookings-client-events.test.ts`, `tests/components/crm/service-customization-table.test.tsx`, `tests/components/crm/staff-management-retention.test.tsx`, and `tests/components/owner/owner-reports-page.test.tsx`.
- Audit/context: `docs/performance/crm-perf-002-audit.md`, this report, and the required `.context`/roadmap/project-context files.

The working tree also contains pre-existing user work outside CRM-PERF-002; it was preserved and not reverted. The audit contains the task-specific source inventory and classifications.

## 4. Full browser reloads removed

Five active CRM/Owner document-navigation paths were replaced with `Link` or App Router navigation. The final active-scope count is zero for `window.location.href`, `assign`, `replace`, and plain internal CRM/Owner anchors. A static contract test prevents regressions.

### Exact before/after counts

| Measure | Before | After | Evidence |
| --- | ---: | ---: | --- |
| Repository `router.refresh()` calls | 74 | 26 | `rg -o "router\\.refresh\\(\\)" src` |
| Active CRM/Owner route and shared workspace `router.refresh()` calls | routine calls present across Bookings, Staff, Services, Reports, Marketing, Attendance, Dispatch, Schedule, Payroll | 0 | navigation contract test scans active route/component scope |
| CRM/Owner route-level `loading.tsx` files | 22 | 0 | filesystem contract test and direct count |
| Active internal CRM/Owner document navigations removed | 5 | 0 | diff plus static navigation contract |
| Sidebar/header remounts in observed CRM route navigation | not instrumented at baseline | 0 observed | browser: Work Queue → Schedule, shell test IDs remained visible |
| Requests represented by one Home Service service switch | broad route refresh after action | 1 mutation action; no client route refresh | optimistic switch test and source contract |
| Requests represented by one Owner report preset change | route navigation + route refresh | 1 SWR report request with previous data retained | Owner report retained-data test |

## 5. `router.refresh()` calls

The repository-wide raw count fell from 74 to 26, while the active CRM/Owner route and shared-workspace count fell to zero. The 26 repository calls left after the migration are not active CRM/Owner routine mutations:

- 1 authenticated login/session-boundary refresh (intentionally retained).
- 3 Manager Settings calls outside this task's route scope.
- 2 Manager staff-approval calls outside the CRM/Owner workspace dependency graph.
- 13 Staff Portal/Driver calls outside scope.
- 7 calls in two unreachable legacy CRM Availability components. `/crm/availability` redirects to `/crm/schedule`, and repository import search finds no active consumer of these components. They are inert technical debt, not runtime fallbacks.

## 6. Route-level loading boundaries

The CRM/Owner route-level count fell from 22 to zero. There are no remaining justified route loaders in that scope: initial/panel pending behavior is localized, and redirect-only routes no longer render full-work-area skeletons.

### Loading and persistent shell

- Removed all CRM and Owner route-level loading files, including redirect-only compatibility routes.
- Made the root `src/app/loading.tsx` non-visual so it cannot cover an already-mounted authenticated workspace; public routes retain their own loading boundary.
- Added stable `workspace-sidebar`, `workspace-header`, and `workspace-main` test IDs.
- Sidebar links use Next navigation with `useLinkStatus` for a fixed-size, local pending dot that does not shift link geometry.
- Workspace route prefetching now de-duplicates routes across the session and is keyed by stable workspace configuration rather than pathname changes.

## 7. Modules migrated to retained data/SWR

### Owner Reports

- One authenticated action returns the complete typed report payload for a preset/date request.
- SWR keys by preset/from/to, uses initial server data as fallback, enables `keepPreviousData`, and shows real `isValidating` feedback.
- Previous charts, KPIs, and cash summary remain visible during revalidation or an inline refresh error.
- Preset changes write navigable URL history. Manual Refresh calls the report cache only; no timer or route refresh remains.

### Attendance

- The server action returns a fresh authorized branch attendance payload.
- Realtime events debounce a scoped SWR mutate instead of refreshing the route.
- Existing QR/device/exception optimistic patches remain local; corrections/rules reconcile only the attendance cache.
- Active tab, record filters, QR selection, and workspace scroll remain owned by the mounted client workspace.

### Dispatch

- Dispatch owns a branch/date SWR payload with retained fallback data.
- Booking change events and dispatch modal saves revalidate only the dispatch dataset.
- Assigning a driver/therapist or preparing dispatch no longer triggers duplicate modal and route refreshes.

### Schedule

- Owner/Manager Schedule uses a scoped authorized data action for staff rows, metrics, and resources.
- Successful schedule/availability changes mutate that cache rather than the RSC tree.
- CRM Schedule tab changes create real history entries. Back/Forward restores Daily Timeline and Schedule Setup.
- Once visited, both schedule subviews stay mounted while hidden; setup staff/form state survives tab changes.

### Bookings

- CRM Bookings retains its existing SWR architecture.
- Owner Bookings now has a retained SWR client view over its server-provided initial data.
- Booking creation/payment/status/staff/driver/session mutations emit one client booking-change event; mounted booking and dispatch consumers reconcile their own caches.
- Selected booking context and list state no longer depend on a route refresh.

### CRM Services, Staff, and Setup

- Services, assignments, providers, branch service settings, selected editor, counts, and readiness derive from retained workspace collections.
- Switches and assignment commands optimistically patch only the affected entity, reconcile canonical action results, and roll back on failure.
- Staff edits/status/services/branch resolutions patch the affected staff or issue collection and related counts.
- Setup, Services, and Staff tabs derive from URL search parameters and keep their operational panels mounted.

### Owner Marketing, Attendance Rules, and Payroll

- Marketing actions return the canonical saved section/asset; the studio updates only that section/card and preserves its tab.
- Attendance Rule actions return fresh typed rule data, history, and category overrides; the card keeps its active tab.
- Payroll actions return canonical salary/status/settings values; row and summary metrics update from retained client state.

## 8. Mutations converted to targeted optimistic updates

Converted mutation surfaces include:

- CRM service Home Service, public visibility, delivery mode, and provider assignments.
- CRM staff profile, activation, service capabilities, assignments, and branch correction resolution.
- CRM/Owner booking status, payment, driver, therapist, direct action, quick booking, walk-in, and administrative modal flows.
- Owner Marketing sections/assets.
- Owner Attendance branch/category rules.
- Owner/Manager schedule and availability reconciliation.
- Owner payroll settings, monthly pay, and paid/unpaid state.
- CRM/Owner dispatch assignments and release preparation.

Server-side path/tag invalidation remains where public pages or other authenticated consumers require it. The active client no longer performs the redundant `action → revalidatePath → router.refresh → SWR mutate` sequence.

## 9. Browser-history and URL-state improvements

- Replaced five internal document navigations with `Link` or App Router navigation.
- Added a static contract preventing active CRM/Owner `window.location` navigation, plain internal anchors, full route loaders, or routine `router.refresh()` regressions.
- Owner Reports, CRM Setup, CRM Services, CRM Staff, CRM Attendance, and CRM Schedule represent explicit subviews in the URL.
- CRM Schedule now uses push history for user-selected subviews; browser Back and Forward were verified live.
- Schedule Setup is retained after first visit so an in-progress local selection/form survives switching tabs.

## 10. Tests added and results

New/updated focused coverage:

- `crm-owner-navigation-contract.test.ts`: loaders, internal navigation, active refresh calls, persistent shell markers, pending link state, schedule history/mounting.
- `service-customization-table.test.tsx`: one-switch pending isolation, optimistic update, canonical patch, rollback.
- `staff-management-retention.test.tsx`: active tab, search, selected staff, and patched row retention.
- `owner-reports-page.test.tsx`: URL preset history, previous report retention during SWR validation, canonical replacement.
- `bookings-client-events.test.ts`: scoped booking/dispatch invalidation event.
- Payroll test updated to assert canonical row callback and no refresh.
- Existing reports, booking actions/list, Attendance Rules, staff branch corrections, and live schedule suites were run as focused regression coverage.

## 11. Manual QA results against every acceptance criterion

| # | Acceptance criterion | Result | Evidence |
| ---: | --- | --- | --- |
| 1 | Work Queue → Bookings does not show a full-page skeleton | Conditional | All CRM loaders are absent and the navigation contract passes; exact live Work Queue → Bookings sequence remains to be recorded. |
| 2 | CRM/Owner sidebar and header remain mounted | Conditional | CRM live navigation retained the shell test IDs; persistent layout/static tests cover both workspaces, but Owner live role evidence remains. |
| 3 | Revisited modules show retained/cached content immediately | Conditional | Retained SWR/fallback data is tested; Schedule Setup state was retained live. Exact Work Queue revisit remains. |
| 4 | Service switch patches only related UI | Pass | Focused test proves isolated pending state, optimistic patch, canonical reconciliation, rollback, and no route refresh. |
| 5 | Staff edit preserves workspace context | Pass | Focused retention test preserves tab, search, selection, and patches the edited row. |
| 6 | Owner Reports retain charts while filtering | Pass (automated) | SWR test holds the request promise pending and confirms previous report data stays rendered. |
| 7 | No forbidden CRM/Owner internal navigation | Pass | Final active count is zero; static contract scans document navigation and plain internal anchors. |
| 8 | No ordinary mutation uses `router.refresh()` | Pass | Final active CRM/Owner/shared-workspace count is zero. |
| 9 | Remaining skeletons match finished shells | Pass by removal/scope | No CRM/Owner route-level skeleton remains; first-load feedback is panel/local rather than a duplicate page shell. |
| 10 | Back/Forward preserves navigable state | Conditional | CRM Schedule Back/Forward and retained Setup selection passed live; Owner Reports history is automated but not live-certified. |
| 11 | Pending feedback is command-local | Pass (automated) | Service switch and report filter tests verify affected-control pending state; no workspace overlay exists. |
| 12 | Existing content remains during revalidation | Pass | Owner Reports retained-data test and SWR configuration prove this behavior. |
| 13 | Errors do not clear the workspace | Pass (automated) | Service rollback and inline/toast paths retain surrounding data; report refresh error keeps previous data. |
| 14 | No fake fixed-duration request spinner | Pass | Owner Reports uses SWR request state; static/source audit found no task-scope fixed-timer request indicator. |
| 15 | Build, lint, type checking, and focused tests pass | Pass | See section 12. |

### Browser evidence

Completed in the authenticated CRM/front-desk localhost session:

- CRM Work Queue rendered with the existing shell and operational content.
- Sidebar navigation to CRM Schedule completed through client navigation; `workspace-sidebar` and `workspace-main` remained visible.
- No full-area loading overlay or blank shell appeared.
- Schedule Setup created `?tab=setup`; Back restored Daily Timeline, Forward restored Schedule Setup.
- A changed Schedule Setup staff selection survived switching to Daily Timeline and back.
- No browser console errors were captured during the navigation/history/state checks.

Automated/manual-equivalent evidence:

- Service switch pending isolation, optimistic state, canonical reconciliation, and rollback: focused RTL test.
- Staff search/tab/selection retention after row patch: focused RTL test.
- Owner report URL and retained charts during actual pending promise: focused RTL/SWR test.
- Owner Marketing/Attendance Rules/Payroll canonical action contracts: type checking, focused neighboring tests, source contract, and production build.
- Internal navigation and redirect-only loader absence: filesystem/source contract test.

Not completed in-browser:

- The exact Work Queue → Bookings → Work Queue sequence (Work Queue → Schedule and schedule history were checked instead).
- Owner Reports preset/Back and Owner Marketing or Attendance Rule save using an authenticated Owner session. The available session was CRM-only.
- A browser-network panel capture for request counts or a numeric CLS trace. Source/test contracts prove the request topology, and visual navigation showed no shell replacement, but no numeric CLS claim is made.

## 12. Build, lint, type-check, and test status

- `pnpm type-check`: pass.
- `pnpm lint`: pass with two pre-existing unrelated warnings (`applyLaunchRecovery`, `AdminClient`); zero errors.
- `pnpm test -- --reporter=dot`: pass, 145 files / 1,117 tests, including the staff-retention regression.
- Focused interaction suites: pass.
- `pnpm build`: pass, Next.js 16.2.4 production compilation and all 110 route generations. It was run with an isolated temporary dist directory because a user dev server owned `.next`; the temporary config change/output were removed afterward.
- `git diff --check`: pass (line-ending notices only).

## 13. Known remaining risks

- Authenticated Owner browser behavior has automated/type/build evidence but lacks the requested final role-specific click-through.
- The exact CRM Work Queue → Bookings → Work Queue sequence lacks recorded live evidence, although the equivalent CRM shell/history exercise passed and the source contract is green.
- Request topology is source/test verified, but no DevTools Network archive or numeric CLS trace was captured.
- Seven raw refresh calls remain in two unreachable legacy CRM Availability components; they are inert while the redirect and lack of imports remain true.

## 14. Exact follow-up work

1. Run the short Owner browser script while signed in as Owner: Reports preset and Back, then one Marketing or Attendance Rule save. Confirm retained content and localized pending feedback.
2. Run the exact CRM Work Queue → Bookings → Work Queue browser sequence and optionally capture the Network panel to archive document-request and request-count evidence.
3. Delete the unreachable legacy `crm-availability-client.tsx` and `crm-availability-board.tsx` after a final product-owner confirmation that no external/custom import relies on them; this removes the last seven inert CRM-named refresh calls.
4. If release certification requires a quantitative layout metric, capture CLS with the production profiler. This report intentionally claims visual shell stability, not a fabricated CLS number.

No schema, RLS, permission, business-rule, brand, terminology, or workflow changes were introduced by CRM-PERF-002.
