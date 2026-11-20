# Cradle Live 2.0 local integration

## Scope freeze

Branch `stage/cradle-live-v2-integration-20261119` starts at verified local and remote main `55d08256f36efecd7ee91478381ba607966e9cd8`. The original checkout has seven unrelated tracked edits. Implement inside the dedicated worktree. Keep the established CRM route, layouts, station providers, authenticated branch selection, and operational writers.

Use the supplied PNG and the Vite Home grid, panel components and animations as presentation references. Project typed read-only board data for active dispatch journeys, open prior-date services, room allocations, finance, attendance, and ranked check-ins. The booking workflow owns service-specific assignment. Ground route geometry in the existing Routes action. Use CRM booking invalidation and bounded reconciliation. Provide honest unavailable states for incomplete sources.

Run targeted tests, scoped static checks, production build, responsive fixture browser captures, permission/overnight checks and independent review. Database-backed acceptance requires a confirmed LOCAL or TEST backend. Owner approval follows review before a local merge. No remote publication or production action is authorized.

## A. Implementation

The existing CRM route serves the integrated wallboard at [localhost:3000/crm/live-operations](http://localhost:3000/crm/live-operations). The owner authorized replacing the prior development listener on port 3000 with the stage checkout. The stage uses the repository environment and normal CRM authentication. The development fixture still requires front-desk context.

## B. Visual evidence

Chrome rendered the actual board component and repository fixture before and after implementation. The comparison used the supplied 1697 × 1281 PNG. The desktop composition follows the reference header, three operational columns and 2:1 lower band. The panels share cream surfaces, rounded borders, compact monospace labels, independent scrolling and reduced-motion styles. The fixture contains fewer records. Google Maps replaces the illustrated map, verified room capacity slots replace individually named beds, and the queue identifies check-in order. The real application retains its CRM shell. Fullscreen provides the wallboard-only composition.

[Before](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/before-1697x1281.png) · [After](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/after-1697x1281.png) · [Fullscreen](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/fullscreen.png) · [Tablet](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/after-768x1024.png) · [Mobile](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/after-390x844.png) · [Overdue treatment](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/timer.png) · [Empty](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/empty.png) · [Stale](C:/Users/eleur/.codex/visualizations/2026/11/19/01a1f18c-91b3-72b1-88e1-954d77fac3d6/stale.png).

Entrance, state-highlight, ring and route-dash styles are implemented. Browser evidence covers filters, the attention view, an elapsed deadline and fullscreen. Pixel-perfect equivalence, physical extended-display placement, animated road geometry under moving live GPS, continuous marker pulse and interpolated movement between lifecycle columns have not been demonstrated. Screenshots contain synthetic records only.

## C. Operational wiring

| Surface | Authority and display |
| --- | --- |
| Therapist queue | Effective schedule, verified check-in, exceptions, active work, blocks, dispatch commitments and the recommendation engine's check-in queue position. A service-specific assignment remains in the booking workflow. Incomplete work or dispatch evidence suppresses the featured candidate. |
| Rooms | Branch resources, capacity, allocated bookings, unexpired blocking holds and open utility turnover work. Derived spaces carry no fabricated bed IDs. |
| Active treatments and lifecycle | Cradle Flow service lines and recipient identity, order payment state, actual start, session deadline, completion, and planned duration. Earlier dated open services and prior-date services completed on this Manila date participate in the board. Local clock interpolation has no writer. |
| Dispatch | Branch-scoped active-map data, unified journey records when enabled, driver-linked GPS, authorized stop geometry and the existing Google Routes action. The client selects stable driver IDs. A pooled ETA labels the route end. The map handles Google authorization denial while keeping the driver list. |
| Staff presence | Scheduled provider roster and dated check-ins, using overnight schedule windows and review exceptions. The five counters share the same roster scope. |
| Operations alerts and activity | Existing readiness and operations issue models, service deadlines, capacity and schedule conflicts, GPS quality, unassigned dispatch and persisted CRM optimization tasks. Arrival, creation and service evidence stay within their source workflows. No optimizer evaluation is started by the board. |
| Finance | Posted customer payments and deposits by branch and business date, order-deduplicated ready-to-pay balances, daily unpaid summary, posted expenses and cash-session status. The drawer card directs reconciliation. |
| Branches and synchronization | Server-derived front-desk context. Owners use validated active branch IDs and the existing branch-selection action. The board remounts on branch change. CRM booking events trigger server reconciliation, with foreground/reconnect recovery and a 60-second foreground poll. |

## D. Verification

| Check | Executed result |
| --- | --- |
| `pnpm exec vitest run tests/components/cradle-live-map.test.tsx tests/components/cradle-live-board-feed-health.test.tsx tests/lib/cradle-live tests/lib/dispatch` | 9 suites, 36 passed. The map test uses a synthetic SDK for position, selection, marker reuse, viewport stability and auth denial. Its final callback-forwarding and cleanup assertions also passed in an individual rerun. |
| `pnpm exec vitest run tests/lib/crm/owner-front-desk-branch.test.ts tests/lib/assignments/recommendation-engine.test.ts tests/components/crm/crm-bookings-realtime-bridge.test.tsx tests/lib/cash-flow/payment-evidence.test.ts` | 20 passed, 5 failed. The same 3 realtime bridge expectations and 2 recommendation expectations failed on an isolated copy of the accepted baseline. Branch and payment-evidence suites passed. |
| `pnpm type-check` and `pnpm build --webpack` | Baseline has TS2339 in CRM layout and TS2322 in boutique categories. The stage build compiled application code, then stopped at the CRM layout type error. Build used loopback placeholders. |
| Scoped ESLint, Prettier and `git diff --check` | ESLint on the changed TypeScript/TSX paths reported zero errors and one existing unused import. Prettier checked the wallboard components, route and loader. Map correction was separately formatted and linted. |
| `node qa-build.mjs before`, `node qa-build.mjs after`, `node screens.cjs` in the local evidence directory | Isolated component browser harness with navigation and route-action boundaries stubbed. Chrome checked 1697×1281, 1440×1080, 1920×1080, 1440×900, 1280×800, 768×1024 and 390×844. No horizontal page overflow. Verified Busy filter, attention view, fullscreen, alert navigation destination, empty/stale panels and timer crossing overdue. Reference-size component DOMContentLoaded was 135 ms before and 144 ms after in one run. This is a sample rather than a throughput benchmark. |
| Connected browser | Signed-out route returned 307 to login. The signed-in user reported a denied referrer on port 3419 and a map bounds crash. After correction and the authorized switch to port 3000, the owner confirmed live Google tiles and driver cards. Local server logged an authenticated GET 200 in 15.9 s including 10 s compilation. Later GETs took 2.7–4.5 s. These are development observations. |
| PRODUCTION read-only inspection | Confirmed 2 active branches, 12 active resources, all 10 sampled operational columns and the presence of GPS, task and financial-movement sources. A record-level predicate counted 35 prior-date rows with an open start and nonterminal booking status. No records were altered or classified for repair. |

Live cross-branch switching, real map movement, reconnection convergence, two independently authenticated desks observing the same booking or payment, and new booking/attendance/payment transitions were not end-to-end verified. Docker's LOCAL engine was unavailable. Production permission covered reads. No production test writes were run.

## E. Git and review

Base `55d08256f36efecd7ee91478381ba607966e9cd8`. Reviewed feature commit `030c1e92`. Corrected implementation `e86143f17ed837d2ded1f1838a204f63dd7e89a5`. The handoff commit follows the code commit. Changed implementation and test paths:

- `src/app/(dashboard)/crm/live-operations/page.tsx`
- `src/app/(dashboard)/select-workspace/actions.ts`
- `src/components/features/cradle-live/board-dispatch.tsx`
- `src/components/features/cradle-live/board-panels.tsx`
- `src/components/features/cradle-live/cradle-live-board.module.css`
- `src/components/features/cradle-live/cradle-live-board.tsx`
- `src/components/features/dispatch/dispatch-live-map-tab.tsx`
- `src/lib/actions/dispatch-live-map-actions.ts`
- `src/lib/cradle-live/fixture.ts`
- `src/lib/cradle-live/query.ts`
- `src/lib/cradle-live/status.ts`
- `src/lib/cradle-live/types.ts`
- `src/lib/crm/cradle-flow.ts`
- `src/lib/maps/load-dispatch-map.ts`
- `src/lib/queries/bookings.ts`
- `src/lib/queries/crm-today-operational.ts`
- `tests/components/cradle-live-board-feed-health.test.tsx`
- `tests/components/cradle-live-map.test.tsx`
- `tests/lib/cradle-live/status.test.ts`

This report is the additional handoff file. Independent source review passed after correcting journey-related therapist eligibility, the pooled ETA label, roster scope, alert preservation and map failure handling. Overall acceptance is **CORRECTION REQUIRED**. Local main has not been merged. No remote push, deployment, schema change or production SQL mutation was performed.

## F. Remaining gates and rollback

Resolve the baseline build and test gates under their owning scopes, verify remaining connected scenarios and obtain separate owner approval before integration. To roll back this local trial, stop the stage development listener and relaunch the original checkout on port 3000. Production requires no rollback. The original checkout and its seven pre-existing edits were preserved.

### Concurrent local-main advancement

After the reviewed implementation, local main advanced independently to `d48da20f9d3035daedbf165abd409353bf238d2b`; remote main remained at the original base. The newer local changes include fixes for both baseline TypeScript errors, changes to the CRM realtime bridge, and updated optimization workflows. `git merge-tree --write-tree HEAD main` succeeded without conflicts. That check did not update either branch or execute the combined application. The running reviewed stage and its evidence use the original base. Reconcile and retest against the newer local main before an integration decision.

### November 20 integration verification

The owner authorized merging both remaining local branches and the six pending CRM and dashboard edits into main and pushing to origin. Integration started from `e15a2c53`. The driver O4 merge retains the hardened implementation already incorporated in `1e675fa9` and its subsequent fixes. The Cradle Live merge incorporates `6df8058c`. Station controls use the selected front-desk branch on desktop and mobile. CRM Today retains its existing schedule call and response fields when the wallboard's overnight-treatment option is off.

At code commit `28c83c4f`, the local production build passed TypeScript checking and generated 164 of 164 static pages using a loopback database URL. All 57 focused tests passed. A comparison of the 65 failing files from the initial full run against the original main tree identified two new failing tests, both corrected before publication. The final rerun of those files and the focused tests covered 78 files. All 210 remaining failing cases and four suite-load failures also failed on the original main tree with matching error headlines. Live cross-branch and multi-desk acceptance remains open.
