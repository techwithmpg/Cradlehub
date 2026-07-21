# CRM-RETENTION-001 — retained workspace architecture

Date: 2026-07-22
Status: implemented behind a staged rollout flag; authenticated CRM browser flow passed, Owner and browser performance-panel certification remain pending

## Decision

CradleHub uses a manual, workspace-scoped retained-module registry built on the
stable React 19.2.4 `Activity` boundary. Next.js `cacheComponents` remains
disabled.

Installed runtime inspected:

- Next.js 16.2.4
- React / React DOM 19.2.4
- TypeScript 5.x
- SWR 2.4.1
- Supabase JS 2.106.2 and SSR 0.10.3
- pnpm 10.33.2
- local validation runtime Node.js 25.2.0

The local Next 16.2.4 documentation confirms that Cache Components changes
uncached App Router rendering and that its navigation retention is implemented
with React Activity. Enabling that global mode would require a separate migration
of authenticated dynamic routes, cookie/session reads, uncached Supabase access,
existing route configuration, and Suspense boundaries. This task could not prove
that migration safe without expanding into public-route and authorization
semantics, so framework-level retention was rejected as too disruptive.

React Activity is used directly instead. Hidden boundaries preserve component and
DOM state while React cleans their Effects; showing a boundary recreates its
Effects. Trusted server layouts still perform all identity, role, branch, and
permission checks. No server query result is globally cached by this feature.

References:

- [Next.js Cache Components configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [React Activity](https://react.dev/reference/react/Activity)

## Layered model

### Permanent shell

The existing dashboard layout remains the permanent shell. Sidebar, header,
workspace main region, notifications/user controls, CRM Quick Booking provider,
route pending UI, and workspace layouts are not keyed by pathname. No dashboard
`template.tsx` exists.

The registry is mounted inside the CRM and Owner server layouts. It never moves
role or permission enforcement into a Client Component.

### Retained module instances

The registry keeps one mounted instance per module, not one per query-string
variation. Canonical URLs and selected stable query parameters remain restoration
metadata, while the URL continues to own shareable/history state.

| Workspace | Module | Cost | Stale interval |
| --- | --- | --- | ---: |
| CRM | Work Queue | medium | 12s |
| CRM | Bookings | medium | 25s |
| CRM | Schedule | high | 45s |
| CRM | Attendance | medium | 12s |
| CRM | Customers | medium | 120s |
| Owner | Overview | medium | 45s |
| Owner | Reports | high | 180s |
| Owner | Bookings | medium | 25s |

CRM retains at most four instances; Owner retains at most three. Least recently
used clean modules are removed first. Dirty and unsaved modules are protected.
If every inactive candidate is protected, draft safety temporarily takes
precedence over the numerical cap until a module becomes clean.

Owner Schedule and Dispatch are deliberately not in full retained-DOM rollout.

### Persistent data cache

Retained modules use SWR's stable in-memory cache with every participating key
prefixed by authenticated user, role, and branch scope. Evicting a visual
instance does not evict its SWR data. When the authenticated workspace unmounts
or its identity boundary changes, cleanup explicitly purges the shared SWR
cache. No retained payload or restoration state is written to `localStorage`,
`sessionStorage`, IndexedDB, or a global state store.

LRU eviction also keeps a bounded, unmounted React element descriptor plus URL
and scroll metadata. It has no DOM, Effects, timers, observers, or subscriptions,
but lets an evicted module remount immediately from SWR data while the canonical
App Router transition reconciles its server payload.

## Identity and isolation

The mounted-instance key is conceptually:

```text
authenticated-user : role : branch : workspace : module
```

Stable URL state is stored on the record but does not create unbounded parallel
instances. SWR keys include the authenticated scope plus their existing
date/branch/filter dimensions.

Logout or authentication failure removes the dashboard layout and therefore the
registry; its cleanup purges SWR data. A user, role, or branch prop change changes
the provider key and synchronously creates an empty scope. Server Actions and API routes continue
to authenticate every request independently, so a retained interface cannot
bypass current authorization.

## Navigation and scroll

Next.js URLs remain canonical. Sidebar links still use `Link`, and Back/Forward
still use browser history. A small navigation event announces intent before a
retained route's new RSC payload commits. If the target instance exists, it can be
revealed immediately while Next completes the canonical transition. A 10-second
guard drops a prediction if navigation does not settle.

The dashboard main container's non-sensitive `scrollTop` is stored on
deactivation and restored through `requestAnimationFrame`. Internal module
scroll remains natural because retained DOM is not destroyed.

## Lifecycle contract

`useWorkspaceModuleLifecycle()` exposes only the current module:

- active / retained
- dirty / stale / refreshing
- activation time
- unsaved-change state
- mark dirty / clean
- set refreshing / unsaved

`useWorkspaceReactivationRefresh()` starts one background reconciliation only
when the module becomes active and is dirty or beyond its stale interval. It
never clears usable data. CRM/Owner Bookings, CRM Schedule, CRM Attendance, and
Owner Reports use this contract around their existing SWR mutators.

Hidden modules are rendered under React Activity `hidden`, plus `hidden`,
`aria-hidden`, and `inert` on the module frame. This removes keyboard access
and screen-reader exposure while Activity cleans polling, timers, Realtime
channels, observers, and other Effects. On activation, effects reconnect once
and a stale/dirty module reconciles in the background. A compact “Refreshing…”
status appears without replacing current content.

The existing booking client event remains the single booking invalidation bus.
The retained workspace listener marks Work Queue, Bookings, Schedule, Owner
Overview, Owner Reports, and Owner Bookings dirty as appropriate. Active modules
can reconcile immediately; hidden modules wait for activation.

Unsaved booking-note drafts mark their module as protected. The permanent Quick
Booking provider retains its existing dedicated unsaved-change confirmation.
Unsaved module IDs are announced to the permanent sidebar as a small indicator.

## Expensive modules

- **Dispatch:** excluded from full retention. Its component unmounts normally,
  releasing map/GPS resources; specialized map viewport/selection restoration is
  deferred until measured.
- **Schedule:** retained within the CRM LRU because it is a Stage 1 workflow.
  Activity removes its Realtime subscription, timers, animation/measurement
  Effects while hidden. Date/tab state stays URL-backed and selection stays local.
- **Reports:** Owner rollout only. Cached chart data and range remain visible;
  hidden chart Effects stop with Activity and stale data reconciles quietly.
- **Owner Schedule:** deferred until the three-module Owner rollout has browser
  memory/network evidence.

## Prefetch

The existing route prefetcher remains the only route warm-up scheduler.

- CRM idle: Work Queue, Bookings, Schedule
- CRM hover/focus: Attendance, Customers, Dispatch, and lower-frequency modules
- Owner idle: Overview, Reports, Bookings
- Owner hover/focus: Schedule, Attendance configuration, Marketing, and
  lower-frequency administration

No retained page component is statically imported into the registry; App Router
route splitting and existing dynamic tab imports remain intact.

## Rollout and rollback

`NEXT_PUBLIC_RETAINED_WORKSPACES` accepts:

- `off`: ordinary route rendering; immediate rollback
- `crm`: CRM retained rollout only (safe default)
- `all`: CRM plus Owner rollout

The flag is interaction configuration, not authorization. Manager is never
matched or mounted by the registry.

## Operational limitations

Automated tests prove the bounded registry, retained instance state, scroll,
effect cleanup/reconnect, dirty versus fresh refresh behavior, accessibility
attributes, and identity reset. Authenticated CRM interaction behavior is
certified in the implementation report. Exact heap, request-waterfall, CLS, and
long-task measurements, plus the Owner flow, remain pending release evidence.
