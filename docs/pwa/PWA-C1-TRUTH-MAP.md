# PWA-C1 — Current-System Truth Map

Date: 2026-09-11. Workstream: CradleHub Staff PWA. Status: **delivered for review; not owner-accepted or release-certified**. Authority and roadmap: [project governance](PROJECT.md).

## 1. Accepted repository baseline

**VERIFIED REPOSITORY FACT**

| Item | Evidence |
| --- | --- |
| Canonical remote | `https://github.com/techwithmpg/Cradlehub.git` for fetch/push |
| Baseline | `b2b9b6ec7579bbd9b519841cadf612ed133cbfcc` |
| Initial state | `main`; clean tracked/untracked working tree; HEAD equals fetched `origin/main` |
| Fetch | `git fetch --all --prune` succeeded on 2026-09-11 after filesystem permission escalation |
| Dedicated branch | `stage/pwa-c1-current-system-truth`, created from `origin/main` at the baseline |
| Recent accepted work | HEAD subject: `docs(today): finish Stage 09A evidence scope and mutation wording`; includes newer Hosted Today contract work, not only the old Marketing closeout anchors |
| Current source inventory | 109 tracked App Router `page.tsx` entries, 44 `route.ts` handlers, 131 SQL migrations |
| Framework contract | `package.json`: Next.js 16.2.4; React/React DOM 19.2.4; pnpm 10.33.2; Node >=24 <25; `.node-version`: 24.14.0 |
| Local runtime | Default shell Node 25.2.0 is outside the contract; Node 24.14.0 is available through `fnm`; installed Next package reports 16.2.4 and local Next guides exist |

The accepted repository baseline means the fetched canonical `main` source. It does not prove a deployed commit, device behavior, or that every inherited stage was individually accepted. The existing AI context and project status have conflicting Marketing authorization paragraphs, and older system inventory counts describe their earlier baseline. PWA-C1 uses the SHA above, preserves those records, and registers a separate PWA authorization instead of rolling back to an old anchor.

Commands used to establish baseline: `git remote -v`, `git fetch --all --prune`, `git branch --show-current`, `git status --short --branch`, `git rev-parse HEAD`, `git rev-parse origin/main`, `git log -6 --oneline`, `git diff --stat HEAD origin/main`. Inventory counts use tracked `git ls-files` paths, not ignored artifacts.

## 2. Evidence and environment boundary

All implementation findings below are **VERIFIED REPOSITORY FACT** unless explicitly qualified. A present route, permission check, RPC call, SQL policy, test, or UI label proves source presence only.

| Environment | PWA-C1 evidence |
| --- | --- |
| LOCAL source / Git | Inspected; docs-only edits on dedicated branch |
| LOCAL test process | Five existing unit/source-contract suites; exact results in the handoff |
| LOCAL database | No connection or mutation |
| TEST database | No connection or mutation; test mocks are not a database |
| STAGING | No access or verification |
| PRODUCTION | No runtime, database, deployment, Auth, RLS, Storage, cron, or Realtime verification |
| Android / iPhone / installed PWA | Not tested |
| Camera / Google Maps / background GPS / push delivery | Not tested against real devices or providers |

No environment files or private data were needed for this inspection. No application server or browser session was started. This matters because some apparent reads invoke write-capable RPCs, as described below.

## 3. Current architecture and role boundaries

```text
Existing Next.js Web routes and mobile shells
  -> request-cookie Supabase Auth + active staff/workspace access
  -> Server Actions / route handlers / shared queries
  -> Supabase PostgreSQL + RLS / restricted RPCs
  -> selected Realtime subscriptions and server-triggered revalidation

Privileged attendance / notification paths
  -> server-side admin client + explicit identity/role/branch checks
  -> existing authoritative database
```

There is no separate PWA application/database introduced by this work. Browser local preferences, notification dedupe state, cached views, and timers cannot authorize or commit operational facts.

| Current role/mode | Source behavior | Boundary to preserve |
| --- | --- | --- |
| Basic / general staff | `getStaffPortalMode` falls back to `basic`; basic mobile home/schedule/stats components exist | A display mode does not grant operational permissions |
| Therapist / Salon | `therapist` mode covers service staff types, including therapist, nail technician, aesthetician, salon head; service progress and session components exist | Assigned booking, service capability, branch/resource and session rules remain server/database concerns |
| CRM staff | `crm_staff` selected for front-desk roles after driver/service-type precedence; `isBasicStaffMode` includes it | CRM workspace permissions are separate from personal staff views; legacy front-desk role aliases are canonicalized |
| Driver | Role or staff type selects driver mode; `/driver` has its own root and shared child screens/actions | Primary driver role is excluded from `/staff-portal` grants; a staff-type driver can have both workspaces depending on primary role |
| Utility | Primary role or staff type can grant `/utility`; its page checks owner/utility primary role | Primary utility role is excluded from Staff Portal grants; page/proxy differences and its Back to Staff Portal link need later diagnostics |
| Owner / manager / marketing | Existing workspace grants remain | Owner/manager exceptions in actions do not imply every driver/utility page is accessible through proxy; digital marketer has no primary Staff Portal grant |

