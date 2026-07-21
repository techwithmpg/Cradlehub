# CRM-RETENTION-001 — implementation report

Date: 2026-07-22
Overall result: **CONDITIONAL PASS**

The architecture, automated acceptance contracts, production build, and
authenticated CRM interaction flow pass. Owner browser QA and exact browser
heap/network/CLS/long-task measurements remain pending.

## Baseline

- Branch: `main`
- Starting commit: `a2f62ad4`
- Next.js 16.2.4; React 19.2.4; SWR 2.4.1
- Node.js 25.2.0; pnpm 10.33.2
- Baseline type check: pass
- Baseline lint: pass with one existing unrelated warning in
  `attendance-correction-service.ts`
- Baseline tests: 150 files / 1,137 tests pass
- CRM-PERF-002 source contracts retained: zero active CRM/Owner document
  navigation, zero routine active `router.refresh()`, and zero CRM/Owner
  route-level `loading.tsx`

The pre-existing dirty worktree, release-readiness fixes, Attendance work, and
dormant Manager code were preserved.

## Implementation

Selected architecture: manual retained workspace registry using React Activity.
Global Next Cache Components was not enabled.

CRM rollout (default `crm` flag):

1. Work Queue
2. Bookings
3. Schedule
4. Attendance
5. Customers

Owner rollout (available with `all`):

1. Overview
2. Reports
3. Bookings

Limits are four CRM and three Owner module instances. LRU removes the oldest
eligible clean instance. Dirty and unsaved modules are protected. Scoped SWR
keys keep data after visual eviction; authenticated-layout cleanup purges the
shared cache. A bounded unmounted element/URL/scroll descriptor provides an
immediate cache-backed remount without retaining DOM or running Effects.

State preserved by the design and tests:

- local selections and expanded/client state through the same Activity instance
- URL-backed tabs, filters, search, dates, and report ranges
- dashboard main scroll
- safe draft state, with booking-note drafts blocking eviction
- SWR fallback/current data during validation

The permanent Sidebar and Header remain in the dashboard server layout. No
pathname key or dashboard template remount was introduced.

## Lifecycle and synchronization

- Hidden module frames are `hidden`, `aria-hidden`, and `inert`.
- React Activity cleans module Effects while hidden, which disconnects existing
  Schedule/Attendance Realtime subscriptions and timer/polling Effects.
- React recreates Effects once on reveal.
- Fresh modules do not call the reactivation mutator.
- Dirty or stale modules call one existing SWR mutator and retain current data.
- Booking invalidation reuses `BOOKINGS_CHANGED_EVENT`; no second data event bus
  or route refresh was introduced.
- Identity changes remount the provider and discard retained components and SWR
  data. Logout removes the authenticated layout and in-memory cache.

## High-cost policy

- Dispatch is intentionally excluded from retained DOM and releases map/GPS
  resources through normal unmount.
- CRM Schedule is retained in the bounded Stage 1 LRU; Activity disconnects its
  Realtime channel, minute timer, and effect-owned expensive work while hidden.
- Owner Reports retains valid data and range; chart data is never removed for
  background validation.
- Owner Schedule and specialized Dispatch/map restoration are deferred.

## Prefetch

The single existing workspace prefetcher now idles the three primary retained
routes and leaves secondary/heavy routes to hover/focus. No registry import pulls
all pages into the initial JavaScript bundle.

## Automated evidence

Focused tests cover:

- first mount, second-module hide, same-instance reveal, local state retention
- Activity effect cleanup and one reconnect
- hidden/inert/aria-hidden accessibility semantics
- dirty hidden module: zero hidden refreshes, one refresh on activation
- fresh hidden module: zero activation refreshes
- scroll restoration
- CRM retained DOM plateau at four after five modules
- pure LRU ordering and oldest eligible eviction
- dirty and unsaved eviction protection
- identity-scope reset, SWR purge on workspace unmount, and explicit registry clear
- stable URL normalization without extra module instances
- bare sidebar links reopening the last canonical query state
- immediate remount of an evicted element descriptor within the LRU cap
- CRM-first/full/off rollout parsing

Static navigation contracts continue to verify no route-wide loaders, routine
route refresh, or internal document navigation.

Final gates: type check passed; lint passed with one pre-existing unrelated
unused-symbol warning; 152 files / 1,152 tests passed; production build passed.

