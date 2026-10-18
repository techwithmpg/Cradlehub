# CradleHub Web — PERF-7 CRM Staff Scope Freeze

**Date:** 2026-10-18  
**Target:** CradleHub Web — CRM Staff only  
**Program:** Web CONTROLLED STABILIZATION  
**Accepted Base / main:** `f0a6922367cba61c21dfd5935afa53f6bfd80029`  
**Planning Branch:** `stage/web-perf-7-staff-scope-freeze`  
**Status:** INSPECTION COMPLETE — SCOPE FROZEN — IMPLEMENTATION NOT AUTHORIZED

---

## A. Why PERF-7 is Staff-only

The PERF-0 roadmap lists the next remaining work after Customers as:

- Staff & Cash Flow optimization.

These are intentionally split.

CRM Staff combines roster, onboarding, service capability, staff-status, and branch-correction workflows.

CRM Cash Flow owns financial ledger, drawer, handover, payment, expense, reconciliation, and day-close behavior. It will receive a separate checkpoint because financial correctness and rollback requirements are materially different.

PERF-7 therefore targets only:

`/crm/staff`

No Cash Flow work is authorized in this checkpoint.

---

## B. Current-system truth

### Current retention state

`/crm/staff` is not registered in `workspace-retention-policy.ts`.

The route therefore does not participate in the accepted retained-module lifecycle used by Today, Bookings, Schedule, Attendance, Dispatch, and Customers.

### Current Staff tab behavior

The Staff client workspace already uses native browser history for tab switching.

Current tabs:

- Applications
- Branch Corrections
- Staff Management
- Service Assignments
- Status

This behavior is working and must be preserved.

### Current route read shape

The current route loads the complete Staff workspace on every cold visit.

Context stage:

1. `getCrmStaffPageContext()`
   - authenticated user lookup
   - staff profile lookup
   - CRM access check
2. `getFrontDeskContext()`
   - authenticated user lookup
   - CRM staff/owner branch resolution
   - role/capability resolution

This creates duplicated context/authentication resolution inside the same route request.

Primary parallel data stage:

- `getStaffByBranchWithBranches(branchId)`
- `getPendingStaffByBranch(branchId)`
- `getAllBranches()`
- `getBranchAssignableServices(branchId)`

Service-assignment stage:

If assignable services exist:

- branch active staff read
- `staff_services` assignment read

Permission-gated onboarding stage:

- submitted `staff_onboarding_requests`
- server-only privileged client
- CRM users remain branch-scoped
- owner behavior remains broader

Branch-correction stage:

- issue inbox query
- if issues exist, four additional diagnostic reads in parallel:
  - duty assignments
  - future bookings
  - temporary branch permissions
  - open attendance check-ins

Result:

A user opening any Staff tab currently pays for data needed by every Staff tab.

---

## C. Consumers and ownership

### Staff profile / management

Consumers:

- `CrmStaffWorkspace`
- `CrmStaffManagementTab`
- `StaffManagementWorkspace`
- `CrmEditStaffProfileModal`

Canonical source:

- `staff` table
- server actions/services remain authoritative

Existing client behavior:

- row/status/profile changes can patch local Staff state immediately

This working behavior must be preserved.

### Service capabilities

Consumers:

- Staff Management
- Service Assignments

Canonical source:

- branch service catalog
- `staff_services`
- `replace_staff_service_capabilities` RPC

Existing client behavior:

- saved service IDs patch only the edited staff assignment rows

The client patch is presentation state only. Server/RPC remains authoritative.

### Applications / onboarding

Consumer:

- `CrmStaffApplicationsTab`
- `OnboardingReviewList`

Canonical source:

- `staff_onboarding_requests`

Authorization boundary:

- permission gated
- privileged server client is used only after role/branch policy is resolved
- CRM cannot approve management roles
- CRM cannot approve another branch's operational staff

PERF-7 must not move onboarding authorization or privileged reads into browser authority.

### Branch Corrections

Consumers:

- `CrmStaffBranchCorrectionsTab`
- branch resolution dialogs/actions

Canonical source:

- `staff_branch_assignment_issues`
- diagnostic schedule/booking/temporary-access/attendance reads
- server-side resolver RPCs

Side effects may include:

- branch correction
- schedule/booking review requirements
- attendance consequences
- workflow tasks
- notifications

PERF-7 must not simplify or bypass this contract.

---

## D. Current mutation side effects

Existing Staff mutations already have local presentation patches in several flows.

They also preserve broad server-side revalidation and cache invalidation for other consumers.

Examples include:

- profile update
- active/inactive toggle
- service capability replacement
- onboarding approval/rejection
- branch-correction resolution

Downstream consumers include combinations of:

- CRM Staff
- CRM Schedule
- CRM Today
- CRM Services / Setup
- Owner Staff
- Manager Staff
- booking/public service surfaces
- attendance / live operations

These cross-module side effects must not be deleted merely to make CRM Staff faster.

PERF-7 does not authorize broad revalidation cleanup.

---

## E. Authorization boundaries that must remain unchanged

