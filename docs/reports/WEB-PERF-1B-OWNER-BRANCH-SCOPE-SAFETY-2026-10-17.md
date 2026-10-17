# PERF-1B — Owner operational branch-scope safety

**PERF-1B IMPLEMENTATION COMPLETE — INDEPENDENT REVIEW REQUIRED**

## Authorization and starting state

- Branch: `stage/web-perf-1b-owner-branch-safety`.
- Accepted base / starting HEAD / merge-base: `e004112878f665fbd340d95a843e837bcfa058ce`.
- Fetched and verified exact `origin/main` before branch creation; starting working tree clean.
- Owner authorizes correctness plumbing, tests, report, commit and feature-branch push only. Owner retention activation, PERF-2, merge, intentional deployment and production/database changes are not authorized.

## Inventory recorded before implementation

Layout authenticates Owner workspace access using `getCurrentUserWorkspaceAccess` / `hasWorkspaceAccess`. Active branch selectors use cookie-authenticated branch reads (RLS); no browser-selected ID grants access. Existing layout retention identity is the profile's `me.branch_id`, which does not identify the page's query.

| Route | Classification | Current source / URL | Default and invalid selection | Server validation / query | Selector | Future identity |
| --- | --- | --- | --- | --- | --- | --- |
| `/owner` | B: all-branch aggregate | No operational URL branch; page ignores `branch` | All branches | `getOwnerOverviewDashboardData` authenticates Owner; cross-branch bookings/finance/attendance | Overview's branch cards are navigation, not a server scope selector | `all-branches` |
| `/owner/bookings` | B: optional branch | `branch` | Missing = all; arbitrary supplied ID previously passed directly to query | Page and `getOwnerWorkspaceBookingsAction` require Owner; `getAllBookings({branchId})`; active selector list from `getAllBranches` | `BookingsWorkspace` branch filter | Valid branch or explicit all; invalid = unavailable (never broaden to all) |
| `/owner/schedule` | A: branch | `branchId` | First active branch by name; invalid falls back to first | Page Owner check + active-list membership; `getDailySchedule`, stats and resources receive selected ID | `ScheduleWorkspace` toolbar | Validated branch |
| `/owner/attendance` | A: branch | `branchId` | First active by sort_order then name; invalid falls back with warning | `loadOwnerAttendanceBranch` requires Owner; active row lookup; `getAttendanceWorkspaceData({branchId})` | URL/deep link; tab navigation preserves branchId. Device registry's Branch filter is a separate internal filter | Validated branch, preserving distinct default order |
| `/owner/cash-flow` | A: branch | `branchId` | First active by name; invalid falls back | Workspace access check + active-list membership; `getCashFlowData(branch.id,...)` | Existing GET branch/date form | Validated branch |
| `/owner/dispatch` | A: branch | No URL branch; initial page uses profile branch | Initial profile branch required; refresh already uses saved Front Desk preference | Page active Owner check; `getDispatchData({branchId:me.branch_id})`; refresh uses `getAttendanceActionContext` and validates branch | Existing `/select-workspace` Front Desk chooser saves user-bound httpOnly preference | Validated saved Front Desk branch, then assigned active branch, then first active |
| `/owner/reports` | B: optional branch | `branchId`, also explicit `all` | Missing/all = aggregate; invalid server request errors | `getOwnerReportsDataAction` requires Owner; `fetchOwnerReportsData` checks active branch membership before querying | `SharedReportingControls` via native history pushState | Validated branch or explicit all; invalid = unavailable |
| `/owner/staff` | C: Owner-global | `tab` only; branch filtering is presentation | All staff / pending staff | Owner layout + `getAllStaff` / `getPendingStaff` | Staff workspace internal filters | `global` |
| `/owner/services` | C: Owner-global | No operational branch URL | Canonical catalog and offerings across branches | Owner layout; services/categories/active branches and offerings queries | Services client branch filters are catalog presentation | `global` |
| `/owner/branches` | C: Owner-global | No operational branch URL | All management branches, including inactive | Owner-checked `getBranchesOverviewAction` | Branch cards navigate to entity detail | `global` |
| `/owner/spaces-rules` | A: branch | `branchId` | First active by name; invalid falls back | Owner check + active-list membership; branch detail/rules/resource queries | `SpacesRulesWorkspace` branch selector | Validated branch |
| `/owner/payroll` | C: Owner-global | No operational branch URL | Payroll dashboard across staff | Page Owner check; `getPayrollDashboardData` | Dashboard internal controls | `global` |
| `/owner/notifications` | B: all-branch aggregate | No operational branch URL | Notifications across branches | `getOwnerAllNotificationsAction` | None | `all-branches` |
| `/owner/marketing` | C: Owner-global | No operational branch URL | Brand/site/media/catalog management | Owner layout and existing marketing loaders/actions | Studio internal editing controls | `global` |
| Staff/service/branch detail, new and invite routes | C: Owner-global management | Entity path IDs, not operational URL branch filters | Existing entity validation / not-found behavior | Existing page/action authorization and RLS | Entity editors | `global`; no retention policy added for these routes |