Evidence: [mode derivation](../../src/lib/staff/get-staff-portal-mode.ts), [workspace access](../../src/lib/auth/workspace-access.ts), [proxy](../../src/proxy.ts), [utility page](../../src/app/(dashboard)/utility/page.tsx), [driver root](../../src/app/(dashboard)/driver/page.tsx).

`src/proxy.ts` protects workspace prefixes, refreshes the session, resolves `auth.getUser()` plus an active `staff` row, and checks workspace access. API routes skip proxy authentication and own their contracts. The dashboard layout is not a substitute for sensitive page/action authorization. `src/lib/supabase/admin.ts` creates an RLS-bypassing service-role client without a module-level `server-only` import; this is an inherited boundary requiring later review, not a proven exposure. Development bypass is guarded by non-production environment checks; bypass views would not prove normal authorization.

## 4. Route and consumer map

| Surface | Existing routes / consumers | Current ownership and authority |
| --- | --- | --- |
| Personal staff | `/staff-portal`, `/today`, `/schedule`, `/week`, `/stats`, `/more`, `/profile`, `/notifications`, `/attendance`, `/service-progress` under that root | Staff route actions, `src/lib/staff-portal/`, basic/therapist/mobile feature components; active staff identity, assigned bookings, schedules/overrides, attendance and notification records |
| Driver within staff portal | `/staff-portal/dispatch`, `/jobs`, `/jobs/active`, `/jobs/[bookingId]`, `/map` | Staff portal actions and `staff-portal/driver/` components; branch + staff/driver assignment |
| Dedicated driver | `/driver`, `/driver/dispatch`, `/driver/jobs`, `/driver/jobs/[bookingId]`, `/driver/map` | Root uses `components/features/driver/`; child map/jobs reuse staff-portal components and actions; preserve both trees until consumers are reconciled |
| Scan | `/scan/[publicCode]`, `/scan/activate/[token]`, `POST /api/attendance/public-scan`, scan Server Actions | Public scan processor, server identity/device resolution, QR point and scan engine; scan landing is operational, not a passive informational page |
| Utility | `/utility` | Authenticated Coming Soon page with planned module cards; no task/checklist execution established |
| Shared operational consumers | CRM/Owner Attendance, CRM/Manager dispatch/control/live operations, customer tracking `/track/[token]`, schedule and notification workspaces | Existing domain queries/actions/RPCs and revalidation; Staff PWA is not isolated from these consumers |

Navigation is already mode-specific: staff Home/Schedule/Today/Profile; therapist Home/Schedule/Progress/Profile; driver Home/Trips/Map/Profile. Central actions link to existing Today/progress/jobs flows; no central camera scanner was found. The profile matching arrays include `/staff-portal/settings`, but no such page was found in the current route inventory; matching text alone does not prove a linked, implemented route.

## 5. PWA foundation, scanner and attendance truth

