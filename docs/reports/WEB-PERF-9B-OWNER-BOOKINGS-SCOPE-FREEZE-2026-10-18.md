# CradleHub Web — PERF-9B Owner Bookings Inspection and Scope Freeze

**Date:** 2026-10-18  
**Track:** Web CONTROLLED STABILIZATION  
**Target:** Owner `/owner/bookings` only  
**Accepted base / main:** `cd108714c9f1da2d493825b9b35a680888a34ef1` (merged PERF-9A)  
**Planning branch:** `stage/web-perf-9b-owner-bookings-scope-freeze`  
**Status:** REPOSITORY INSPECTION AND PROPOSED SCOPE FREEZE — **NO PERF-9B IMPLEMENTATION AUTHORIZATION YET**

## A. Stage authorization and exclusions

The owner requested continuing the current performance program after PERF-9A merge. This authorizes **inspection and scope planning**, not changing executable Owner Bookings code, database, rollout flags, deployment configuration or production records.

PERF-9B may only be implemented after an explicit subsequent owner implementation authorization. PERF-9C Reports, PERF-9D Owner retention activation, PERF-10 loading/dialog prewarming and all Member PWA code remain outside this stage.

### Separately agreed future checkpoint — CP-PWA-01

The owner agreed to complete the **current Web administrative performance program** first, through its FINAL acceptance. **CP-PWA-01 — Member PWA Performance Optimization** follows that certification. It begins with Member PWA diagnostics and measurement before startup/session/navigation/API/cache corrections; it is not authorized to run concurrently with PERF-9B. This is a scheduling checkpoint, **not** a finding that the Member PWA is already optimized, and **not** adoption of Owner or CRM cache behavior for the Member PWA.

## B. Repository-inspected current system

| Concern | Existing source and behavior | Constraint |
|---|---|---|
| Server route | `src/app/(dashboard)/owner/bookings/page.tsx` | Owner login/staff-role guard; renders `RetainedWorkspaceModule("owner-bookings")` |
| Canonical list | `getOwnerWorkspaceBookingsAction` in `src/app/(dashboard)/owner/bookings/actions.ts` | Checks Owner identity and validates branch against server-read active branch list before `getAllBookings` |
| Query | `getAllBookings` in `src/lib/queries/bookings.ts` | Supabase-cookie client, RLS, server filters date/branch/status/type, current descending date/start-time ordering and 500-row cap |
| Client read | `src/components/features/bookings/owner-bookings-view.tsx` | Ordinary scope-keyed SWR, `keepPreviousData`, auto-fetch on changed key, legacy `useWorkspaceReactivationRefresh` |
| Shared UX | `BookingsWorkspace` and `BookingsTable` | GET filter form; local workflow tab, search, selection, pagination, status/payment/service modal flows; shared CRM/Owner consumers |
| Mutation owners | `ownerUpdateBookingStatusAction`, `ownerUpdateBookingPaymentAction`; shared booking/service actions | Existing Owner authorization, payment gate, idempotency/transaction writer, bookkeeping side effects, toast/error feedback preserved |
| Runtime scope | `OwnerRuntimeScope`, `resolveOwnerOperationalScope` | `owner:all-branches` or `owner:branch:<server-listed-active-id>`; invalid explicit selection = unavailable |
| Retained registration | `workspace-retention-policy.ts` | Exact `/owner/bookings`, module `owner-bookings`, current TTL 25s, medium cost; Owner retention rollout OFF |
| Semantic events | `workspace-domain-events.ts`, `BOOKINGS_CHANGED_EVENT` | Owner bookings already invalidates for relevant booking/assignment/payment/reschedule/customer/schedule events; legacy broad event remains |
| Existing safety tests | `tests/lib/owner/operational-scope*.test.ts`, `tests/components/dashboard/owner-runtime-scope.test.tsx`, shared bookings and payment tests | Main→SM→Main isolation; denied scope cannot silently broaden at the server action |

### Source-of-truth / ownership contract

`/owner/bookings` data comes from **authenticated server-side Supabase queries**, not local/browser storage. Owner operational scope partitions runtime state, but never grants access. Server validates Owner role and branch membership on **every** list action; existing booking, payment and service mutations remain owned by their established server actions and atomic transaction/RPC boundaries. RLS remains in force.

The Owner can intentionally query all branches by omitting `branch`. An explicit invalid, inactive, duplicated or unlisted branch must **never** silently expand into an all-branch query or reuse another scope's data.

## C. Concrete observed integration hazards

### C1. Denied/failed list masquerades as zero results

