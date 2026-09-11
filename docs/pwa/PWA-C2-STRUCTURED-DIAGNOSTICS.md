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
| PWA-C2-006 | P2 | Push subscription ownership | OPEN | **VERIFIED REPOSITORY FACT:** `src/app/api/notifications/push/subscription/route.ts` scopes GET/POST to the authenticated context but DELETE updates by `endpoint` without an explicit `auth_user_id` predicate. POST upserts on endpoint and therefore also relies on deployed RLS/policy behavior for ownership. The migration enables RLS, but the deployed policy was not queried. | Route-level ownership is not explicit. Whether RLS prevents cross-user deactivation or reassignment is **UNKNOWN / NOT VERIFIED** because no database target was authorized. | PWA-C3 security scope and PWA-C17 only after target-aware review. Do not modify RLS or the route in C2. |
| PWA-C2-007 | P2 | Live Operations freshness and errors | OPEN | **VERIFIED REPOSITORY FACT:** `getActiveTripsForOpsMap` catches errors and returns `[]`; `live-ops-page.tsx` polls every 30 seconds without an explicit visibility/offline state; map script readiness retries for about 24 seconds. | Authentication, provider, network and “no active trips” states can collapse into the same empty presentation, and stale data can be hard to distinguish from current data. Exact user impact is **UNKNOWN / NOT VERIFIED**. | PWA-C4 state contract; PWA-C12/C13 reliability and performance acceptance. |
| PWA-C2-008 | P2 | PWA foundation and worker ownership | OPEN | **VERIFIED REPOSITORY FACT:** no Web App Manifest/install flow or camera decoder was found. `public/cradlehub-push-sw.js` is a root-scope push worker registered from notification settings. `public/sw.js` is a legacy worker that unregisters itself and deletes caches on activation. | PWA install, worker ownership, cache behavior, and push lifecycle are not a single documented foundation. Introducing a new worker without lifecycle analysis could break notifications or clear caches. | PWA-C3 foundation scope; PWA-C5 shared foundation. Preserve both workers while ownership is investigated. |
| PWA-C2-009 | P2 | Customer data and map payloads | OPEN | **VERIFIED REPOSITORY FACT:** live trip actions select customer identity/address and destination latitude/longitude for map consumers; customer tracking and dispatch map components consume these values. No C2 policy document defines minimization, retention, caching, or visibility by role. | Driver, CRM and map surfaces have a data-minimization and caching contract to define before implementation. Runtime exposure and retention are **UNKNOWN / NOT VERIFIED**. | PWA-C3 data/scope freeze; PWA-C4 role and state contract; PWA-C17 security review. |
| PWA-C2-010 | P2 | Connectivity and offline behavior | OPEN | **VERIFIED REPOSITORY FACT:** `useNetworkStatus` exists and selected booking-progress actions block when offline. No durable IndexedDB outbox or SyncManager-backed authoritative queue was found. | This is consistent with the approved online-first direction, but offline behavior is not centralized across future Scan, Attendance, service, trip and remote checkout surfaces. The acceptance behavior remains to be specified. | PWA-C3 online-first freeze; PWA-C4 state contract; no offline mutation queue in C2. |
| PWA-C2-011 | P2 | External map provider dependency | OPEN | **VERIFIED REPOSITORY FACT:** map components load Google Maps from `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, retry readiness for a bounded period, and fall back to an unconfigured/error state or external URL. No real-device or provider verification was performed. | Provider key configuration, script readiness, geolocation permissions and map rendering remain release dependencies. Android, iPhone, Google Maps and live-sync behavior are **UNKNOWN / NOT VERIFIED**. | PWA-C4 acceptance criteria; PWA-C12/C13 real-device verification. |
| PWA-C2-012 | P3 | Utility boundary | BLOCKED BY APPROVED SCOPE | **VERIFIED REPOSITORY FACT:** `src/app/(dashboard)/utility/page.tsx` is role-gated and presents a “Coming Soon” surface with planned cards; no Utility backend was found. | The approved roadmap excludes speculative Utility backend work. C2 records the boundary and does not turn the placeholder into a feature. | PWA-C3 scope freeze only; implementation remains unauthorized. |

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

## Attendance mutation map

The table below is a static source map. It identifies code paths and local SQL/RPC contracts; it does not prove that the same functions, policies, or rows are deployed. Database target: **UNKNOWN / NOT VERIFIED**.

| Path | Caller | Table/RPC | Device requirement | Branch requirement | Time rule | Audit/source | Idempotency | Authorization | Side effects |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Attendance QR clock-in | `/scan/[publicCode]` → public scan processor → `processQrScan` | `commit_attendance_scan_transaction`; `staff_shift_checkins`, `qr_scan_events`, possible `attendance_exceptions` | Registered/validated `staff_devices` credential or first-scan registration flow when the QR requires it | QR point, device/staff branch, effective attendance branch and branch-correction rules are resolved server-side | Attendance intent uses branch schedule windows; transaction receives server action context and operation ID | `qr_scan_events`, scan event metadata, audit fields and exceptions; source `src/lib/attendance/scan-engine.ts` | Operation/request ID plus transaction duplicate handling and exception dedupe key | Auth/device identity, active operational staff, QR point type, branch and schedule checks; RPC/RLS are deployment-dependent | Revalidation, notifications/workflow signals, device touch/registration and attendance state changes |
| Attendance QR clock-out | Same public scan route and engine | Same transactional RPC updates the open `staff_shift_checkins` row and records the scan event | Same registered-device boundary unless the identity flow is in recovery | QR point and effective branch must match the resolved staff/device context | Intent engine selects normal, early, overtime or recovery outcome from branch schedule state | Scan event, attendance status, exception and audit metadata | Operation ID and transaction duplicate handling | Server-resolved open check-in and policy checks; no client-selected action authority | Revalidation, closing signals, policy/recovery processing |
| `StaffCheckinWidget` check-in | `checkInStaffForShiftAction` in `src/lib/actions/staff-checkins.ts` | Direct insert into `staff_shift_checkins` | No device credential is read in this action | Branch is taken from the authenticated operator's own staff row; client cannot supply it | Client supplies validated `shiftDate`; insert uses database/action defaults for check-in timestamp | `recorded_by` is self/null or operator staff ID; notes are stored | Existing-row lookup; unique violation rereads the created row and returns already-checked-in | Self or CRM-capable operator; active authenticated staff | Revalidates CRM/manager schedule and availability caches |
| `StaffCheckinWidget` checkout | `checkOutStaffForShiftAction` | Direct update of `staff_shift_checkins` | No device credential is read in this action | Uses the existing row's `branch_id`; client supplies date/type selectors | `checked_out_at` is `new Date().toISOString()` in the action runtime | No scan event; notes are accepted by schema but not written in the shown update | Already checked-out rows return success; no scan operation ID | Self or CRM-capable operator; row existence required | Revalidates CRM/manager schedule and availability caches; does not call dynamic policy RPC |
| Portal clock-out | `clockOutFromStaffPortalAction` in `src/app/(dashboard)/staff-portal/actions.ts` | `commit_attendance_portal_clock_out` RPC | HttpOnly attendance device credential is hashed and checked against active trusted `staff_devices` | RPC receives the current check-in and staff/branch context; exact deployed branch policy is unknown | RPC/local SQL calculates server-side clock-out time and policy result | Attendance record, portal method, audit/event fields in the RPC contract | RPC is the authoritative commit; exact deployed duplicate behavior is unknown | Authenticated staff, active open shift, trusted device and server eligibility | Revalidates staff, operational, CRM, manager and attendance surfaces |
| Dynamic clock-out recalculation | `getMyAttendanceData` on staff portal, driver and attendance pages; SQL triggers/RPC callers also exist | `recalculate_attendance_clock_out_policy` updates policy fields on `staff_shift_checkins` | The page read checks device trust after calling the policy RPC; the RPC itself is a server-side policy operation | Check-in branch and associated assignments are evaluated in local SQL | `calculatedAt` defaults to action runtime ISO time; policy derives schedule, closing, home-service and driver-trip windows | `attendance_policy_source`, snapshot, expected/earliest/latest fields and policy method | Recalculation is repeatable by check-in ID; whether every deployment version is identical is unknown | RPC grants and SECURITY DEFINER/RLS are source-recorded only; deployed policy unknown | A read path can write policy/reconciliation fields and alter portal availability state |
| Attendance corrections | CRM/owner review actions through `attendance-correction-service.ts` | `apply_attendance_review_correction`; `reset_attendance_state_transaction`; `attendance_corrections` | No staff device requirement for reviewer path is shown | Reviewer context and target branch/check-in are checked in service/RPC contracts | Correction supplies reviewed effective times/state; exact timestamp authority is RPC-defined | `attendance_corrections`, review metadata, linked exceptions and scan events | RPC/record IDs and source references provide reconciliation; exact duplicate handling unknown | Restricted CRM/owner/reviewer service boundary; service-role/RPC grants are source-only evidence | Can update check-in, exception, linked scan state and revalidation signals |
| Exception and recovery paths | Public scan engine, CRM exception resolver, stale-open recovery and branch-correction actions | `attendance_exceptions`, `qr_scan_events`, `reconcile_provisional_attendance_clock_out`, `reset_attendance_state_transaction` | Device identity is retained for scan incidents; reviewer recovery can use authenticated staff context | Wrong-branch/branch-correction and effective branch resolution are explicit source paths | Recovery may use a derived safe recovery time; no client authority is implied | Original scan event and exception are retained for review; recovery issue links them | Dedupe keys, operation IDs and source event IDs are used in source contracts | Server scan identity, reviewer permissions, branch-correction policy and restricted RPCs | May reconcile provisional clock-out, update exception state and resolve workflow signals |
| Device activation | `activateDeviceAction`, first-scan registration and `/scan/activate/[token]` | `device_activation_tokens`, `staff_devices`; activation/registration RPC contracts | Purpose-bound token plus generated device credential; cookie stores the credential after success | Token staff/branch and effective branch are checked by source functions | Token expiry and activation time are server/action timestamps | Activation token usage, device row and scan event context | Token single-use/revocation and operation ID paths are source-recorded | Authenticated/continuation context, token purpose, staff/branch/activity checks | Sets HttpOnly device cookie, registers/reconciles device and revalidates attendance |
| Device replacement/recovery | Staff profile device actions, CRM registry and `consumeDeviceRecoveryLinkAction` | `staff_device_registration_requests`, `device_activation_tokens`, `staff_devices`; `review_staff_device_registration_request` | Fingerprint hash, active-device limit, revocation and replacement link | Staff and requested branch must match; branch active checks are source-backed | Recovery TTL is 15/30/60 minutes; expiration is checked server-side | Request/review/revocation fields, reasons, notifications and workflow signals | Open-request lookup, token used/revoked/expired states and replacement IDs | Staff self-request plus CRM/manager review context; exact deployed grants unknown | Revoke/supersede old device, activate replacement, notify CRM and revalidate surfaces |
| Home-service remote-related logic | Dynamic policy and portal action for home-service final assignment | `recalculate_attendance_clock_out_policy`, `commit_attendance_portal_clock_out`; booking reads | Trusted portal device required for portal commit; branch QR remains fallback | Active home-service assignment, branch and staff assignment are evaluated server-side | Expected/next assignment and final-completion windows come from policy SQL | Policy source `home_service`, portal method `staff_portal_home_service`, audit fields | RPC/check-in identity; exact duplicate behavior unknown | Open attendance, assignment state, capability and policy method; exact future Remote End Shift contract is not defined | May expose eligible portal action and commit clock-out; completion does not imply service-state authority |
| Driver final-trip logic | Dynamic policy and portal action for final assigned trip | `recalculate_attendance_clock_out_policy`, `commit_attendance_portal_clock_out` | Trusted portal device required for portal commit | Driver assignment/trip completion and branch are evaluated in policy SQL | Final-trip timing and hard cutoff are policy-derived | Policy source `driver_trip`, method `driver_portal_final_trip` | Check-in/RPC identity; exact duplicate behavior unknown | Driver assignment, open attendance, policy eligibility and restricted RPC | May expose/commit portal clock-out; trip transition remains a separate booking authority |

### Why `getMyAttendanceData` is not a pure read

**VERIFIED REPOSITORY FACT:** `getMyAttendanceData` loads staff, settings, check-ins, exceptions, active sessions and schedules. When it finds an open check-in, it creates an admin client and calls `recalculateAttendanceClockOutPolicy(admin, currentOpenRow.id)`. That helper calls `recalculate_attendance_clock_out_policy` with `p_checkin_id` and a calculated-at timestamp. The local migration defines the function as updating policy/eligibility fields and invokes it from additional trigger/RPC paths. The same page helper then reads device trust and returns portal clock-out availability.

This proves the source path can write policy state and alter the fields used to decide whether portal clock-out is exposed. It is called by staff attendance, staff home and driver page consumers. It does not prove the deployed RPC body, grants, RLS or production row effects. A page load that invokes the helper is therefore **UNKNOWN / NOT VERIFIED** as a mutation in any specific live target, but is not guaranteed mutation-free by the repository contract.

## Role and workspace access matrix

This matrix separates presentation mode from workspace/page/action authorization. A mode is not a permission grant. Route behavior below is source evidence only; direct runtime reachability is **UNKNOWN / NOT VERIFIED**.

| Role/staff type | Portal mode | Workspace grant | Proxy route | Page check | Action authorization | Navigation | Proven inconsistency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Therapist (`staff_type=therapist`) | `therapist` | `staff_portal` unless excluded primary role applies | `/staff-portal/*` | Shared staff layout plus mode-specific pages | Assigned staff, service type, booking transition and server/RPC checks | Therapist shell: Home, Schedule, Progress, Profile; center action `Start` → service progress | Approved universal Scan is absent; no new permission is inferred |
| Nail Tech (`staff_type=nail_tech`) | `therapist` shared service-provider mode | `staff_portal` | `/staff-portal/*` | Same shared mode/page checks | Same service-provider assignment/transition checks | Same therapist navigation | Shared mode is source-backed; distinct capability differences are not frozen |
| Aesthetician (`staff_type=aesthetician`) | `therapist` shared service-provider mode | `staff_portal` | `/staff-portal/*` | Same shared mode/page checks | Same service-provider assignment/transition checks | Same therapist navigation | Same as Nail Tech; exact service capability mapping remains deferred |
| Salon Head (`staff_type=salon_head`) | `therapist` shared service-provider mode | `staff_portal` | `/staff-portal/*` | Same shared mode/page checks | Same service-provider assignment/transition checks | Same therapist navigation | Product group is broader than the current shared presentation; no new authority inferred |
| CRM (`system_role=crm`) | `crm_staff` | `crm` + `staff_portal` | `/crm/*`, `/staff-portal/*` | CRM layout/path checks and staff self-service checks | CRM permission helpers plus action-specific branch/role checks | CRM navigation plus basic staff self-service surfaces | Mode is presentation; CRM admin access is action/path specific |
| CSR aliases (`csr`, `csr_head`, `csr_staff`) | `crm_staff` after canonicalization | `crm` + `staff_portal` | `/crm/*`, `/staff-portal/*` | Canonical CRM path checks | Same CRM permission helpers after alias canonicalization | CRM plus staff self-service | Legacy aliases map to CRM labels; alias storage/deployed role data not verified |
| General Staff (`system_role=staff`) | `basic` | `staff_portal` | `/staff-portal/*` | Staff layout and self-service pages | Self actions, assignment checks and server transitions | Basic shell: Home, Schedule, Today, Profile; center `Action` → Today | No universal Scan action; UI does not establish capabilities |
| Utility (`system_role=utility` or `staff_type=utility`) | `basic` | Utility workspace; primary `utility` role is excluded from staff portal | `/utility/*` | Utility page permits owner/utility and redirects others to `/staff-portal` | No Utility backend authorization was found; no speculative action is inferred | Utility page has a Back to Staff Portal link | The source creates a navigation/access conflict: Utility page links toward staff portal while primary utility role is excluded; exact runtime redirect/access outcome is UNKNOWN / NOT VERIFIED; page is Coming Soon |
| Driver (`system_role=driver` or `staff_type=driver`) | `driver` | Driver workspace; primary `driver` role excluded from staff portal | `/driver/*`; shared driver children also exist under `/staff-portal/*` | Driver pages allow owner, driver role or driver staff type; proxy workspace grants still apply | Assigned driver booking, progress transitions and location action checks | Dedicated driver shell; More menu hardcodes `/staff-portal/profile`, attendance, jobs and map | Driver More links conflict with the dedicated workspace (source-level route/workspace mismatch; staff-type-only driver retains staff portal grant because exclusion checks primary role); exact runtime reachability and redirect behavior are UNKNOWN / NOT VERIFIED |
| Manager (`manager`, `assistant_manager`, `store_manager`) | `basic` | Manager + CRM + Staff Portal | `/manager/*`, `/crm/*`, `/staff-portal/*` | Manager pages use manager role checks; action helpers vary by capability | Manager/CRM action helpers, branch and role checks | Manager shell plus staff self-service | Multiple workspaces are intentional; no single PWA role contract is frozen |
| Owner (`owner`) | `basic` | Owner + Manager + CRM + Marketing + Staff Portal | All corresponding paths | Owner pages usually require exact owner role; driver/utility pages explicitly permit owner | Owner-only server actions and path checks | Workspace selector and all granted shells | Broad grants coexist with strict action checks; UI mode is not authority |
| Digital Marketer (`digital_marketer`) | `basic` | Marketing only; primary role excluded from staff portal | `/marketing/*` | Marketing pages/actions check owner or digital marketer as appropriate | Draft/media/brand boundaries are action-specific | Marketing shell | Marketing separation is source-backed; it is not a Staff PWA grant |

### Role/access conclusion

The repository has canonical role aliases, shared service-provider mode, dedicated Driver and Utility workspace grants, and route/action checks. The main seams are the Driver split between `/driver` and `/staff-portal/...`, the Utility redirect/back link into a potentially unavailable Staff Portal, and the difference between presentation mode and action authority. No permission is broadened by this diagnostic.

## Driver end-to-end diagnostic

### Current path

`driver-trip-list.tsx` renders a user-triggered “Update my location” button. On click it calls `navigator.geolocation.getCurrentPosition` with high accuracy, a 10-second timeout and `maximumAge: 30000`. On success it calls `recordStaffLocationSnapshotAction` with booking ID, latitude, longitude, accuracy and source `gps`. The action authenticates the user, resolves the active staff row, loads the booking, requires a home-service booking assigned to that staff as `staff_id` or `driver_id`, rejects terminal booking statuses (`completed`, `cancelled`, `no_show`), and inserts a row in `staff_location_snapshots`. The source comments identify an RLS policy intended to enforce `staff_id = current user`.

`getActiveTripsForOpsMap` resolves the authenticated staff branch, selects active home-service bookings for a UTC-derived date, reads latest snapshots by booking, and returns customer name, service, therapist/driver, address, destination coordinates, booking state and the latest `recorded_at`. `LiveOpsPage` calls it initially and every 30 seconds. It catches action errors as `[]`. `OpsMap` loads the Google Maps browser SDK, retries readiness every 300ms for at most 80 attempts, and renders a staff marker for the latest snapshot plus a customer destination marker. No Realtime location subscription or continuous browser watch was found in these paths.

### Driver truth conclusions

- **CURRENT GPS TRUTH:** one-shot, user-triggered browser geolocation exists in the driver trip list. No continuous `watchPosition` capture is present in the inspected path.
- **LOCATION PERSISTENCE TRUTH:** the server action validates staff/booking assignment and writes `staff_location_snapshots`; target database policy and row state are **UNKNOWN / NOT VERIFIED**.
- **CRM LIVE MAP TRUTH:** CRM Live Operations reads the latest snapshot and destination data and renders Google Maps markers. The Driver Route Map remains a placeholder and is not the CRM Live Map.
- **CURRENT SYNCHRONIZATION TRUTH:** source shows client polling every 30 seconds for Live Operations. There is no inspected location Realtime subscription, and cross-client convergence is **UNKNOWN / NOT VERIFIED**.
- **FRESHNESS / STALE TRUTH:** snapshots carry `recorded_at`, but the consumer does not apply a visible age threshold or stale badge. A latest old snapshot can therefore be returned as the latest available location while the UI still labels the trip active. Whether deployed queries or policies add other constraints is **UNKNOWN / NOT VERIFIED**.
- **BACKGROUND-LOCATION STATUS:** the inspected code does not request background location. Platform documentation below does not guarantee repeated delivery while hidden, suspended or screen-locked. **UNPROVEN — REAL DEVICE TEST REQUIRED.**

The repository therefore supports a location snapshot path and a polled map consumer. It does not support the stronger claim of continuous live tracking.

## Official platform research — research only

The links below are current official documentation consulted for this correction. They are external platform facts, not CradleHub production evidence.

### Verified fact — official platform documentation

- [W3C Geolocation specification](https://www.w3.org/TR/geolocation/) defines `getCurrentPosition()` as one-shot and `watchPosition()` as repeated updates, requires permission and secure context, and specifies that position updates are delivered only to fully active, visible documents.
- [Chrome geolocation permission guidance](https://developer.chrome.com/blog/one-time-permissions/) states that Chrome pauses geolocation when a tab becomes backgrounded; its example says a background switch pauses geolocation immediately.
- [Chrome service-worker lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle) documents registration scope, installation/activation, waiting beside an older worker, and browser-controlled update timing. A service worker has an event-driven lifecycle; it is not a continuously running page process.
- [Chrome periodic background sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync) documents engagement, installation, power and connectivity conditions, and says timing is controlled by the browser rather than the developer.
- [WebKit Home Screen web apps and Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-and-ipados/) documents manifest `display` behavior, Home Screen web-app separation from Safari, and Web Push support for installed iOS/iPadOS web apps.
- [WebKit background power behavior](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/) documents throttled timers and that iOS tabs can be completely suspended when possible.
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) documents cross-platform URL handoff for search, directions and navigation; it does not establish background location transmission by a calling PWA.

### Required platform answer

| Condition | Can pure PWA transmission be assumed? | Evidence-based conclusion |
| --- | --- | --- |
| Foregrounded and visible | No blanket guarantee; browser permission, secure context, device/provider and network still apply | The API can request updates, but CradleHub has no continuous implementation or runtime proof. **UNPROVEN — REAL DEVICE TEST REQUIRED.** |
| Another app is open | No | Chrome pauses background-tab geolocation; WebKit may throttle or suspend inactive content. **UNPROVEN — REAL DEVICE TEST REQUIRED.** |
| Google Maps navigation is open | No | A Maps URL can hand off navigation, but the PWA's page may become hidden/backgrounded and no official guarantee covers continued geolocation delivery. **UNPROVEN — REAL DEVICE TEST REQUIRED.** |
| Screen locked | No | The cited platform documentation does not guarantee a web page continues to receive geolocation callbacks while locked. **UNPROVEN — REAL DEVICE TEST REQUIRED.** |
| PWA backgrounded | No | Chrome and WebKit impose background/suspension constraints. **UNPROVEN — REAL DEVICE TEST REQUIRED.** |
| Browser/web app suspended | No | A suspended page cannot be treated as a reliable continuous transmitter. **UNPROVEN — REAL DEVICE TEST REQUIRED.** |

Recommendation: keep V1 explicit active-trip, user-visible and online-first, and treat location as a server-accepted snapshot until device evidence exists. Project decision: **ARCHITECTURE DECISION REQUIRED LATER** if accepted reliability requires behavior the pure PWA cannot prove. C2 does not choose Capacitor or a native architecture.

## Scanner conclusion

The current QR architecture is server-authoritative. `/scan/[publicCode]` renders the public scan processor; the public scan route and server actions pass the `publicCode` and an operation/request ID to attendance scan identity resolution and `processQrScan`. QR points are typed as `attendance`, `room` or `resource`. Attendance scans resolve clock-in/clock-out intent from server schedule and check-in state; room/resource scans route through the existing service/resource contract, including `start_booking_service_session` where applicable. Device registration, first-scan continuation, signed-in registration, activation links and recovery links are existing source paths. Operation IDs, scan-event IDs, transaction RPCs and dedupe keys are used by the server contract.

The missing layer is a camera decoder and a single Staff PWA Scan entry point. A camera decoder can adapt to the existing contract if it only produces the QR public code and submits it to the existing server path. It must not infer attendance versus Service Start, authorize the user, write a second scan record, or show success before the server response. **VERIFIED REPOSITORY FACT:** no BarcodeDetector/getUserMedia scanner implementation was found. Recommendation: the safest later seam is camera capture → existing `/scan/[publicCode]`/server resolution contract, with no second scanner authority.

## Attendance conclusion

Authoritative attendance facts are the existing check-in records, QR scan events, device trust, schedule/branch policy and restricted server/RPC contracts. The repository contains QR clock-in/clock-out, direct shift-widget check-in/checkout, portal clock-out, dynamic policy recalculation, device activation/replacement/recovery, exception/correction and stale-open recovery paths. QR uses operation IDs and transactional server resolution; direct widget actions bypass the scan transaction; portal clock-out uses a trusted device and a dedicated RPC; dynamic recalculation can be invoked from a read path.

Current inconsistencies are the multiple command paths, different timestamp/side-effect ownership, page-load policy writes, and unverified deployed RLS/RPC behavior. This is a **P1 functional/data-reliability diagnostic** for future contract work, not a claim that production attendance is broken. Exact Remote End Shift eligibility remains intentionally unspecified.

## Role and access conclusion

- **Portal modes:** Client presentation modes (`basic`, `therapist`, `crm_staff`, `driver`) dictate shell layout and navigation visibility only. They do not constitute security boundaries.
- **Workspace grants:** Enforced server-side in `src/lib/auth/workspace-access.ts` based on primary system role and explicit exclusion sets (`staff_portal`, `driver`, `utility`, `crm`, `marketing`, `manager`, `owner`).
- **Driver split:** The dedicated Driver workspace covers `/driver/*`, but `driver-more-menu.tsx` hardcodes links to `/staff-portal/profile`, attendance, jobs, and map. Primary `driver` role is excluded from the `staff_portal` workspace. This creates a source-level route/workspace mismatch. Exact runtime reachability and redirect behavior remain UNKNOWN / NOT VERIFIED.
- **Utility split:** The source creates a navigation/access conflict: the Utility surface links toward staff-portal while the primary utility role is excluded from that workspace. The exact runtime redirect/access outcome is UNKNOWN / NOT VERIFIED.
- **Service-provider handling:** Therapist, Aesthetician, Nail Tech, and Salon Head share the `therapist` presentation mode and service progress views under `/staff-portal/*`. Distinct specialty boundaries are enforced via booking assignment checks rather than separate client portals.
- **CRM/general handling:** CRM staff hold dual workspace grants (`crm` and `staff_portal`), enabling operational management alongside personal staff self-service. General staff are restricted to `staff_portal`.
- **Direct-route concerns:** Direct URL access to proxy routes (`/driver/*`, `/utility/*`, `/staff-portal/*`) is intercepted by server-side layout/page authorization checks. Inconsistent route mappings create source-visible navigation conflicts, while exact runtime redirect and browser behavior remain UNKNOWN / NOT VERIFIED.
- **UI mode versus real authorization:** Presentation mode determines what the user sees; Server Actions, Supabase RPCs, and deployed database RLS policies remain the sole authoritative enforcement points. Client UI mode cannot broaden server permissions.

## PWA foundation conclusion

- **Manifest/install:** no Web App Manifest or install flow was found in the searched repository paths; icon assets exist.
- **`cradlehub-push-sw.js`:** explicit root-scope push worker registered by notification settings and responsible for push event handling.
- **`sw.js`:** legacy root worker that unregisters itself and deletes caches on activation.
- **Current ownership:** two root-scope worker artifacts have different lifecycle purposes; no single ownership contract is documented.
- **Cache/offline:** selected UI network guards exist, but no durable authoritative outbox was found. Worker cache behavior is not a PWA operational authority.
- **Push lifecycle:** subscription registration, renewal and safe navigation allowlist exist; provider/device delivery is **UNKNOWN / NOT VERIFIED**.
- **Collision risk:** registering a new root worker or broad cache policy without an ownership plan could change control scope, update timing or delete caches needed by another worker.
- **Safe later path:** inventory existing registrations and cache names in a known environment, define one compatible ownership/update contract, then implement only in an authorized shared-foundation stage. No worker or manifest implementation is part of C2.

## Decision-dependency table

| Future feature | Existing foundation | Proven gap | Dependency before implementation | Recommended later stage |
| --- | --- | --- | --- | --- |
| Installable PWA | Responsive shells, icon assets | No manifest/install flow | Manifest scope, session/install and device acceptance | PWA-C3/C5 |
| Service-worker ownership | Push worker plus legacy worker | Root-scope lifecycle conflict | Known-environment registration/cache inventory and one owner | PWA-C3/C5 |
| Camera scanner | `/scan/[publicCode]` server path | No camera decoder or Scan entry | Capture/error/permission contract over public-code submit | PWA-C3/C4/C6 |
| Automatic QR intent | Attendance intent engine and QR point types | No unified PWA capture surface | Preserve server resolution and authorization | PWA-C3/C4/C6 |
| Attendance | Check-ins, device trust, RPCs and QR flow | Multiple mutations and read-side recalculation | Canonical command/side-effect contract and target-aware tests | PWA-C3/C7 |
| Remote End Shift | Portal clock-out and policy sources | Exact eligibility/capability contract deferred | Owner-approved rules, audit and target verification | PWA-C3/C14 |
| Service Start QR | Room/resource scan and service-start RPC | No camera integration | Adapt existing transition without second state machine | PWA-C4/C8 |
| Role-aware shell | Workspace grants and mobile shells | Driver/Utility route seams | Role/capability/navigation matrix | PWA-C3/C5 |
| Therapist/Salon | Shared therapist mode and service transitions | Exact provider capability labels | Approved shared-provider contract | PWA-C4/C8 |
| Utility | Role-gated Coming Soon page | No approved backend | Explicit scope and permissions | PWA-C3/C10 |
| Driver core | Driver workspace, jobs and progress actions | Duplicate route surfaces and no universal Scan | Driver navigation/active-trip contract | PWA-C3/C11 |
| Driver map | Placeholder route map and external URLs | No embedded driver live map | Map UX, provider and assignment contract | PWA-C4/C12 |
| GPS acquisition | One-shot `getCurrentPosition` | No continuous lifecycle | Consent, cadence, failure and stop contract | PWA-C4/C13 |
| Location persistence | `recordStaffLocationSnapshotAction` and snapshots | Target policy/freshness unknown | Known target, retention and RLS review | PWA-C13/C17 |
| CRM Live Map | Latest snapshot query and Google map consumer | 30-second polling, no stale state | Freshness/reconnect/visibility acceptance | PWA-C12/C13 |
| Continuous synchronization | Polling consumer | No sustained convergence proof | Cross-client event/freshness contract | PWA-C13 |
| Background reliability | Browser APIs and worker lifecycle | Official docs do not guarantee it | Real Android/iPhone matrix and architecture gate | PWA-C13 or later architecture decision |
| Notifications | Push worker, subscription API and settings | Provider/device delivery unknown | Target-aware provider/device evidence and ownership contract | PWA-C15 |
| Offline protection | Network hook and selected action guards | No central action-state contract | Online-first failure/success semantics | PWA-C3/C5/C16 |
| Customer-data minimization | Existing booking, dispatch, tracking payloads | No field-by-role retention/cache policy | Data inventory, minimization and security review | PWA-C3/C17 |

## Customer-data minimization inventory

This is a source-field inventory, not a deployed payload or runtime capture. Fields that vary by query or policy remain **UNKNOWN / NOT VERIFIED** at runtime.

| Role/surface | Fields received | Operationally required | Potentially excessive | Source |
| --- | --- | --- | --- | --- |
| Therapist | Assigned booking identity, service, schedule/progress, customer name and session fields where selected | Assignment, service progress and timing | Full customer address/contact data if not needed for in-spa work | Staff portal actions and therapist views |
| Salon provider | Shared therapist-mode booking/service fields | Assigned service, resource and timing | Cross-role dispatch/customer fields | `getStaffPortalMode`, staff portal service consumers |
| CRM/general personal portal | Own schedule, attendance, assigned bookings and selected customer/service context | Personal work and attendance | Broad CRM customer records outside personal assignment | Staff portal actions and CRM workspace consumers |
| Utility | Coming Soon shell/planned cards; no operational payload found | None proven in current implementation | Any future customer or location data | `src/app/(dashboard)/utility/page.tsx` |
| Driver trip UI | Booking ID/date/time/status/progress, service/duration, customer name, therapist name, home-service address/city/zone/map URL | Trip execution, navigation and assignment context | Therapist name or full address after navigation handoff, depending on task | `src/components/features/driver/driver-trip-list.tsx` |
| Driver map | Customer name/address/destination latitude/longitude, driver/therapist names, service/status and latest location timestamp | Dispatch/map marker and active-trip operations | Full address/name in every map response; stale location without age signal | `getActiveTripsForOpsMap`, `ops-map.tsx` |
| Push notifications | Notification title/body, destination URL/data and subscription metadata | Alert text and destination | Customer names/addresses or coordinates in notification payload | Notification settings, push worker and delivery code |
| Dispatch map | Active booking/customer destination, staff/driver identity, status and latest location | Branch operations and dispatch | Full customer detail when map marker only needs a destination | Dispatch live map and live operations consumers |
| Customer tracking | Tracking token context, booking/customer presentation and latest driver coordinates/timestamp | Customer-facing tracking | Internal staff identity or operational metadata not needed by customer | `src/app/track/[token]/page.tsx`, tracking map/page client |

No fields are removed or changed by C2. Retention, caching, push payload and role visibility require a later security/data contract.

## Mobile UX diagnostic

This is source analysis only; no safe known runtime target was available and no screenshot evidence was produced.

- **Primary action placement:** basic staff navigation centers an `Action` button that links to Today; therapist navigation centers `Start` to service progress; driver navigation centers Jobs. None is a universal Scan action.
- **Current/next work hierarchy:** staff home/today and therapist progress expose work by role; driver jobs expose active work, while the Driver Route Map remains a separate route.
- **Scan prominence:** no camera layer or universal Scan route exists in inspected source; scanning requires navigating to specific route flows rather than being accessible via a universal PWA primary action.
- **Attendance prominence:** Attendance clock-in and clock-out actions are embedded within page views and secondary routes rather than anchored as persistent shell actions or prominent home actions. Direct shift widgets coexist with QR flows and dynamic portal clock-out without a unified attendance hierarchy.
- **Duplicate navigation:** dedicated `/driver` routes coexist with `/staff-portal` driver children and More-menu links; Utility has its own route plus a Staff Portal back link.
- **Driver active-trip hierarchy:** trip cards contain progress actions and a one-shot location button; the map route is visually prominent but placeholder-backed.
- **Utility placeholder:** the page is explicitly Coming Soon and must remain so under current scope.
- **CRM/general mobile hierarchy:** CRM and staff portal shells are separate; personal staff views coexist with CRM operational surfaces and do not establish a single PWA hierarchy.
- **Safe-area handling:** mobile shells use `env(safe-area-inset-bottom)` and map headers use top safe-area padding in source CSS/classes.
- **Touch-target evidence:** source includes multiple `min-h-11`, `min-h-12`, `min-h-14` controls in driver/map actions and navigation. This is structural evidence only; actual target size, contrast, focus and gesture behavior are **UNKNOWN / NOT VERIFIED**.

No C4 redesign, visual polish or accessibility remediation is authorized here.

## Performance diagnostic

No safe runtime measurement was available. Measured runtime performance is **UNKNOWN / NOT VERIFIED**.

Source-measurable behavior includes:

- Live Operations and customer tracking poll every 30 seconds.
- Google Maps readiness checks every 300ms for up to 80 attempts, approximately 24 seconds.
- `getActiveTripsForOpsMap` performs staff/branch, active booking, latest snapshot and driver-name reads, then returns a composite payload containing customer and destination data.
- `getMyAttendanceData` performs staff/settings/check-ins/exceptions/sessions/schedule reads and can invoke dynamic attendance policy recalculation for an open check-in.
- Staff attendance and today surfaces have Realtime hooks; dispatch SWR revalidation is event-driven with focus/mount revalidation disabled in the inspected workspace.
- Driver countdown/location UI uses client timers and explicit action calls; no background scheduler or durable outbox was found.
- Live Operations catches action errors and presents an empty array, which is an observability/freshness concern as well as a data-path concern.
- **Possible role-unrelated data loading:** `getActiveTripsForOpsMap` returns full customer contact, full destination address, and therapist details across all active trips for dispatch map rendering, which exposes customer data beyond minimal operational requirements.
- **Client/server boundaries:** Read paths such as `getMyAttendanceData` cross into write-capable policy recalculations on the server, blurring the boundary between idempotent queries and state mutations.
- **Repeated query/action ownership:** Multiple components independently trigger attendance data fetching and check-in queries without centralized SWR cache deduplication across different portal layouts.

These are diagnostic observations, not optimization instructions or before/after measurements.

## C2 summary table

| ID | Severity | Domain | Finding | Evidence level | User/operational impact | C3 candidate? |
| --- | --- | --- | --- | --- | --- | --- |
| PWA-C2-001 | P1 | Business date | UTC and branch-business-date consumers differ | VERIFIED REPOSITORY FACT; runtime UNKNOWN / NOT VERIFIED | Cross-surface date disagreement around branch midnight | Yes |
| PWA-C2-002 | P1 | Attendance | Multiple mutation paths and read-side policy recalculation | VERIFIED REPOSITORY FACT; deployed RPC UNKNOWN / NOT VERIFIED | Different authority, timestamp and side-effect behavior can be presented as one Attendance surface | Yes |
| PWA-C2-003 | P1 | Driver location | Placeholder map, one-shot capture and polling are separate | VERIFIED REPOSITORY FACT; device sync UNKNOWN / NOT VERIFIED | Driver/CRM freshness and active-trip visibility are unproven | Yes |
| PWA-C2-004 | P1 | Workspace navigation | Driver More links point at staff-portal paths despite workspace split | VERIFIED REPOSITORY FACT; direct runtime reachability UNKNOWN / NOT VERIFIED | Driver may encounter redirect or inaccessible links | Yes |
| PWA-C2-005 | P1 | Scanner | Universal Scan/camera layer is absent | VERIFIED REPOSITORY FACT | Approved interaction has no current entry point | Yes |
| PWA-C2-006 | P2 | Push security boundary | Endpoint ownership is not explicit in DELETE/POST route code; deployed RLS is unverified | VERIFIED REPOSITORY FACT; deployed RLS UNKNOWN / NOT VERIFIED | Potential cross-user ownership gap requires target-aware review | No — route/RLS review belongs to PWA-C17 |
| PWA-C2-007 | P2 | Live Operations | Errors collapse to empty and polling has no visible stale/offline state | VERIFIED REPOSITORY FACT; runtime impact UNKNOWN / NOT VERIFIED | Operators may confuse no trips with error or stale data | Yes |
| PWA-C2-008 | P2 | PWA foundation | No manifest; two root worker artifacts have conflicting lifecycle roles | VERIFIED REPOSITORY FACT | Install/update/cache/push behavior lacks one ownership contract | Yes |
| PWA-C2-009 | P2 | Data minimization | Customer identity/address/coordinates cross map consumers without a role policy | VERIFIED REPOSITORY FACT; runtime visibility UNKNOWN / NOT VERIFIED | Unbounded payload and retention decisions remain unresolved | Yes |
| PWA-C2-010 | P2 | Connectivity | Selected offline guards exist; no durable authoritative queue | VERIFIED REPOSITORY FACT | Online-first behavior is not centralized across future actions | Yes |
| PWA-C2-011 | P2 | Provider dependency | Google Maps/geolocation readiness and device behavior lack evidence | VERIFIED REPOSITORY FACT; provider/device UNKNOWN / NOT VERIFIED | Map/navigation release dependencies are unproven | No — acceptance belongs to PWA-C4/C12/C13 |
| PWA-C2-012 | P3 | Utility scope | Utility is a role-gated Coming Soon surface with no backend | VERIFIED REPOSITORY FACT; scope is owner decision | Prevents speculative backend work | No — remains blocked by approved scope |

The existing findings PWA-C2-001 through PWA-C2-012 are retained. PWA-C2-006 is classified as P2 because the route-level boundary is observable in source while the deployed RLS outcome is not available for verification.