## Performance measurements

| Measure | Evidence | Result |
| --- | --- | --- |
| Cached return | authenticated CRM browser | retained and evicted modules were visible immediately after the click completed, with zero bootstrap skeleton; Playwright click calls measured 333–348ms including automation overhead, not a production latency benchmark |
| Refresh requests | mocked retained lifecycle | fresh: 0; dirty: 1; hidden before activation: 0 |
| Sidebar/Header remount | source boundary and authenticated navigation | permanent layout remained visible across the flow; exact DOM-node identity instrumentation was not captured |
| Module remount | Activity effect probe | state preserved; hidden effect cleans and reconnects once |
| Retained count | authenticated five-module traversal + automated registry | CRM plateaued at 4; oldest Work Queue DOM was evicted, then remounted immediately and Bookings became the next eviction |
| Heap after 3/10 modules | authenticated browser required | pending |
| Hidden Realtime/polling | Activity cleanup probe + hidden frame inspection | cleanup/reconnect contract passes and hidden frames were inert/display-none; exact Network/Realtime panel count pending |
| CLS / long tasks | authenticated browser Performance panel required | pending |

No unsupported performance improvement is claimed from the automated timing
environment.

## Browser QA status

Authenticated CRM QA passed with the existing Front Desk account:

1. Work Queue `filter=exceptions` was retained through Bookings and Schedule.
2. Bookings `tab=needs-attention` and Schedule `tab=setup` reopened at their last
   canonical URLs and displayed their prior state.
3. Predictive returns showed the retained frame immediately with zero module
   bootstrap skeleton while the canonical RSC transition settled.
4. Back restored Bookings and Forward restored Schedule Setup.
5. Hidden frames had `hidden`, `inert`, and Activity-applied
   `display: none !important`; only the target frame was visible.
6. Visiting Work Queue, Bookings, Schedule, Attendance, and Customers plateaued
   at four mounted frames and evicted the oldest Work Queue instance.
7. Reopening that evicted Work Queue immediately remounted cached content with
   zero bootstrap skeleton, restored `filter=exceptions`, stayed at four frames,
   and evicted the next LRU entry.
8. The final clean reload/navigation sequence produced no new console error.
   Earlier dev-only HMR errors were diagnosed during implementation and are
   recorded in `.context/ERRORS.cmd.md`.

The authenticated account exposes Front Desk and Staff Portal only. Direct
Owner navigation was correctly redirected to `/select-workspace`, so Owner
Overview/Reports/Bookings browser QA was not fabricated and remains pending.
Exact heap, request-waterfall, Realtime-channel, CLS, and long-task captures also
remain pending; the browser run establishes bounded DOM count, not a heap claim.

## Files changed for this task

- `src/components/features/dashboard/retained-workspace-provider.tsx`
- `src/components/features/dashboard/workspace-module-registry.ts`
- `src/components/features/dashboard/workspace-retention-policy.ts`
- `src/components/features/dashboard/use-workspace-visibility.ts`
- `src/components/features/dashboard/workspace-navigation-events.ts`
- `src/components/features/dashboard/workspace-swr-cache.ts`
- CRM/Owner layouts, Sidebar, workspace prefetch configuration
- CRM/Owner Bookings, Schedule, Attendance, Reports lifecycle integrations
- typed rollout configuration and `.env.example`
- focused registry/provider/config tests
- this architecture/report and required context records

## Risks and deferred work

- Owner browser flow and exact DOM-node identity, heap, network/Realtime, CLS,
  and long-task instrumentation are pending.
- Dirty/unsaved safety may temporarily exceed the configured limit if every
  inactive entry is protected; this is deliberate and should be monitored.
- Dispatch viewport/selection retention and Owner Schedule retention require
  separate measured specialized handling.
- Work Queue and Customers receive fresh RSC payloads through canonical
  navigation; their retained instance is shown predictively while that transition
  settles. They do not introduce a duplicate client data endpoint.

Manager workspace activation was intentionally excluded and remains unchanged.

Existing CradleHub business rules, permissions, release-readiness fixes, visual
design and operational workflows were preserved.

The implementation does not keep every module mounted forever. It retains a
controlled number of recently used modules, preserves cached data for evicted
modules, pauses hidden work and refreshes only when useful.
