# CradleHub Web — PERF-9 Owner Operational Performance Scope Freeze

**Date:** 2026-10-18  
**Target:** CradleHub Web — Owner operational workspace only  
**Program:** Web CONTROLLED STABILIZATION  
**Accepted Base / main:** `70b4f3004e77989329a2310e5e82fa37a417555f`  
**Planning Branch:** `stage/web-perf-9-owner-operational-scope-freeze`  
**Status:** INSPECTION COMPLETE — ROADMAP FROZEN — PERF-9A IMPLEMENTATION NOT AUTHORIZED

---

## A. Executive decision

The remaining Owner performance block will **not** be implemented as one broad conversion.

The safe sequence is:

1. **PERF-9A — Owner Overview**
2. **PERF-9B — Owner Bookings**
3. **PERF-9C — Owner Reports**
4. **PERF-9D — Owner retention activation / authenticated certification**

Owner retention remains **OFF** throughout PERF-9A, PERF-9B and PERF-9C.

Only PERF-9D may consider changing the deployment rollout from CRM-only to Owner-enabled, and that requires:
- completed module conversions;
- authenticated browser evidence;
- Main → SM → Main scope verification;
- no cross-scope cache reuse;
- owner approval for activation.

This preserves the accepted workflow:

inspect → document → decide → freeze → authorize → implement → test → evidence → review → approve → merge.

---

## B. Current Owner retention state

The repository already contains Owner retention infrastructure from PERF-1B.

### VERIFIED REPOSITORY FACT

`OwnerRuntimeScope`:
- derives canonical Owner operational scope from the route;
- keys SWR/runtime state by user + role + canonical Owner scope;
- destroys the old scope cache when scope identity changes;
- prevents Main/SM/all-branches/global cache reuse;
- passes the canonical identity into `RetainedWorkspaceProvider`.

Owner retention is still controlled by:

`NEXT_PUBLIC_RETAINED_WORKSPACES`

Current default behavior is CRM-only.

`isRetainedWorkspaceEnabled("owner")` is false unless rollout is explicitly `all`.

No repository change in PERF-9 planning enables Owner retention.

---

## C. Existing Owner activation safety baseline from PERF-1B

PERF-1B established repository-tested Owner scope identities:

- `owner:branch:<validated-id>`
- `owner:all-branches`
- `owner:global`
- `owner:unavailable`

The server remains responsible for:
- Owner workspace access;
- active branch visibility;
- branch validation;
- RLS;
- selected Front Desk branch where applicable.

Main → SM destroys the Main runtime and creates an isolated SM runtime.

A later Main return uses a fresh Main scope rather than restoring an old branch cache.

PERF-9 must not weaken this isolation.

---

## D. Why only Overview, Bookings and Reports are in this block

The accepted performance diagnostics explicitly named:

- Owner Overview;
- Owner Bookings;
- Owner Reports;

as the Owner operational conversion set after Staff and Cash Flow optimization.

Other Owner routes remain outside PERF-9A–9C:

- Schedule
- Attendance
- Dispatch
- Cash Flow
- Staff
- Services
- Branches
- Payroll
- Marketing
- Notifications
- Spaces & Rules

Those routes retain their accepted behavior.

No broad Owner UI redesign is authorized.

---

# PERF-9A — OWNER OVERVIEW

## E. Current Owner Overview truth

Route:

`/owner`

Canonical scope:

**all-branches aggregate**

The route does not use a branch selector as authority.

The page is already wrapped in:

`<RetainedWorkspaceModule moduleId="owner-overview">`

but this wrapper is inert while Owner retention is disabled.

### Current canonical sources

`getOwnerOverviewDashboardData()` currently authenticates Owner access and aggregates multiple server-side sources, including:

- owner profile;
- branches;
- staff;
- recent bookings;
- schedules;
- shift check-ins;
- Owner workspace notifications;
- workflow tasks;
- payroll dashboard data.

It derives:

- KPI cards;
- today glance;
- branch performance;
- revenue trend;
- staff snapshot;
- payroll snapshot;
- attention/pending actions.

