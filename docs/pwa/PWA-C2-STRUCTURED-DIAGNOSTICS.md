# CradleHub Staff PWA — PWA-C2 Structured Diagnostics

## Review boundary

- Program: **OWNER APPROVED — CradleHub Staff PWA**.
- Authorized stage: **PWA-C2 — Structured Diagnostics** only.
- Branch: `stage/pwa-c2-structured-diagnostics`.
- Accepted starting main: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`.
- Diagnostic head at preparation: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`.
- PWA-C1 was accepted at the starting main commit. PWA-C3 and all later stages remain unauthorized.

This artifact is a read-only repository diagnostic. It records implementation seams that must be resolved or deliberately accepted before a later scope or design stage. It does not change runtime code, tests, dependencies, assets, SQL, migrations, schema, Auth, RLS, Storage policy, environment settings, deployment configuration, or production data.

## Evidence boundary

The following evidence classes are used throughout this report:

- **VERIFIED REPOSITORY FACT** — directly inspected source, configuration, migration text, or Git state at the stated baseline. This does not establish runtime correctness.
- **LOCAL TEST EVIDENCE** — an exact isolated local command and result. Mocks and source contracts do not certify a database, deployment, browser, or device.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE** — a production statement preserved from repository records and attributed to that record. It is not a current live verification.
- **UNKNOWN / NOT VERIFIED** — the target or evidence needed to make the claim was not available.

No database target was identified for this stage. No Supabase connection, migration command, authenticated application session, production browsing, or production mutation was performed. The audit workflow's visual evidence requirement is therefore blocked: no browser screenshots are included because the backend target is unknown and attendance reads can invoke a write-capable recalculation path. This is an evidence limitation, not a claim about the user experience in production.

## Diagnostic method and scope

The review traced role entry points, navigation consumers, server actions, route handlers, map/location consumers, service and attendance transitions, worker registration, notification boundaries, and existing tests. For each seam, the review recorded the source of truth, ownership, side effects, authorization boundary, known consumer, and the safe follow-up stage. The review deliberately did not invent endpoint contracts, eligibility rules, polling targets, device guarantees, or acceptance thresholds reserved for PWA-C3/C4.

## Findings

