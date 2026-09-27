# PWA-C1 — Current-System Truth Map

Inspection date: 2026-09-11. Correction date: 2026-09-12. Workstream: CradleHub Staff PWA. Status: **C1 external review — PASS; owner accepted and merged into `main` at `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`**. The technical evidence below is preserved as historical C1 evidence; it is not release certification. Authority and roadmap: [project governance](PROJECT.md).

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

All implementation findings below are **VERIFIED REPOSITORY FACT** unless explicitly qualified. A present route, permission check, RPC call, SQL policy, test, or UI label proves source presence only. Sections 11 and 12 distinguish those facts from owner-approved product direction and proposed safe paths; their classifications and future-work columns do not authorize implementation or certify runtime behavior.

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
| Existing intent routing | `QrPointType` includes `attendance`, `room`, `resource`; scan engine sends attendance points to `processAttendanceScan`, other points to `processRoomScan` | Already contains context-specific intent logic; do not replace it with an independent client attendance/session engine |
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

## 10. Unknowns carried forward from PWA-C1

These are investigation seams, not ranked defects, selected fixes, final scope or implementation authorization:

1. Approved role/scanner/attendance/remote-checkout/live-map product direction is supplied and durably recorded in PROJECT.md. Exact engineering contracts remain deferred to PWA-C3/C4; current implementation compliance is not established by approval alone.
2. No installed-PWA manifest/flow found; legacy cleanup worker and push-worker coexistence need lifecycle analysis.
3. No in-app camera decoding found; preserve existing attendance/room/resource server scan logic.
4. Multiple attendance mutation paths and a write-capable attendance read need policy/side-effect diagnostics.
5. Driver and utility proxy/page/navigation grants differ in places; role-based reachability needs target-aware verification.
6. Driver map is a placeholder; single-shot GPS exists in a separate driver component; provider configuration, mobile parity, background tracking and synchronization remain unproven.
7. Offline banner copy does not establish universal write blocking or durable synchronization.
8. No current production/deployment/device/database evidence; historical migration and enforcement limitations remain.
9. Marketing governance has inherited contradictory paragraphs; PWA authorization is scoped explicitly and does not resolve that unrelated workstream's acceptance history.

## 11. Owner-approved PWA feature matrix