| Area | Existing implementation | Limits / preservation requirement |
| --- | --- | --- |
| Installation | Icon assets `public/manifest-icon-192.png` and `manifest-icon-512.png`; root metadata handles icons | No Web App Manifest or install prompt implementation found in `src`, `public`, `next.config.ts`, or `package.json`. Icons and responsive shells do not certify installability |
| Service workers | `public/cradlehub-push-sw.js`, registered at scope `/` only on explicit notification enable | Push handling, notification click routing, renewal, visible-tab reconciliation; no fetch-cache/offline outbox implementation in this worker |
| Legacy worker | `public/sw.js` unregisters its registration and deletes all Cache Storage cache names on activation | It is executable cleanup code, not an offline worker. Preserve it until old clients, registration paths, cache ownership and migration coexistence are understood |
| Connectivity | OfflineBanner + `useNetworkStatus` use browser online/offline events; booking-progress actions explicitly gate on `isOffline` | Banner says write actions are disabled, but the banner/hook do not centrally enforce that for all callers. No durable IndexedDB outbox/background synchronization found in searched source |
| Scanner entry | Branch/room/resource QR URL opens `PublicScanProcessor`; POST or action resolves identity and device before processing | No `BarcodeDetector`/`getUserMedia` implementation found in `src`/`public`; OS-camera QR-link entry is different from a verified in-app scanner |
| Existing intent routing | `QrPointType = attendance | room | resource`; scan engine sends attendance points to `processAttendanceScan`, other points to `processRoomScan` | Already contains context-specific intent logic; do not replace it with an independent client attendance/session engine |
| Identity / continuation | Auth session, registered-device credential cookies, signed scan continuation, activation/recovery, branch correction | Cookie credentials are HttpOnly; request operation IDs support server result replay. Public code does not itself establish staff authorization |
| Attendance | Scan engine plus `commit_attendance_scan_transaction`; check-ins, QR events, exceptions, schedule/branch/device rules | Preserve transactional event/record consistency, duplicate handling, business date, transfer/recovery and test-mode distinctions |
| Room / service scanning | Room path validates context and calls `start_booking_service_session` | Starting a service has booking/resource/attendance side effects. Source presence does not establish end-to-end room scanning or the full approved future scanner model |
| Parallel shift actions | `StaffCheckinWidget` still invokes `checkInStaffForShiftAction` / `checkOutStaffForShiftAction` | These use existing `staff_shift_checkins` with self/operator checks and RLS, alongside QR and portal clock-out paths. Reconcile policy parity in a later authorized diagnostic stage; do not delete them now |
| Portal clock-out | No client staff/branch/time parameters; authenticated user + hashed registered-device credential passed to `commit_attendance_portal_clock_out` | Database re-resolves eligibility and commits. Existing remote-related methods are not proof of the complete approved off-site checkout direction |
| Attendance reads | `getMyAttendanceData` loads own check-ins, exceptions and bookings; for an open check-in it invokes `recalculateAttendanceClockOutPolicy` via admin client | That RPC has update statements in the local migration. A page load must not be treated as a guaranteed read-only production check |
| Live attendance | `StaffAttendanceRealtime` subscribes to own `staff_shift_checkins` and calls `router.refresh()` | Realtime publication/RLS and refresh outcomes are unverified; refresh may revisit the policy-recalculation path |

Source anchors: [scan route](../../src/app/api/attendance/public-scan/route.ts), [scan actions](../../src/app/scan/actions.ts), [scan engine](../../src/lib/attendance/scan-engine.ts), [scan types](../../src/lib/attendance/types.ts), [portal actions](../../src/app/(dashboard)/staff-portal/actions.ts), [attendance query](../../src/lib/staff-portal/attendance.ts), [shift actions](../../src/lib/actions/staff-checkins.ts), [dynamic policy](../../src/lib/attendance/dynamic-clock-out.ts), [dynamic clock-out SQL](../../supabase/migrations/20260715021703_attendance_smart_dynamic_clock_out.sql), [legacy worker](../../public/sw.js), [push worker](../../public/cradlehub-push-sw.js), [network hook](../../src/hooks/use-network-status.ts).

The dynamic policy models home service, driver trip, service completion, CRM closing and schedule sources, with methods `staff_portal_home_service`, `staff_portal_closing_shift`, and `driver_portal_final_trip`. Local SQL represents device checks, row locks, eligibility recalculation, audit writes and restricted execution grants. Its deployment and real eligibility outcomes are **UNKNOWN / NOT VERIFIED**. No geofence or new remote policy is specified or implemented by C1.

Scanning and operational enforcement are separate switches in `src/lib/config/mvp-flags.ts`: scanning defaults enabled if unset, enforcement defaults disabled. Actual deployment values were not read. `getAttendanceLaunchStatus()` hardcodes `closingAutomationVerified: false`; configuration is not evidence that database cron ran.

## 6. Service work, driver map and synchronization