The page separately loads:

`getRecentAttendanceScanFeed(...)`

with a bounded fallback.

### Current performance characteristic

A cold Owner Overview visit executes a heavy aggregate server load.

Because Owner retention is OFF, leaving and returning to Overview performs a cold page lifecycle again.

There is no generation-aware Owner Overview data hook yet.

---

## F. Latent retention-policy mismatch found during inspection

Current policy for `owner-overview` records stable search parameters:

- `branch`
- `date`

However, PERF-1B established that `/owner` is an **all-branches aggregate** and does not use those URL parameters as operational scope.

### RECOMMENDATION

PERF-9A should change Owner Overview stable restoration state to **no operational query parameters**.

This prevents meaningless `branch` or `date` query state from being remembered/restored for an all-branches Overview.

This is a retention correctness correction, not a new feature.

---

## G. PERF-9A frozen implementation scope

After owner implementation approval, PERF-9A may:

1. Preserve `/owner` as an all-branches aggregate.
2. Keep `owner-overview` registered as the retained module.
3. Correct its stable restoration params to none.
4. Introduce one shared authoritative Owner Overview loader for:
   - initial Server Component render;
   - retained reconciliation.
5. Aggregate both:
   - dashboard data;
   - recent attendance scan feed;
   into one canonical Owner Overview payload.
6. Preserve the existing Owner access redirect behavior.
7. Add one Owner Overview refresh server action with **no client-supplied branch authority**.
8. Use the accepted generation-aware adapter:
   `useGenerationAwareWorkspaceSWR("owner-overview", ...)`
9. Preserve zero duplicate initial fetch.
10. Preserve zero hidden reads.
11. Reconcile dirty retained Overview only while active.
12. Add clean-stale reactivation reconciliation.
13. Reject stale generation responses.
14. Preserve last validated Owner Overview payload after refresh failure.
15. Preserve the existing partial dashboard fallback/error presentation.
16. Preserve attendance feed fallback behavior.
17. Use existing Owner domain-event invalidations where already mapped.
18. Do **not** introduce a new broad Owner event model in PERF-9A.
19. Add focused lifecycle and authorization tests.
20. Keep Owner retention rollout OFF.

### No optimistic Owner business data

PERF-9A must not invent or locally estimate:
- revenue;
- bookings;
- payroll;
- staff counts;
- branch KPIs;
- pending actions;
- attendance state.

Owner Overview remains server-authoritative.

---

## H. PERF-9A explicitly NOT authorized

- Owner retention activation;
- deployment flag change;
- Owner Bookings conversion;
- Owner Reports conversion;
- Owner Schedule/Attendance/Dispatch/Cash Flow conversion;
- query-schema rewrites;
- database changes;
- migrations;
- RLS changes;
- analytics formula changes;
- payroll logic changes;
- new Owner dashboard features;
- UI redesign;
- new global domain events;
- speculative cache layers.

---

# PERF-9B — OWNER BOOKINGS

## I. Current Owner Bookings truth

Route:

`/owner/bookings`

Operational scope:

- missing branch = all branches;
- validated `branch` = one branch;
- invalid branch must not broaden to all.

Current page already uses:
- `RetainedWorkspaceModule("owner-bookings")`;
- Owner server authorization;
- active branch validation in the server action;
- scoped SWR keys;
- client-local search/presentation state;
- existing booking mutation actions.

Current `OwnerBookingsView` uses ordinary SWR plus `useWorkspaceReactivationRefresh`, not the accepted generation-aware adapter.

### PERF-9B target

Convert the existing Owner Bookings SWR lifecycle to the generation-aware model while preserving:
- all-branches vs branch-specific scope identity;
- server branch validation;
- booking mutations;
- existing filter/search behavior;
- existing booking events;
- no cross-branch cache reuse.

PERF-9B will be frozen separately after PERF-9A is merged.

---

# PERF-9C — OWNER REPORTS

## J. Current Owner Reports truth

Route:

`/owner/reports`