All-branches is an operational aggregate; global is a management workspace. Neither substitutes the Owner profile branch. Unsupported routes will not gain operational branch authority from arbitrary query parameters.

## Implementation

Final implementation SHA: `c7091ddda82a17af0cace62ed862276371747b2e`. This report is delivered in a subsequent documentation-only commit; the exact delivery HEAD is recorded in the final owner handoff and can be resolved with `git rev-parse stage/web-perf-1b-owner-branch-safety`.

### Canonical scope and server authority

`OwnerOperationalScope` has `branch`, `all-branches`, `global`, and an explicit fail-closed `unavailable` case. Runtime identities are `owner:branch:<validated-id>`, `owner:all-branches`, `owner:global`, or `owner:unavailable`. An absent branch on a concrete route with no available branches never fabricates a profile scope.

`resolveOwnerOperationalScope` is shared pure route-aware logic. It preserves Bookings' `branch` and the existing `branchId` routes, including Reports' explicit `all` sentinel. Repeated branch parameters are not accepted as authoritative selections. Attendance now passes the original parameter array to the shared resolver rather than prematurely selecting its first value, so server and runtime fallbacks agree. Invalid optional scopes remain unavailable, not widened to all branches. Concrete routes retain their existing approved first-active fallback, including Attendance's distinct ordering. Global management routes ignore operational URL filters. Existing entity detail authorization remains in its page/action.

`getOwnerScopeBranches` authenticates Owner workspace access before obtaining active, RLS-visible branches through the existing cookie-authenticated `getAllBranches` query. It passes only IDs, names and sort orders to the browser. React cache is request-local; no cross-user branch-list cache was added. Owner role/access, active staff and RLS remain server responsibilities. No service-role credential or protected business query moved into a Client Component.

Schedule, Cash Flow, Spaces & Rules and Attendance use the same resolver on the server. Bookings' server action now explicitly validates an active branch on every list request before invoking the existing query; an invalid branch returns an error without querying bookings or broadening to an aggregate. Reports already checks active membership and rejects an invalid branch server-side; that contract remains unchanged. Missing branch still means the existing aggregate query.

### Layout and runtime transition

The server Owner layout supplies authorized branch identities and the server-resolved Front Desk branch to a small `OwnerRuntimeScope` coordinator. The coordinator reads `usePathname` / `useSearchParams`, resolves the operational identity, and keys the runtime boundary by user, role and canonical scope. Protected data loading remains in server Pages/actions.

The boundary owns a new SWR cache for each scope, including when retention is OFF. It preserves `WorkspaceSWRScopeContext`, `useWorkspaceSWRKey`, the PERF-1A generation store and authenticated cleanup. Main → SM destroys the Main runtime rather than retaining it behind an SM label. SM → Main uses a fresh Main runtime; cross-branch restoration optimization is intentionally absent. Global and all-branches caches remain distinct.

Predictive retained navigation and remembered query restoration are permitted only within the same canonical scope. In particular, a bare `/owner/bookings` link cannot be rewritten into the retained Main filter: absence means all branches. CRM behavior uses the existing path because these guards are supplied only by the Owner coordinator.

For Main → SM → Main, tests assert separate DOM, SWR key/provider and generation store identities; immediate old-cache clearing; rejection of a pending Main generation response; Main event rejection while SM is active; SM reconciliation; and a fresh Main return. User/role changes and teardown clear protected state. Requests already in transport are not aborted. A legacy SWR response may finish in its discarded cache, but cannot populate the new scope's cache. PERF-1A guarded reconciliation also rejects the old generation token itself.

### Existing consumers: bounded safety corrections

- Reports changes branch through native `history.pushState`, which does not refresh server props. The client now treats removal of `branchId` as all branches rather than falling back to its old server branch. It refuses both stale server fallback data and previous SWR data whose branch differs from the requested scope. While the new scope loads it shows a local status/error; no route loading UI was added. Existing same-branch date-filter retained charts remain covered and passing.
- Bookings no longer falls back to the previous server list when its requested key differs and the new list is absent. No Bookings conversion or business mutation change was made.
- Dispatch initial loading now uses `resolveOwnerFrontDeskBranch`, matching the existing refresh context: user-bound httpOnly saved selection → assigned active branch → first active branch. Existing workspace selection at `/select-workspace` remains the selection flow. No new Dispatch branch selector or URL alias was invented. Arbitrary Dispatch `branch`/`branchId` parameters are ignored.
- Owner Dispatch's existing SWR requests now carry its branch identity and an `expectedOwnerBranchId` consistency check. This argument grants no authority: the action independently resolves the current authenticated context and rejects a changed branch or non-Owner mismatch before querying. CRM's existing Dispatch keys and options remain unchanged. Dispatch was already SWR-backed; no module conversion was performed.