`OwnerBookingsPage` currently converts any `getOwnerWorkspaceBookingsAction` error to `[]`. The action correctly refuses unavailable branches without querying bookings; the page nevertheless renders an ordinary empty Bookings UI. This can mislead staff into believing that no bookings exist and conceals an unavailable scope or failed read.

**Proposed bounded correction within PERF-9B:** preserve a typed, explicit unavailable/error state; never display unrelated cached rows or an ordinary zero-results state for a denied or failed query. Do not weaken the server action's fail-closed behavior.

### C2. Scoped SWR still predates generation-aware adapter

`OwnerBookingsView` uses ordinary SWR plus `useWorkspaceReactivationRefresh`, with `keepPreviousData: true`. Converting to generation-aware SWR must prevent stale response and wrong-filter data on changed `date/branch/status/type`, including a new branch scope. **OwnerRuntimeScope** already partitions branch identities but cannot alone verify the data request's finer filters.

### C3. Dual reconciliation paths risk duplicate fetches

The component listens to `BOOKINGS_CHANGED_EVENT` and invokes its own SWR `mutate()`. The accepted retention provider also maps booking events to generation invalidation when enabled. Replacing ordinary SWR must avoid one event causing a legacy direct refetch **and** a generation refetch, while keeping CRM/other consumer notification behavior and one update after successful Owner actions. Failed Owner actions must not signal retained reconciliation.

### C4. URL state is mixed across shared Bookings components

The server action's canonical query dimensions are **date, branch, status, type**. `search` is currently client-side presentation filtering. `BookingsWorkspace` maintains tab choice locally, sets `tab` in the URL using native `history.replaceState`, and GET submits filters. `BookingsTable` also recognizes `bookingId` and `highlight`, and `openRoomAssignment` is a transactional modal trigger.

Owner retention metadata currently includes `date, branch, status, type, search, bookingId` but omits `tab`. Owner page does not pass `initialTab` or `initialSelectedId`; shared component defaults its tab/selection locally. Thus restoration/back/forward/selection can disagree with the active URL if retained or remounted.

**Freeze rule:** preserve existing GET filter and tab actions, avoid broad shared Bookings UI rewrite. Restore only stable, deliberately verified state; **never replay transactional modal triggers**. Before changing `bookingId` restoration or adding `tab`, inspect dependent deep links and prove selected booking does not leak between branch identities. Do not claim current URL behavior is already correct without browser tests.

### C5. Date/query and visible-branch assumptions

The page defaults `date` using UTC `new Date().toISOString().split("T")[0]`. No branch-local date correction is authorized by the performance stage without diagnosis of its effect on existing booking queries. Current filter options use the queried branch list, while server authority uses the active subset; do not make a disabled branch appear safely queryable.

`getAllBookings` has a 500-row cap, existing sorting, and compatibility select fallbacks. Do **not** alter cap, query structure, indexes, pagination or data schema speculatively without measured evidence and separate authorization.

### C6. Shared selected-booking behavior and money boundaries

The shared table supports status changes, service-start/complete flows, room assignment, rescheduling, customer follow-up, payment actions, and panel state. It currently has a bounded session-start optimistic UI override. PERF-9B must not expand this into optimistic **financial** amounts/payment state or change session, booking, resource, dispatch or financial mutation contracts. Preserve existing revalidation for Owner Overview, Owner Reports, CRM/cash-flow and other consumers until equivalent behavior is proved for each.

## D. Proposed PERF-9B implementation contract (approval required)

1. **Only** `/owner/bookings` and its Owner-specific read/lifecycle integration.
2. Preserve canonical Owner server/role authorization and validated operational branch identity. No client-chosen branch authority.
3. Provide a shared authoritative Owner bookings load contract for initial SSR and client retained reconciliation, or explicitly reuse the existing server action without duplicating business rules. The implementation must prove first-render and refresh contract parity.
4. Normalize the **query** key using `date, branch, status, type`, with clear distinction between absent branch (all) and validated branch; rejected branch must fail closed.
5. Reuse `useGenerationAwareWorkspaceSWR("owner-bookings", ...)` rather than inventing a new cache engine.
6. Exactly one canonical aggregate list reconciliation per invalidation/active reveal, never background fetching of hidden Owner bookings.
7. Zero duplicate initial fetch where the SSR fallback exactly matches the current query key.
8. Reject stale responses on filter changes, branch scope switches, and newer invalidation generations.
9. Preserve last validated **matching-scope/query** rows on transport error; show an explicit retry/error state, **not** another branch's previous list or a denied-branch empty state.
10. Mutation success → one compatible Owner bookings invalidation/reconciliation signal; failure → zero. Preserve external legacy event consumers and downstream revalidation, avoid duplicate reads for the same event.
11. Preserve the existing shared booking actions, selected panel and notification behavior; no unapproved booking/payment/service mutation refactor.
12. Preserve URL GET forms, owner `branch` parameter, all-branches semantics and browser back/forward. Decide stable `tab`, `search`, and `bookingId` restoration based on tests; exclude `openRoomAssignment`, `highlight` if transactional and any one-time modal operation from retained restoration.
13. Keep Owner retention **OFF** during PERF-9B. Do not modify `NEXT_PUBLIC_RETAINED_WORKSPACES` or other deployment toggles.
14. Do not change Owner Reports/Overview implementation, CRM routes, global event architecture, database, RLS, payment RPCs, analytics formulas, or new UI features.
15. Preserve predictable appearance of empty (legitimate), loading, stale-refresh, denied, and failed-list states.