| ID | Severity | Area | Status | Verified repository evidence | Impact and owner boundary | Safe follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| PWA-C2-001 | P1 | Business date and cross-surface data | OPEN | **VERIFIED REPOSITORY FACT:** `src/lib/actions/live-ops-actions.ts` derives `today` with `new Date().toISOString().split("T")[0]`. Staff/Driver pages and actions contain the same UTC-day pattern, while CRM dispatch, live operations, today, schedule and booking pages use `getBranchBusinessDate()`. | Staff/Driver and CRM consumers can select different business dates around a branch midnight. The source-of-truth decision and branch-date ownership are split across surfaces. Runtime impact and the affected production timezone are **UNKNOWN / NOT VERIFIED**. | PWA-C3 scope freeze; PWA-C4 contract and acceptance criteria. Do not normalize dates during C2. |
| PWA-C2-002 | P1 | Attendance writes and reads | OPEN | **VERIFIED REPOSITORY FACT:** `getMyAttendanceData` loads attendance data and, for an open row, can use the admin client to invoke `recalculateAttendanceClockOutPolicy`. Portal clock-out uses `commit_attendance_portal_clock_out`; `src/lib/actions/staff-checkins.ts` also performs direct check-in/checkout writes and stamps checkout with the action runtime timestamp. | Multiple mutation paths have different authorization and timestamp/policy behavior. A page read is not necessarily mutation-free. Attendance remains server-authoritative, but the canonical command path and side-effect boundary are not consolidated in the repository. | PWA-C3 scope freeze; PWA-C5/C7 only after an approved contract. Preserve every path until consumers and safe replacement are proven. |
| PWA-C2-003 | P1 | Driver map and location lifecycle | OPEN | **VERIFIED REPOSITORY FACT:** `DriverRouteMapPlaceholder` is rendered by the Driver Route Map page. `driver-trip-list.tsx` requests a single `navigator.geolocation.getCurrentPosition` and calls `recordStaffLocationSnapshotAction`; no `watchPosition` lifecycle was found. CRM Live Operations polls `getActiveTripsForOpsMap` every 30 seconds. | The approved driver direction requires explicit active-trip lifecycle and later proof of CRM map communication. The repository currently has a placeholder route map, a separate one-shot capture, and polling; continuous/background reliability and cross-client convergence are **UNKNOWN / NOT VERIFIED**. | PWA-C11/C12/C13 after C3/C4 contracts. Do not claim live tracking from these source paths. |
| PWA-C2-004 | P1 | Driver workspace navigation | OPEN | **VERIFIED REPOSITORY FACT:** workspace access excludes a primary driver from `staff_portal` and grants the driver workspace. `driver-more-menu.tsx` hardcodes Profile, Notifications, Attendance, Jobs and Map links under `/staff-portal/...`, while the driver layout is under `/driver`. | A primary driver can be offered links that do not match the workspace boundary and may be redirected or inaccessible. The owning route contract is split between dedicated driver and staff-portal surfaces. | PWA-C3 role/navigation freeze; PWA-C4 navigation contract. Do not broaden workspace access to make the links appear to work. |
| PWA-C2-005 | P1 | Universal Scan entry point | OPEN | **VERIFIED REPOSITORY FACT:** staff navigation centers on Today, service progress, or Jobs (`staff-mobile-bottom-nav.tsx`, therapist navigation and driver navigation). No BarcodeDetector/getUserMedia scanner implementation or universal Scan route was found in the searched source. | The approved one-action scanner direction has no current navigation or decoder seam. Attendance versus Service Start remains a future server-resolved contract; no client-side success can be inferred. | PWA-C3 scope freeze; PWA-C4 interaction contract; implementation only in PWA-C6+. |
| PWA-C2-006 | P1/P2 | Push subscription ownership | OPEN | **VERIFIED REPOSITORY FACT:** `src/app/api/notifications/push/subscription/route.ts` scopes GET/POST to the authenticated context but DELETE updates by `endpoint` without an explicit `auth_user_id` predicate. POST upserts on endpoint and therefore also relies on deployed RLS/policy behavior for ownership. The migration enables RLS, but the deployed policy was not queried. | Route-level ownership is not explicit. Whether RLS prevents cross-user deactivation or reassignment is **UNKNOWN / NOT VERIFIED** because no database target was authorized. | PWA-C3 security scope and PWA-C17 only after target-aware review. Do not modify RLS or the route in C2. |
| PWA-C2-007 | P2 | Live Operations freshness and errors | OPEN | **VERIFIED REPOSITORY FACT:** `getActiveTripsForOpsMap` catches errors and returns `[]`; `live-ops-page.tsx` polls every 30 seconds without an explicit visibility/offline state; map script readiness retries for about 24 seconds. | Authentication, provider, network and “no active trips” states can collapse into the same empty presentation, and stale data can be hard to distinguish from current data. Exact user impact is **UNKNOWN / NOT VERIFIED**. | PWA-C4 state contract; PWA-C12/C13 reliability and performance acceptance. |
| PWA-C2-008 | P2 | PWA foundation and worker ownership | OPEN | **VERIFIED REPOSITORY FACT:** no Web App Manifest/install flow or camera decoder was found. `public/cradlehub-push-sw.js` is a root-scope push worker registered from notification settings. `public/sw.js` is a legacy worker that unregisters itself and deletes caches on activation. | PWA install, worker ownership, cache behavior, and push lifecycle are not a single documented foundation. Introducing a new worker without lifecycle analysis could break notifications or clear caches. | PWA-C3 foundation scope; PWA-C5 shared foundation. Preserve both workers while ownership is investigated. |
| PWA-C2-009 | P2 | Customer data and map payloads | OPEN | **VERIFIED REPOSITORY FACT:** live trip actions select customer identity/address and destination latitude/longitude for map consumers; customer tracking and dispatch map components consume these values. No C2 policy document defines minimization, retention, caching, or visibility by role. | Driver, CRM and map surfaces have a data-minimization and caching contract to define before implementation. Runtime exposure and retention are **UNKNOWN / NOT VERIFIED**. | PWA-C3 data/scope freeze; PWA-C4 role and state contract; PWA-C17 security review. |
| PWA-C2-010 | P2 | Connectivity and offline behavior | OPEN | **VERIFIED REPOSITORY FACT:** `useNetworkStatus` exists and selected booking-progress actions block when offline. No durable IndexedDB outbox or SyncManager-backed authoritative queue was found. | This is consistent with the approved online-first direction, but offline behavior is not centralized across future Scan, Attendance, service, trip and remote checkout surfaces. The acceptance behavior remains to be specified. | PWA-C3 online-first freeze; PWA-C4 state contract; no offline mutation queue in C2. |
| PWA-C2-011 | P2 | External map provider dependency | OPEN | **VERIFIED REPOSITORY FACT:** map components load Google Maps from `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, retry readiness for a bounded period, and fall back to an unconfigured/error state or external URL. No real-device or provider verification was performed. | Provider key configuration, script readiness, geolocation permissions and map rendering remain release dependencies. Android, iPhone, Google Maps and live-sync behavior are **UNKNOWN / NOT VERIFIED**. | PWA-C4 acceptance criteria; PWA-C12/C13 real-device verification. |
| PWA-C2-012 | P2 | Utility boundary | BLOCKED BY APPROVED SCOPE | **VERIFIED REPOSITORY FACT:** `src/app/(dashboard)/utility/page.tsx` is role-gated and presents a “Coming Soon” surface with planned cards; no Utility backend was found. | The approved roadmap excludes speculative Utility backend work. C2 records the boundary and does not turn the placeholder into a feature. | PWA-C3 scope freeze only; implementation remains unauthorized. |

## Existing tests and local evidence

**LOCAL TEST EVIDENCE (PWA-C1 baseline):** the isolated targeted command below passed 5 suites and 96 tests under Node 24.14.0 and pnpm 10.33.2:

```text
fnm exec --using=24.14.0 C:/Users/eleur/AppData/Roaming/npm/pnpm.cmd exec vitest run tests/lib/auth/workspace-access.test.ts tests/lib/staff-portal/attendance.test.ts tests/lib/attendance/smart-dynamic-clock-out.test.ts tests/lib/notifications/cradlehub-push-service-worker.test.ts tests/lib/home-service-tracking.test.ts --exclude '**/.claude/**'
```

No C2 runtime code or tests changed, so no new application test result is claimed here. The existing tests cover selected authorization, attendance, notification worker and home-service tracking contracts; they do not prove a live database, deployment, browser, device, camera, Google Maps or cross-client driver synchronization.

## Release and environment gates

- **Database target:** UNKNOWN / NOT VERIFIED. No database command was run.
- **Production/deployment:** UNKNOWN / NOT VERIFIED. No deployment or production request was made.
- **Android/iPhone/device camera:** UNKNOWN / NOT VERIFIED.
- **Google Maps provider:** UNKNOWN / NOT VERIFIED.
- **Live driver synchronization:** UNKNOWN / NOT VERIFIED.
- **Attendance production behavior:** UNKNOWN / NOT VERIFIED.
- Repository statements preserved from earlier records are **REPOSITORY-RECORDED PRODUCTION EVIDENCE** only and were not promoted to current live evidence.

## C2 disposition

PWA-C2 is complete as a source-only structured diagnostic. The findings are inputs to a separately authorized scope/design stage; they are not implementation authorization. PWA-C3 remains **NOT AUTHORIZED** until the owner explicitly advances the workstream.