| Domain | Sources / consumers | Authority, side effects and present limits |
| --- | --- | --- |
| Therapist / Salon | Portal actions; therapist home/schedule/progress; session countdown and booking progress components | Own assigned bookings/schedules. `updateBookingProgressAction` checks assignment/role, terminal status and transition validity, then uses start/complete-session or progress RPCs. Revalidates staff, driver and operational surfaces. Client timers are presentation and trigger mechanisms, not authoritative completed service state |
| General / CRM staff | Basic mobile views, week/schedule helpers, profile actions, shared notifications | Active staff and schedules/bookings remain authoritative; profile writes touch `staff`, photo upload touches `staff-pictures` and stored avatar reference. Personal mode does not grant CRM management rights |
| Utility | Utility root and workspace helper | Coming Soon module descriptions are not implemented workflows or additional owner-approved requirements |
| Driver jobs | `getMyDriverJobsAction`, recent/detail actions, `getDispatchData`, driver assignment actions | Branch-scoped assigned bookings/driver IDs; travel progression shared with therapist/operations. Current map route converts query errors into empty items in Staff Portal, while dedicated driver map redirects on error; do not conflate empty UI with zero assigned work |
| Driver Route Map | Both map routes use `DriverRouteMapPage` → `DriverRouteMapPanel` → `DriverRouteMapPlaceholder` | Stops derive from dispatch records, but drawn positions are fixed CSS coordinates. Navigation links open Google Maps search/directions. This surface is not an embedded live Google map |
| GPS capture | `LocationUpdateButton` in `components/features/driver/driver-trip-list.tsx` | Explicit button calls `getCurrentPosition` once then `recordStaffLocationSnapshotAction`; no `watchPosition` found. This component is mounted in the dedicated driver root's desktop branch; do not infer mobile capture parity |
| Location persistence | `src/lib/actions/location-actions.ts` | Validates coordinates; resolves own active staff; checks assignment as therapist/driver, home-service and nonterminal booking; inserts `staff_location_snapshots` and revalidates driver/CRM/Manager views. RLS is an additional required deployed boundary |
| Map consumers | OpsMap, TrackingMap, `getActiveTripsForOpsMap`, dispatch queries | Separate Google Maps integrations and latest snapshots already exist. LiveOpsPage polls every 30 seconds. SDK-loading polling is not GPS synchronization. Provider keys, billing, restrictions, freshness and device behavior remain unverified |
| Shared refresh | Staff Today booking subscription, attendance subscription, notification Realtime; server revalidation | Selected subscriptions exist. No evidence here certifies continuous/background driver telemetry, cross-device convergence, reconnect recovery or offline delivery |

Source anchors: [portal actions](../../src/app/(dashboard)/staff-portal/actions.ts), [dispatch queries](../../src/lib/queries/dispatch-queries.ts), [driver root](../../src/app/(dashboard)/driver/page.tsx), [driver trip list](../../src/components/features/driver/driver-trip-list.tsx), [location actions](../../src/lib/actions/location-actions.ts), [map panel](../../src/components/features/staff-portal/driver/map/driver-route-map-panel.tsx), [map placeholder](../../src/components/features/staff-portal/driver/map/driver-route-map-placeholder.tsx), [map view model](../../src/components/features/staff-portal/driver/map/driver-route-view-model.ts), [operations map polling](../../src/components/features/ops-map/live-ops-page.tsx), [tracking map](../../src/components/features/tracking/tracking-map.tsx).

## 7. Notifications and local state

NotificationSettingsDialog asks permission only after an explicit Enable click, registers the root-scoped push worker, subscribes with a public VAPID key, and saves through `/api/notifications/push/subscription`. The route enforces an API context, role mapping, same-origin mutation checks, limited JSON parsing, schema validation and configured-push checks; database RLS remains necessary. Its supported role mapping is owner/CRM/staff/driver/utility, not every workspace role.

The database stores `web_push_subscriptions`, delivery preferences and workspace notification/workflow records. Server delivery resolves targets and updates subscription delivery state. The worker sanitizes action destinations, displays push cards when appropriate, reconciles visible windows, and attempts subscription renewal. Existing tests cover worker routing/deduplication and other push contracts. This is implemented plumbing, not verified provider/device delivery.

Browser localStorage is used for sound preferences, notification handled IDs, login preference and staff edit drafts. None is production authority. Do not persist private operational records in a future cache without an approved lifecycle and access model. The old cleanup worker and existing push scope must be traced before changing service-worker ownership.

Sources: [settings dialog](../../src/components/features/notifications/notification-settings-dialog.tsx), [subscription route](../../src/app/api/notifications/push/subscription/route.ts), [delivery](../../src/lib/notifications/push/delivery.ts), [notification Realtime](../../src/components/features/notifications/use-workspace-notification-realtime.ts).

## 8. Data and production dependencies

| Domain | Existing authoritative representations in source |
| --- | --- |
| Staff/access | Supabase Auth; `staff`, branches, role/capability helpers; `staff-pictures` Storage |
| Schedules/services | Staff schedules/overrides, blocked time, `services`, `branch_services`, `staff_services`, branch resources |
| Attendance/scanner | `qr_points`, `qr_scan_events`, `staff_shift_checkins`, `staff_devices`, activation/registration/recovery, attendance rules/settings/exceptions/corrections/closing interventions and transactional RPCs |
| Driver/service work | `bookings`, assigned staff/driver, resources, service-session/progress RPCs, `staff_location_snapshots`, customer tracking links |
| Notifications | Workspace notification/workflow records, `web_push_subscriptions`, `notification_delivery_preferences`, server push service and Realtime |