## E. Targeted tests and quality gates

Before code changes, compare with accepted main and freeze exact impacted files. After approval and implementation:

- **Server:** Owner role before list; branch validation on every request; Main/SM/all semantics; inactive/invalid/duplicate branch rejects; no query on denied; explicit error state on the page.
- **Lifecycle:** SSR no duplicate read; hidden zero reads/focus/reconnect; dirty active once; clean stale active once; older generation and old filters discarded; failed fetch retains only same-query validated rows; retry canonical.
- **Navigation:** GET date/branch/status/type/search; history tab switch; back/forward; branch A → B → A isolation; explicit all→branch→all; booking ID and modal/deep-link semantics.
- **Mutations:** confirmed status/payment/service change exactly one retained read and preserved downstream consumers; failed or denied mutation no retained reconciliation; no optimistic paid/amount/ledger truth.
- **Regression:** PERF-1B Owner scope isolation; PERF-9A Overview; PERF-1–8 CRM suites; shared Bookings/quick booking/payment and Owner reporting/reconciliation.
- **Repository gates:** targeted Vitest; `pnpm type-check`; changed-file ESLint; `pnpm build`; `git diff --check`; full Vitest suite with accepted-main comparison for any failure.
- **Authenticated browser evidence before Owner activation (PERF-9D):** Main → SM → Main, filters, long-lived panel, logout/role change, stale reveal, network counters, no wrong-branch rows, latency baselines and after metrics.

No test or browser/native/database/production check is claimed executed by this documentation-only stage.

## F. Performance measurement baseline still required

**No authenticated runtime/network measurement was performed during PERF-9B planning.** Before changing queries or caching strategy, capture cold `/owner/bookings` navigation latency, return-navigation time, read count, duplicate fetch count, filter-change latency, payload size and branch transition correctness under representative data. Do not claim native-like speed without before/after evidence.

## G. Version-sensitive official framework reference

The current official Next.js App Router navigation guide documents native `pushState`/`replaceState` integration with `useSearchParams` and client-side navigation; this is **framework guidance**, not evidence that CradleHub's actual filter or tab transitions pass. Source: https://nextjs.org/docs/app/getting-started/linking-and-navigating (reviewed 2026-10-18).

## H. Impact, rollback and governance

**Implementation impact:** not yet authorized. Potential future changes are confined to Owner bookings read lifecycle and bounded explicit-error/URL-state corrections. Rollback is abandonment of the implementation branch before merge or a separately authorized revert; existing Owner retention is OFF throughout implementation, and live activation is reserved for PERF-9D.

### Evidence classification

**VERIFIED REPOSITORY FACT:** sources, query keys, error→empty behavior, Owner role/branch checks, current SWR/legacy listener, retention registration and CRM-only default flag.

**RECOMMENDATION:** generation-aware Owner read lifecycle; fail-visible denied query; one reconciliation per successful event; bounded URL-state/deep-link repair.

**PROJECT DECISION — AWAITING OWNER AUTHORIZATION:** PERF-9B implementation scope and any UI-visible correction. CP-PWA-01 order is an owner-stated future checkpoint, not a release activation.

No historical migration is replayed or marked applied; no local/desktop database is treated as production authority.

## I. Gate

**SCOPE FROZEN FOR REVIEW — PERF-9B IMPLEMENTATION NOT AUTHORIZED.**

- Do not modify executable Owner Bookings code yet.
- Do not merge or deploy the scope document solely because it exists.
- Do not activate Owner retention.
- Do not begin PERF-9C, PERF-9D, PERF-10 or CP-PWA-01 implementation.
- Next action: obtain explicit owner authorization for the bounded PERF-9B implementation.