### Semantic events

The existing targeted dependency map is preserved. The Owner adapter accepts branch-specific notifications only for server-listed active branch identities. A branch-scoped runtime accepts only its matching branch. All-branches aggregates accept notifications from any listed active branch because their actual queries span those branches. Global catalog/management scope also admits listed branch hints, but the dependency map selects only relevant modules (for example, `branch_rules.changed` can invalidate global service offerings).

Unavailable scopes and unknown/inactive/unlisted branch notifications are ignored. These are invalidation hints, not mutations or authorization. Legacy `BOOKINGS_CHANGED_EVENT` remains unchanged and increments affected generations once per notification; its lack of branch identity is an existing compatibility limitation. Owner retention remains OFF, so retained event/generation behavior is exercised through isolated component-test activation only.

## Changed files

| Area | Files |
| --- | --- |
| Canonical contract | `src/lib/owner/operational-scope.ts`, `src/lib/owner/operational-scope-server.ts` |
| Owner runtime | `src/components/features/dashboard/owner-runtime-scope.tsx`, `src/components/features/dashboard/retained-workspace-provider.tsx`, `src/components/features/dashboard/workspace-domain-events.ts` |
| Owner server integration | `src/app/(dashboard)/owner/layout.tsx`, `src/app/(dashboard)/owner/bookings/actions.ts`, `src/app/(dashboard)/owner/schedule/page.tsx`, `src/app/(dashboard)/owner/attendance/page.tsx`, `src/app/(dashboard)/owner/cash-flow/page.tsx`, `src/app/(dashboard)/owner/spaces-rules/page.tsx`, `src/app/(dashboard)/owner/dispatch/page.tsx`, `src/lib/attendance/owner-attendance-branch.ts` |
| Existing client safeguards | `src/components/features/bookings/owner-bookings-view.tsx`, `src/components/features/owner/reports/owner-reports-page.tsx`, `src/components/features/dispatch/dispatch-workspace.tsx`, `src/lib/actions/dispatch-data-actions.ts` |
| Tests | `tests/lib/owner/operational-scope.test.ts`, `tests/lib/owner/operational-scope-server.test.ts`, `tests/components/dashboard/owner-runtime-scope.test.tsx`, `tests/components/owner/owner-reports-page.test.tsx` |
| Report | `docs/reports/WEB-PERF-1B-OWNER-BRANCH-SCOPE-SAFETY-2026-10-17.md` |

## Verification

All evidence below is local automated verification, not authenticated browser or live-database evidence. Fixture branches use UUIDs; no private customer/staff data is included. The local Next.js `usePathname` and `useSearchParams` guides were read before implementation.

### Exact commands and results

Focused Owner scope, PERF-1A, affected Owner views and legacy/CRM regressions:

```powershell
pnpm vitest run --maxWorkers=4 tests/lib/owner/operational-scope.test.ts tests/lib/owner/operational-scope-server.test.ts tests/components/dashboard/owner-runtime-scope.test.tsx tests/components/dashboard/retained-workspace-provider.test.tsx tests/components/dashboard/workspace-generation-swr.test.tsx tests/lib/navigation/workspace-generation.test.ts tests/lib/navigation/workspace-module-registry.test.ts tests/lib/bookings/bookings-client-events.test.ts tests/lib/bookings/booking-payment-actions.test.ts tests/lib/cash-flow/owner-cash-flow-page.test.tsx tests/components/owner/owner-reports-page.test.tsx tests/components/owner/owner-reports-rebuild.test.tsx tests/components/dispatch/home-service-nav-cleanup.test.tsx tests/lib/crm/owner-front-desk-branch.test.ts tests/lib/crm/front-desk-context-owner.test.ts tests/lib/owner/owner-report-finance.test.ts
```

PASS: **16 files / 105 tests**. The final full suite also includes these tests after suppression of jsdom's unsupported native-link navigation in the test harness.