Runtime dependencies include request cookies and Auth, correct server/public environment configuration, deployed schema/RPC grants/RLS, Storage permissions, Realtime publications, schedule/timezone configuration, HTTPS/device permissions, and external map/push providers. Their current live state is unknown.

131 local migration files are tracked. The newest filename is `20260906150500_stage03_customer_read_rls_reconciliation.sql`; local files and generated types cannot certify applied history. No database tooling, replay, repair, push, reset, type generation or connection was performed.

**REPOSITORY-RECORDED PRODUCTION EVIDENCE**: [earlier Web C1 truth](../03-CURRENT-SYSTEM-TRUTH.md) records historical schema reconciliation, 84 intentionally unmarked older local-only versions, unavailable live database verification in that task, and historical public-domain observations. [production safety](../05-PRODUCTION-SAFETY.md) records production-connected `main`. [Stage 09A evidence](../30-delivery/STAGE_09A_EVIDENCE.md) records repository contract work and verification boundaries. These records are not independent production verification by PWA-C1; old dates, counts and results must not be represented as current live facts.

## 9. Existing tests and safe future replacement paths

No tests were added or changed. The handoff distinguishes selected suites actually run from inventory-only evidence.

| Seam | Existing tests found | Safe path after explicit stage authorization |
| --- | --- | --- |
| Workspace/roles | `tests/lib/auth/workspace-access.test.ts` | Retain server grants, isolate shell changes, verify direct routes and role/type combinations before changing navigation |
| Scanner | `tests/app/attendance/public-scan-route.test.ts`, identity, continuation, transaction, scan-error/resolution tests under `tests/lib/attendance/`; PublicScanProcessor component tests | Adapt camera decoding to the existing server scan contract, preserve cookies/operation IDs/audit semantics, verify allowed/blocked/duplicate/recovery paths in a known target |
| Attendance / remote checkout | `tests/lib/staff-portal/attendance.test.ts`, `tests/lib/attendance/smart-dynamic-clock-out.test.ts`, correction/recovery tests | Reconcile legacy shift actions, QR and portal intents first; preserve canonical records/RPCs and server eligibility, then test real target policies before rollout |
| Service / driver progress | `tests/lib/home-service-tracking.test.ts`, `tests/lib/bookings/exact-service-session-lifecycle.test.ts` | Keep shared transition contracts; isolate role-specific presentation; validate assignments, terminal states, timestamps and operational refresh |
| Map / GPS | Home-service state tests and branch-location validation tests exist; no dedicated driver live-map/device suite found in the searched test inventory | Preserve snapshot writer and all consumers; prove permission, freshness and reconnect behavior before replacing placeholder or adding continuous capture |
| Notifications | Worker, delivery-targeting, subscription-schema, settings-dialog and Realtime/dedupe tests under `tests/lib/notifications/` and `tests/components/notifications/` | Preserve root worker lifecycle, same-origin routing, subscription ownership and dedupe; add environment/device evidence only in an authorized stage |
| Install/offline/utility | No dedicated PWA install/offline-outbox/utility execution test suite identified | Establish approved scope first; do not infer implementation from icons, banners or planned module labels |

## 10. Unknowns carried forward, without starting PWA-C2

These are investigation seams, not ranked defects, selected fixes, final scope or implementation authorization:

1. Exact approved role/scanner/attendance/remote-checkout/live-map specifications have not been supplied as repository artifacts in this task.
2. No installed-PWA manifest/flow found; legacy cleanup worker and push-worker coexistence need lifecycle analysis.
3. No in-app camera decoding found; preserve existing attendance/room/resource server scan logic.
4. Multiple attendance mutation paths and a write-capable attendance read need policy/side-effect diagnostics.
5. Driver and utility proxy/page/navigation grants differ in places; role-based reachability needs target-aware verification.
6. Driver map is a placeholder; single-shot GPS exists in a separate driver component; provider configuration, mobile parity, background tracking and synchronization remain unproven.
7. Offline banner copy does not establish universal write blocking or durable synchronization.
8. No current production/deployment/device/database evidence; historical migration and enforcement limitations remain.
9. Marketing governance has inherited contradictory paragraphs; PWA authorization is scoped explicitly and does not resolve that unrelated workstream's acceptance history.

**PWA-C1 stops here.** Review this truth map under the documentation gates. The owner subsequently authorized committing and pushing these completed review artifacts only (PWA-GOV-002). PWA-C2, feature implementation, cleanup, migration work, production access, merge and release certification remain unauthorized.