1. Branch authority remains server-derived.
2. CRM Staff must never accept browser-supplied authoritative branch identity.
3. Privileged onboarding reads remain server-only.
4. Branch-correction reads/resolution remain server-only.
5. Service-capability mutation remains branch/role scoped.
6. Staff profile mutation continues to block cross-branch edits.
7. Sensitive/management-role protections remain unchanged.
8. RLS/service-role boundaries must not be weakened.
9. No Desktop or local cache may become Staff authorization authority.

---

## F. Existing tests that form part of the safety baseline

Relevant existing coverage includes:

- CRM Staff interaction-state retention
- onboarding approval branch safety
- service assignment state replacement
- service-provider exclusions
- branch-correction rendering/contracts
- staff mutation service
- staff onboarding service
- branch correction policy/resolution
- staff schedule write/exception behavior
- attendance staff safety tests

PERF-7 must add focused retained/generation tests without replacing these safety suites.

---

## G. PERF-7 frozen implementation scope

PERF-7 is limited to **CRM Staff retained workspace and canonical reconciliation**.

Authorized implementation goals after owner approval:

1. Register a new retained module:
   - `crm-staff`
   - route: `/crm/staff`
   - stable search state: `tab`
   - initial cost classification: high
   - stale time chosen conservatively and documented

2. Wrap CRM Staff in the accepted retained workspace lifecycle.

3. Define a canonical `CrmStaffWorkspaceData` contract that represents the current server payload without changing business rules.

4. Create one shared server loader used by:
   - initial Server Component render
   - generation-aware client reconciliation

5. Add a CRM Staff server refresh action that derives:
   - authenticated user
   - active operational branch
   - role/capabilities
   server-side.

   The client may not supply branch authority.

6. Use:
   `useGenerationAwareWorkspaceSWR("crm-staff", ...)`

7. Preserve the initial server fallback with zero duplicate immediate fetch.

8. Preserve existing Staff tab switching through native browser history.

9. Preserve existing client interaction state:
   - active Staff sub-tab
   - Staff Management search/filter state
   - selected staff preview
   - expanded branch groups
   - modal/sheet state where safe during retained navigation

10. Hidden Staff behavior:
    - invalidation marks generation dirty
    - zero canonical network reads while hidden
    - focus/reconnect while hidden performs zero Staff reads
    - reveal retained Staff immediately
    - reconcile only when active

11. Stale responses must not overwrite newer Staff generations.

12. Preserve existing local row/service-assignment patches.

13. Failed canonical refresh must preserve the last validated Staff workspace and expose non-destructive retry feedback.

14. Add focused tests for:
    - zero duplicate initial fetch
    - hidden zero-read rule
    - dirty reveal reconciliation
    - stale response rejection
    - tab/search/selection preservation
    - branch/server authority
    - permission-gated onboarding data
    - branch-correction payload preservation

---

## H. Explicitly NOT authorized in PERF-7

- CRM Cash Flow
- Owner Staff
- Manager Staff redesign
- Staff Portal / PWA
- Attendance architecture changes
- Schedule architecture changes
- onboarding business-rule changes
- branch-correction workflow redesign
- role/permission redesign
- service assignment business-rule redesign
- database schema
- migrations
- RLS
- production operations
- broad UI redesign
- deletion of existing revalidation paths
- new `staff.changed` global event contract
- per-tab lazy query decomposition
- query/cache rewrites purely from assumption
- PERF-8+

---

## I. Deferred follow-on Staff optimization

The inspection confirms a separate optimization opportunity:

The route preloads data for all five tabs even when only one tab is visible.

That includes privileged/heavy datasets such as:

- onboarding applications
- service provider assignments
- branch correction diagnostics

This is a valid future optimization, but it is **not** included in the first retained Staff correction because tab-aware lazy loading changes data ownership and authorization timing.

After PERF-7 proves retained/generation behavior, a separately reviewed follow-up may consider:

- per-tab canonical reads
- lightweight tab counts
- lazy loading of privileged/heavy panels
- duplicated context/auth resolution removal
- query-count reduction

No such query decomposition is authorized by this freeze.

---

## J. Performance evidence classification

### VERIFIED REPOSITORY FACT

- CRM Staff is currently unretained.
- Staff tabs already switch client-side through native history.
- the server route preloads all Staff tab datasets.
- service assignment, onboarding, and branch-correction reads have different authorization/side-effect boundaries.
- local Staff row/service assignment patches already exist.

### RECOMMENDATION

Use retained/generation-aware whole-workspace reconciliation first, preserving the current aggregate Staff contract.

### PROJECT DECISION — PENDING OWNER APPROVAL

Implement the frozen PERF-7 scope above on a new implementation branch from accepted main.

No executable implementation is authorized by this document.

---

## K. Rollback / safety

Current branch is planning/documentation only.

No executable code, migration, RLS, database, or production state is changed.

Future PERF-7 implementation remains Web-code-only unless a separately authorized database requirement is discovered.

If implementation reveals a need to change Staff authorization, privileged query scope, branch correction semantics, or database schema:

**STOP — CORRECTION REQUIRED / NEW AUTHORIZATION REQUIRED.**

---

## L. Gate

**SCOPE FROZEN — STOP FOR OWNER IMPLEMENTATION AUTHORIZATION**

Do not start Cash Flow.

Do not start Owner conversions.

Do not begin PERF-8.
