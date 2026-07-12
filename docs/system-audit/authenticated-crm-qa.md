# Authenticated CRM QA

Date: 2026-07-10

## Environment

| Field | Value |
| --- | --- |
| Branch | `main` tracking `origin/main` |
| Commit hash | `1cd981c029f3319a1b804a01505f1a14f7af5e11` |
| Run mode | Existing local Next dev server on `http://127.0.0.1:3000`; final automated verification used `pnpm` project scripts |
| Browser | Codex in-app authenticated browser for protected route smoke; separate Playwright browser for JS-runtime sanity check |
| Viewports | 1440 x 1000, 1280 x 900, 768 x 900, 390 x 844 |
| Authenticated role | Front Desk Workspace / CRM access, signed in as `Codex QA Work Queue` |
| Branch context | `Cradle Wellness living Main Spa` after fix; reconciliation previously resolved to dev-bypass `Dev Branch` |
| Restore point | `C:\Users\eleur\AppData\Local\Temp\cradlehub-before-authenticated-crm-qa.patch` |

## Route Matrix

| Route | Load result | Console status | Network status | Permission status | Responsive status | Primary interactions tested | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/crm/today` | Loaded authenticated CRM workspace with Work Queue and prioritized actions | No console errors in authenticated smoke | No failed resource status observed in route sweep | Front-desk controls rendered; no restricted mutation was submitted | Desktop and mobile had no document overflow; 768px shared dashboard chrome overflow observed | Static queue render, direct filter URL check, details/menu hit testing | Pass for authenticated load/layout; React interaction QA blocked because authenticated in-app browser did not execute page scripts |
| `/crm/bookings` | Loaded booking workspace with selected booking detail | No console errors in authenticated smoke | No failed resource status observed in route sweep | Front-desk booking controls rendered; mutation buttons were not submitted | Desktop and mobile had no document overflow; table uses intended internal horizontal scroll | Static list/detail render, search input DOM update, selected detail presence | Pass for authenticated load/layout; modal/action interaction QA blocked by authenticated browser JS limitation |
| `/crm/attendance` | Loaded attendance overview with records, sessions, QR, devices, recovery, reports tabs | No console errors in authenticated smoke | No failed resource status observed in route sweep | Front-desk attendance controls rendered; no recovery/session mutation was submitted | Desktop and mobile had no document overflow; tab strip uses intended internal horizontal scroll | Static tab content render, Sessions route surface present, action center present | Pass for authenticated load/layout; tab switching and Complete Due action not verified in JS-enabled authenticated browser |
| `/crm/dispatch` | Loaded dispatch queue with home-service booking detail | No console errors in authenticated smoke | No failed resource status observed in route sweep | Front-desk dispatch controls rendered; release/prepare mutations were not submitted | Desktop and mobile had no document overflow; 768px shared dashboard chrome overflow observed | Static queue/detail render, scheduled/release columns, dispatch checklist | Pass for authenticated load/layout; map/view/modal interaction QA blocked by authenticated browser JS limitation |
| `/crm/reconciliation` | Loaded shell target with real Cradle branch context after fix | No console errors in authenticated smoke | No failed resource status observed in route sweep | Front-desk access enforced through shared CRM context | Desktop no overflow; mobile no overflow after support-rail fix; 768px residual overflow is shared dashboard chrome | Shell header, context, summary, form, support rail, mobile stack | Pass after fixes |

## Confirmed Defects

### RQA-001 - Reconciliation support rail did not use the shared shell slot

| Field | Detail |
| --- | --- |
| Route | `/crm/reconciliation` |
| Severity | High |
| Reproduction steps | Open `/crm/reconciliation` authenticated at 768px or 390px and inspect the System Records, form, and History rail. |
| Expected result | The new `CrmOperationalPageShell` should stack the support rail below the main content until the shell's wide breakpoint. |
| Actual result | Reconciliation still owned a route-local fixed `1fr 320px` grid, producing a 700px internal layout on mobile and a clipped History rail at tablet width. |
| Root cause | The route used the new shell header but kept the old two-column content grid instead of passing History through `support`. |
| Files changed | `src/app/(dashboard)/crm/reconciliation/page.tsx` |
| Verification | Authenticated smoke showed reconciliation main content `scrollWidth` equals `clientWidth` at mobile, History stacks below the form, and desktop keeps the rail. `pnpm type-check`, `pnpm lint`, `pnpm build`, and `pnpm test -- --run` passed. |

### RQA-002 - Reconciliation branch context preferred dev bypass over the real staff branch

| Field | Detail |
| --- | --- |
| Route | `/crm/reconciliation` |
| Severity | High |
| Reproduction steps | Open `/crm/reconciliation` with the authenticated QA user while dev bypass is enabled. |
| Expected result | The page should use the authenticated staff branch when one exists, matching the CRM workspace branch. |
| Actual result | The page showed `Dev Branch` and a zero-booking summary while the CRM shell and other CRM routes resolved `Cradle Wellness living Main Spa`. |
| Root cause | Route-local `getContext()` short-circuited on `isDevAuthBypassEnabled()` before checking the authenticated staff record. |
| Files changed | `src/app/(dashboard)/crm/reconciliation/page.tsx` |
| Verification | Authenticated smoke now shows `Cradle Wellness living Main Spa`, total bookings `1`, unpaid `1`, expected `PHP 700` equivalent in the rendered summary, and no console errors. Full automated verification passed. |

## Non-Blocking Observations

- The authenticated in-app browser rendered protected CRM pages but did not execute Next/Turbopack client runtime scripts. The route smoke recorded `scriptsExecuted=false` for every priority route. Direct DOM hit tests confirmed tab buttons were hit, but React event handlers were not attached in that browser surface.
- A separate Playwright browser did execute as a normal browser but did not share the authenticated session and redirected protected CRM routes to `/login`. No safe test credentials or reusable storage state were available in the repository.
- The 768px viewport showed shared dashboard chrome overflow of about 805px document width on multiple CRM routes. Reconciliation-specific content no longer contributes to that overflow after the shell fix.
- Mutation-heavy actions were intentionally not submitted: payment confirmation, booking confirmation, attendance Complete Due, device recovery, reconciliation Save Draft/Submit, and dispatch release.
- Attendance appears to mount several tab panels in the DOM. Visibility and active-state interaction could not be fully verified without a JS-enabled authenticated session.

## Shell Validation

What works:

- `CrmOperationalPageShell` supports a header with context, title, description, optional actions, children, and a compositional `support` rail.
- Reconciliation now uses the shell support rail without changing the shell API.
- Desktop keeps the support rail to the right.
- Mobile stacks the support rail below the form with no reconciliation content overflow.
- The route has no duplicate page header and no duplicate route-local grid ownership.

What does not work or remains unproven:

- The shared dashboard chrome still overflows at 768px independently of the reconciliation shell.
- Client-side interaction behavior could not be authenticated in a JS-enabled browser session.

Readiness:

- The shell API did not change.
- Reconciliation is stable for authenticated server-rendered load, branch context, and responsive shell layout.
- The shell is layout-ready for a next route, but the next alignment should wait for a JS-enabled authenticated browser session so workflow controls can be verified before and after alignment.

## Verification

| Check | Result |
| --- | --- |
| `pnpm type-check` | Passed |
| `pnpm lint` | Passed |
| `pnpm build` | Passed on Next.js 16.2.4 / Turbopack |
| `pnpm test -- --run` | Passed, 83 test files, 674 tests |
| Authenticated smoke | Passed for server-rendered load/layout on all five priority CRM routes |
| Authenticated interaction QA | Blocked by authenticated browser surface not executing page scripts; separate JS-enabled Playwright browser lacked an authenticated session |

## Remaining Risks

- A JS-enabled authenticated browser session or explicit test credentials are still required to validate tab switching, modals, dropdowns, action menus, maps, realtime behavior, and mutation feedback.
- The shared 768px dashboard chrome overflow remains outside the reconciliation shell fix.
- Because mutation actions were not submitted, server-action authorization for destructive or state-changing CRM workflows remains unverified in browser.
- The worktree was already broadly dirty before this QA pass; unrelated stabilization and pre-existing changes were not reverted.

## Recommended Next Route

`/crm/attendance`

Rationale: `/crm/today` should not be the next alignment target until authenticated JS interaction QA is available, because its queue filters, action menus, payments, booking links, and dispatch handoffs are all workflow-critical. `/crm/attendance` is the safest alternative because it is already organized around explicit operational tabs and recent session-flow repair work, making its boundaries clearer for a controlled shell alignment once a JS-enabled authenticated session is available.