This consolidates the evidence already gathered in sections 3–9 against **PROJECT DECISION — OWNER APPROVED DIRECTION** in [PROJECT.md](PROJECT.md#approved-product-constraints). It is a C1 inventory and comparison, not a C3 scope freeze or implementation authorization. Current owner means the owning code subsystem and authoritative data, not an inferred human owner.

Classification meanings: **EXISTS** = the named artifact is present in source; **REUSE** = preserve the existing authority/contract as the PWA foundation; **MODIFY** = an existing surface needs adaptation to the approved direction; **NEW** = no implementation of the named surface was found in the inspected source; **BLOCKED** = evidence is insufficient to choose a safe path, or the approved V1 constraints prohibit it. None means production/device verification. Exact future engineering contracts remain deferred even for REUSE/MODIFY/NEW rows.

| Feature | Current repository state | Classification | Current owner/source of truth | Required PWA work | Risk / blocker |
| --- | --- | --- | --- | --- | --- |
| PWA install manifest / standalone shell | No manifest/install flow found; responsive Web shells exist (§5) | NEW | Root Web metadata and existing staff shells | Add installation/standalone integration around one Staff PWA in a later stage | Installed launch, scope, session and device behavior unverified |
| PWA icons | 192/512 manifest-named PNG assets exist (§5) | EXISTS | `public/manifest-icon-192.png`, `public/manifest-icon-512.png` | Verify suitability and wire approved manifest references later | Asset presence does not prove complete platform icon support |
| Service worker ownership | Root-scoped push worker plus old unregister/cache-clearing worker (§5, §7) | MODIFY | `cradlehub-push-sw.js`, `sw.js`, notification registration | Define compatible ownership/upgrade lifecycle while preserving push | Old registrations/cache users and upgrade behavior need evidence |
| Online/offline indicator | Banner/network hook and selected write guards exist (§5) | MODIFY | `useNetworkStatus`, OfflineBanner; server result remains authority | Align indicator and action feedback with online-first/no false success direction | Browser online signal is not server reachability; universal blocking unproven |
| Authentication | Cookie-based Supabase Auth and active-staff lookup exist (§3) | REUSE | Supabase Auth; proxy/request clients | Preserve session/auth contracts for installed entry | Installed-session lifecycle not tested |
| Staff role resolution | Four portal modes plus workspace grants exist (§3) | REUSE | `getStaffPortalMode`, `staff`, workspace-access helper | Reuse canonical role/type resolution | Display mode must not become permission authority |
| Capability/authorization boundary | Page/action checks, assignment/branch checks and RPC/RLS dependencies exist (§3–6) | REUSE | Server actions, permission helpers, deployed RLS/RPCs | Preserve server authorization independently of QR/UI | Live policies and exact PWA capability matrix unverified/deferred |
| Role-aware mobile navigation | Basic, therapist and driver navigation exists; primary role routing differs (§3–4) | MODIFY | Mobile shells and workspace grants | Adapt navigation to one primary Scan action and approved groups | Driver/utility links and grants require reconciliation |
| Therapist mobile Home | TherapistMobileHome consumes bookings and schedule (§3–6) | MODIFY | Staff Portal actions; assigned bookings/schedule | Adapt existing Home to approved scan/service-provider direction | No responsive/device acceptance evidence |
| Salon/service-provider experience | Service types share therapist mode (§3) | MODIFY | Mode derivation and existing booking/service authority | Adapt shared experience for approved provider group | Exact capability/label differences deferred; no new role grants inferred |
| CRM/General Staff experience | Basic/CRM staff mode and personal views exist (§3–6) | MODIFY | Basic views; own staff/schedule/attendance records | Adapt personal role UI and Scan access | Must not expose full CRM/admin functions through personal mode |
| Utility experience | Role-gated Coming Soon page; no task execution established (§4, §6) | BLOCKED | Utility page; existing staff/workspace authority | Define permitted personal Utility interactions before adapting surface | Detailed allowed Utility interactions/access mapping missing; speculative task backend excluded |
| Driver experience | Dedicated root plus shared staff-portal driver children (§4, §6) | MODIFY | Driver pages, shared dispatch/portal actions | Consolidate role experience around active trip/map direction | Duplicate consumers, navigation grants and mobile parity unresolved |
| Universal in-app camera scanner | No camera decoder/primary camera action found (§4–5) | NEW | Future capture UI; existing scan server stays authority | Camera reads QR; send to existing server resolution contract | Real-device permissions/decoding and cancellation/error behavior unverified |
| Automatic QR intent resolution | Server dispatches attendance versus room/resource points (§5) | REUSE | QR points, scan engine and server attendance intent logic | Adapt one Scan entry to existing server routing; no staff intent picker | Unknown/unauthorized QR handling and replay must remain server-controlled |
| Attendance QR | Public QR route, processor and transaction exist (§5) | REUSE | `qr_points`, scan engine, scan transaction | Preserve QR entry/contract while adding camera entry later | Existing identity, branch, duplicate and audit semantics must survive |
| Registered Attendance device/browser | Device cookies, registry and continuation/recovery exist (§5) | REUSE | Server device registry and credential checks | Preserve registration/trust/recovery model | Installed/browser credential continuity not verified |
| Clock-in | Attendance scan and parallel shift action exist (§5) | REUSE | Server attendance intent/transaction; check-in records | Reuse valid-next-action and server-time authority | Parallel widget/QR policy parity needs later diagnostics |
| Clock-out | QR, direct shift action and restricted portal RPC coexist (§5) | REUSE | Server attendance records and controlled RPCs | Preserve server-determined action; keep service completion separate | Eligibility/policy parity and current live behavior unverified |
| Remote off-site End Shift | Controlled portal action and remote-related methods exist (§5) | MODIFY | `commit_attendance_portal_clock_out`; attendance/device/work state | Adapt separate audited intent considering clock-in, active/remaining work and capability | Exact eligibility/capability contract deferred; not a fake branch scan |
| Service Start QR | Room/resource route calls service-start RPC (§5) | REUSE | Scan engine; `start_booking_service_session` | Adapt existing start contract to universal scanner | No service-end QR in V1; start must not alter attendance authority |
| Service-progress state machine | Validated progress and start/complete-session RPC paths exist (§6) | REUSE | Booking/service state machine and server RPCs | Preserve transitions and server-confirmed completion | Completion must not automatically clock out |
| Schedule | Personal schedule/week queries and views exist (§4, §6, §8) | REUSE | Staff schedules, overrides, blocked times; server queries | Consume existing schedule facts | Timezone, overrides and freshness remain verification seams |
| Notifications/push | Notification records, Realtime, settings and push worker/delivery exist (§7) | REUSE | Workspace notifications, subscriptions/preferences, server delivery | Reuse plumbing with approved role-aware behavior | Provider/device delivery and worker coexistence unverified |
| Driver trip workflow | Assigned trips and server travel-progress actions exist (§6) | MODIFY | Bookings/driver assignment; dispatch and progress actions | Adapt active-trip controls to map-centered UX | Existing transition authority must survive; no offline success |
| Google Maps navigation handoff | View model builds external search/directions links (§6) | REUSE | Dispatch destination and map view-model URLs | Preserve navigation handoff in approved trip UX | Link construction is not verified real-device navigation |
| Driver Route Map | Shared map panel renders fixed-position placeholder (§6) | MODIFY | Driver map components; dispatch records | Replace placeholder under later approved live-map stage | Provider setup, accurate positions and lifecycle not verified |
| Driver GPS acquisition | Explicit one-shot `getCurrentPosition` in separate trip-list component (§6) | MODIFY | Browser sensor input; server validates booking/staff context | Adapt acquisition to explicit active-trip lifecycle and consent | No continuous watcher found; mobile/background behavior unproven |
| Location persistence | Snapshot action validates/records location (§6) | REUSE | `staff_location_snapshots`; location actions and RLS | Preserve existing server persistence and assigned-trip boundary | No second authority store; live RLS and freshness need verification |
| CRM Live Map consumer | Existing operations map reads snapshots; LiveOpsPage polls 30 seconds (§6) | REUSE | Operations map/actions; bookings and latest snapshots | Connect PWA location through existing backend/consumer | Exact current consumer freshness/permission behavior not live-verified |
| Continuous/live driver synchronization | Snapshot reads, one-shot capture and selected refresh exist; continuous convergence unproven (§6) | BLOCKED | Existing snapshot/dispatch/operations consumers | Establish publish/consume/freshness/reconnect contract later | Missing sustained cross-client evidence and accepted synchronization contract |
| Background driver tracking reliability | No verified background tracking behavior (§2, §6) | BLOCKED | Browser/platform lifecycle; authoritative server acceptance | Prove explicit active-trip tracking on real devices or stop for architecture decision | Missing background/suspension/battery/network evidence; pure-PWA feasibility unknown |
| Offline authoritative writes | No durable operational outbox found; server remains authority (§5, §7) | BLOCKED | Existing server transactions | None in V1; keep Attendance/service/trip/checkout online and server-confirmed | Owner-approved exclusion; an offline queue is not an authorized gap to fill |
| Customer-data minimization | Assigned booking/dispatch views contain customer/destination data (§4, §6) | BLOCKED | Existing booking/dispatch/tracking queries and access boundaries | Define minimum per-role fields and permitted exposure later | C1 has no complete field-by-field payload/cache/push/location retention inventory or minimization proof |

## 12. Consolidated subsystem map

This table reuses the source anchors in sections 3–8 and test inventory in section 9. Writes and side effects describe existing code paths, not actions executed during this correction. Tests listed as partial or not established are not substituted for integration/device evidence. Safe PWA paths require later stage authorization.

| Subsystem | Source of truth | Consumers | Writes | Authorization boundary | Side effects | Existing tests | Safe PWA path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication | Supabase Auth; active `staff`; request clients/proxy (§3) | Workspace routes, API/action callers, scan login | Session cookies; scan login can continue device/scan flow | `auth.getUser`, active staff, workspace checks; APIs enforce own contract | Session refresh/redirect; scan continuation can proceed to operational writes | `tests/lib/auth/workspace-access.test.ts` covers grants; full session integration not established | Reuse identity/session authority; verify installed lifecycle later |
| Role/mode resolution | `staff.system_role`, `staff_type`; canonical helpers (§3) | Staff shells, driver/utility routes, navigation | No writes in mode/grant derivation | Server workspace/action checks; mode is presentation | Chooses shell and destination; differing links/grants affect reachability | Workspace-access suite; dedicated mode/device coverage not established | Reuse resolution, adapt navigation without granting capabilities in UI |
| Scanner | QR points, scan engine, device/server intent (§5) | Public processor/API/actions, attendance and room scans | QR events, device/continuation state, attendance or service-start transaction | Auth/device identity, QR purpose, branch/resource/assignment checks; privileged server path | Registration/recovery, exceptions, branch correction, revalidation | Public-scan route/processor; identity, continuation, transaction and error tests (§9) | Add capture UI over existing server contract; keep QR separate from authorization |
| Attendance | Check-ins, settings/rules, schedules, devices; attendance RPCs (§5) | Staff/driver summaries, QR processor, CRM/Owner Attendance | Clock-in/out, audit/events, exceptions/recovery, policy recalculation | Server identity/device/branch/eligibility; RLS and restricted RPCs | Revalidation/Realtime refresh; even data-loading helper can recalculate policy | Staff attendance and smart-dynamic-clock-out suites; correction/recovery inventory | Preserve valid-next-action, server timestamps and separate audited End Shift; reconcile parallel paths later |
| Booking/service progress | Bookings, assignment, delivery type; progress/session RPCs (§6) | Provider progress/countdowns, driver travel actions, operations | Start/complete session and permitted progress transitions | Assignment/role, terminal status, valid transition, server/RPC checks | Timestamps and operational revalidation; timers do not authorize completion | `tests/lib/bookings/exact-service-session-lifecycle.test.ts`; home-service state suite | Reuse transition authority; adapt Service Start; no automatic attendance clock-out |
| Schedule | Staff schedules/overrides, blocked time; server queries (§6, §8) | Staff Home/schedule/week, attendance policy, operations | Existing scheduling domain owns changes; personal views consume records | Request staff/branch/capability boundaries plus deployed RLS | Schedule changes can affect attendance policy and displayed readiness | `tests/lib/staff-portal/week.test.ts` found; full schedule integration not established here | Reuse personal schedule reads; keep schedule administration outside PWA scope |
| Dispatch | Bookings, driver assignment, branch resources; dispatch queries/actions (§6) | Driver jobs, CRM/Manager dispatch/control, maps | Driver assignment and shared permitted trip-progress actions | Branch/operator permissions and own assigned-trip checks | Staff/driver/operational refresh; feeds map/tracking state | Home-service state suite; no end-to-end dispatch assignment evidence from C1 | Reuse backend workflow; adapt map-centered trip controls |
| Driver location | Server-accepted snapshots linked to staff/booking (§6) | Driver/dispatch, operations map, customer tracking | Location action inserts `staff_location_snapshots` | Valid coordinates, own active staff, assigned active home-service booking, RLS | Server path revalidation; customer/operations consumers see latest snapshots | Branch-location validation inventory only; no GPS/device suite established | Reuse persistence; add explicit trip lifecycle only after reliability contract/evidence |
| CRM Live Map | Active-trip/bookings queries and latest location snapshots (§6) | Existing CRM/operations map and trip list | No location write path established in inspected map consumer; reads through operations action | Existing request/branch access and RLS; live enforcement not verified | 30-second polling replaces displayed trips; Google SDK renders positions | No dedicated Live Map integration/device suite found in C1 inventory | Preserve consumer; prove PWA-to-backend-to-map freshness/permissions before claiming synchronization |
| Notifications | Workspace notifications/workflow records; subscriptions/preferences (§7) | Staff/driver/CRM/Owner UI, Realtime and OS cards | Record/workflow responses, subscription/preferences, delivery state | API context, supported role, same-origin/validated mutations; recipient/RLS and delivery targeting | Push delivery, toasts, dedupe, destination navigation, subscription renewal | Worker, settings, schema, delivery-targeting, Realtime/dedupe suites (§9) | Reuse pipeline; reconcile root worker lifecycle and minimize exposed data |

**PWA-C1 stops here.** The reviewed artifact was originally committed at `590f2db526588c998a7a147eb126d379f2311877`, corrected for external review, accepted, and merged into `main` at `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`. PWA-C2 is separately authorized on `stage/pwa-c2-structured-diagnostics`; feature implementation, cleanup, migration work, production access, merge and release certification remain outside the C2 authorization.