Operational scope:
- explicit or missing `branchId`;
- `all` means aggregate;
- invalid branch is fail-closed.

Current Reports already use scoped SWR for:
- canonical report data;
- external read-only Master Sheet evidence.

PERF-1B already prevents stale Main data from appearing as SM/all data during native-history scope changes.

### PERF-9C special requirement

Owner Reports must preserve the mathematical separation between:
- canonical CradleHub report totals;
- external read-only Master Sheet evidence.

PERF-9C must not merge external evidence into canonical financial totals.

Before conversion, PERF-9C must decide whether its two reads become:
- one aggregate retained reconciliation contract; or
- one canonical generation plus separately bounded external evidence refresh.

That decision is deferred to the PERF-9C scope freeze.

---

# PERF-9D — OWNER RETENTION ACTIVATION

## K. Activation remains separate from implementation

Even when PERF-9A–9C are merged, Owner retention remains OFF until PERF-9D.

Activation must verify at minimum:

1. Owner Overview warm return.
2. Owner Bookings warm return.
3. Owner Reports warm return.
4. Main → SM → Main scope changes.
5. All-branches → branch → all-branches changes.
6. zero old-branch DOM/cache reuse.
7. late-response rejection.
8. browser back/forward URL correctness.
9. logout / role / scope cleanup.
10. retained LRU behavior.
11. authenticated browser evidence.
12. rollback via rollout flag.
13. explicit owner activation approval.

Only then may rollout consider:

`NEXT_PUBLIC_RETAINED_WORKSPACES=all`

No activation is part of PERF-9A–9C.

---

## L. Current recommended performance roadmap

Completed:

- PERF-0 diagnostics
- PERF-1A retained foundation
- PERF-1B Owner scope safety
- PERF-2 CRM Today
- PERF-3 CRM Bookings
- PERF-4 CRM Schedule + Attendance
- PERF-5 CRM Dispatch
- PERF-6 CRM Customers
- PERF-7 CRM Staff
- PERF-8 CRM Cash Flow

Next:

- **PERF-9A Owner Overview**
- PERF-9B Owner Bookings
- PERF-9C Owner Reports
- PERF-9D Owner retention activation/certification
- PERF-10 Loading UX & dialog prewarming
- FINAL performance/release certification

---

## M. Current official Next.js guidance consulted

Current official Next.js documentation continues to support:
- URL/search parameters as client-visible navigation state;
- client-side navigation without full browser reload;
- layout-level state preservation during App Router navigation.

This is supporting framework guidance only.

### PROJECT DECISION

CradleHub will continue using its already accepted retained-workspace/generation architecture rather than redesigning around a new routing mechanism.

The project decision remains governed by repository tests and Owner approval.

---

## N. Evidence classification

### VERIFIED REPOSITORY FACT

- Owner scope isolation infrastructure exists.
- Owner retention remains OFF by default.
- Owner Overview, Bookings and Reports already have retained module descriptors/wrappers.
- Overview is not generation-aware.
- Bookings and Reports use ordinary scoped SWR, not the generation-aware adapter.
- Overview is all-branches aggregate.
- Bookings supports all-branches or validated branch scope.
- Reports supports all-branches or validated branch scope.
- Owner Overview policy currently retains meaningless `branch` and `date` search state.

### RECOMMENDATION

Convert one Owner module at a time and activate retention only after all three pass.

### PROJECT DECISION — PENDING OWNER APPROVAL

PERF-9A will convert Owner Overview only.

---

## O. Database / production safety

This planning branch is documentation-only.

No:
- schema changes;
- migrations;
- RLS changes;
- database writes;
- production mutations;
- rollout flags;
- deployments;
- Owner retention activation.

---

## P. Gate

**PERF-9 OWNER ROADMAP FROZEN**

**PERF-9A OWNER OVERVIEW — IMPLEMENTATION NOT YET AUTHORIZED**

Do not begin PERF-9B.

Do not begin PERF-9C.

Do not activate Owner retention.

Do not begin PERF-10.

STOP FOR OWNER PERF-9A IMPLEMENTATION AUTHORIZATION.