| Gate | Exact command | Result |
| --- | --- | --- |
| Full suite | `pnpm vitest run --maxWorkers=4 --reporter=json --outputFile=.playwright-mcp/perf1b-vitest-final.json` | PASS: 364 files; 2,894 passed / 2 skipped / 0 failed (2,896 total) |
| Type-check | `pnpm type-check` | PASS, exit 0 |
| Changed-file lint | `node node_modules/eslint/bin/eslint.js @lintFiles` (PowerShell splat of all 21 changed/new `.ts`/`.tsx` paths listed above) | PASS, exit 0 |
| Project lint | `pnpm eslint src tests` | Existing FAIL: 77 errors / 20 warnings in 14 files, each compared with accepted base and unchanged |
| Build | `pnpm build` | PASS, exit 0; compilation, TypeScript and static generation completed |
| Whitespace | `git diff --check` plus staged check | PASS |

The build uses process-local inert `NEXT_PUBLIC_SUPABASE_URL=https://build-only.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=build-only-placeholder`, and `SUPABASE_SERVICE_ROLE_KEY=build-only-placeholder`. No environment file was edited, no database command was executed, and no live database target was used or classified by this stage.

The initial full-suite run had no failed assertions but one test-module loading failure: importing the branch-query module at the top of the shared Owner actions loaded `unstable_cache` into an unrelated payment-test mock. The branch query import now occurs only inside the authenticated booking-list action. The payment suite and full suite pass after that correction. The first package-manager lint invocation joined Windows path arguments; rerunning the ESLint CLI with proper argument splatting passed. No tests or timeout thresholds were weakened. The previously recorded nonfatal jsdom `TimeoutNaNWarning` in PERF-1A synthetic focus testing remains.

### Coverage of the requested contract

- Resolver tests: Main/SM valid UUIDs, unlisted/inactive IDs, duplicate parameters, Bookings `branch`, Schedule/Attendance/Cash Flow/Reports `branchId`, Reports/all semantics, global routes, no-active-branch state, Attendance fallback order and Dispatch's validated Front Desk context.
- Server tests: Owner authentication before branch-list queries; minimal active-list serialization; Schedule queries SM; Attendance fallback/warnings; Bookings request validation and no query on denied scope; Dispatch initial/refresh parity and mismatch rejection. Existing Cash Flow and Reports invalid-branch tests pass.
- Component tests: Main → SM → Main DOM/cache/key/store changes; late Main result rejection; scoped events; aggregate event handling; legacy single invalidation; user/role/teardown purge; retention-OFF cache isolation; preserved unfiltered navigation; Reports native-history branch/aggregate fallback protection.
- Existing PERF-1A generation, registry, real-SWR integration, retained CRM, legacy booking event, Front Desk preference, Owner booking/payment, Reports and Dispatch suites run in the focused/full gates.

## Owner retention activation gates

| Gate | Current evidence / remaining requirement |
| --- | --- |
| 1. Active operational identity | Local resolver/server tests PASS across inventoried route contracts; independent review pending |
| 2. Main → SM → Main | Component/SWR integration PASS; authenticated browser sequence pending |
| 3. Zero cross-branch cache reuse | Local distinct provider/key and late-response tests PASS; authenticated browser verification pending |
| 4. Retained DOM isolation | Isolated activation component tests PASS; real Owner App Router/DOM verification pending |
| 5. SWR key isolation | Local branch/all/global/user/role tests PASS |
| 6. Logout / role / branch cleanup | Local teardown and scope-change tests PASS; authenticated logout/browser evidence pending |
| 7. Authenticated browser evidence | NOT PERFORMED |
| 8. Owner activation approval | NOT GRANTED; implementation authorization is not rollout approval |

**Owner retention remains OFF.** No rollout flag or environment was changed. Unit tests temporarily simulate retention within their process; that is not application activation. No gate is declared production-proven.

## Limitations, impact and rollback

**NO USER-PERCEIVED PERFORMANCE CLAIM YET.** This is correctness infrastructure. No production verification, authenticated browser measurements, live database verification or new performance benchmark was performed. Owner-supplied deployment status for the accepted base is context, not a result reverified here.

The server-authorized layout branch list is a snapshot; branch availability/permission changes require the normal server/layout refresh. Every protected Page/action still enforces server access. This stage does not add real-time permission revocation. Reports deliberately withholds a mismatched branch's charts while the correct scope loads. All-branch historical query behavior and global management entity editors remain unchanged. Legacy module callbacks and polling are not converted to the PERF-1A adapter. Front Desk branch preference is the established Dispatch control; other Owner routes retain their own URL semantics, not an invented universal branch selection.

Production mutations: **NONE**. Runtime merge: **NONE**. Intentional deployment: **NONE**. Schema/migration/RLS/policies/environment changes: **NONE**. Feature branch push may invoke existing preview automation; no deployment outcome is claimed.

Rollback before merge is to leave this branch unmerged. If later accepted, revert its implementation commit through a reviewed change; no database rollback is required. Keep Owner retention OFF. Do not force-push main.

Next permitted action is independent review. No retention activation, PERF-2, merge or deployment is authorized by completion of this stage.
