# Staff PWA native Driver workspace handoff

**Status: CORRECTION REQUIRED for release evidence.** The supported Driver UI implementation and source checks are ready for independent review. Authenticated runtime, mobile viewport and physical-device evidence are missing; do not merge or deploy from this handoff.

## Authority, ancestry and scope

- Owner brief: “CRADLEHUB STAFF PWA — SHARED NATIVE FOUNDATION + DRIVER ROLE IMPLEMENTATION” and the supplied Driver mobile concept. The repository remains authoritative over concept-only behavior.
- Parent branch: `stage/staff-pwa-native-foundation-utility`, exact reviewed parent SHA `a02881def75362ae4ccda5b9b731b075d66887c6`. New local branch: `stage/staff-pwa-native-foundation-driver`. Implementation commit: `1cea1a6`. Final branch HEAD also includes this handoff.
- Accepted `origin/main` and live GitHub `main` remained `3f8f4067c4c9e0e3e2122b97d4d0694fac0dbb20` on 2026-10-12. Provider PR #19 and Utility PR #20 remain unmerged dependencies. Driver work is stacked on both.
- Authorized files changed: canonical `/staff/driver/*` route adapters, Driver-only native components and pure presentation model, canonical Driver shell and shared safe-memory/loading extensions, targeted Start Travel invalidation, affected tests, and this handoff/`AI_CONTEXT.md`. No manifest, proxy, scanner, service worker, booking action contract, dispatch assignment logic, RLS, migration, payment, pricing, Provider or Utility screen redesign.
- Build and HTTP target: **LOCAL** placeholders at `127.0.0.1:54321`, with no database available. **PRODUCTION** was not accessed or mutated. No production deployment or branch merge was performed.

## Inspected Driver route and authority map

| Surface      | Repository authority                                                                      | Canonical implementation                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today        | `/staff/driver`; `getMyDriverJobsAction`, business date and optional attendance snapshot  | Native Driver header, real Today/Completed/Remaining counts, current or next assigned trip, short trip list and truthful attendance scan entry.                                                                |
| Trips        | `/staff/driver/trips`; `getMyDriverAllJobsAction`                                         | Today, future upcoming and recent completed filters, assigned-trip rows, in-session filter choice. History is the existing bounded 30-day past / 14-day future query, not an all-time record.                  |
| Trip detail  | `/staff/driver/trips/[bookingId]`; `getMyDriverJobByIdAction`                             | Server-scoped job, customer/service/destination/schedule, current state and real timestamps, Start travel or Mark arrived only when appropriate.                                                               |
| Map          | `/staff/driver/map`; `getMyDriverJobsAction` and existing `buildDriverRoutePageViewModel` | Next stop, assigned stop list, recorded destination, recorded ETA when available and external Maps directions. The repository's map panel contains no route geometry; the canonical UI states that explicitly. |
| More/Profile | `/staff/driver/more`; existing profile, attendance, notices and Driver routes             | Supported destinations, account summary and in-scope `/staff/login` sign-out.                                                                                                                                  |
| Scan         | `/staff/scan`; existing `StaffQrScanner`                                                  | Shared attendance/public-code scanner and deliberate document navigation preserved. It is labeled as attendance, not customer service check-in/out.                                                            |

`loadDriverWorkspace` requires an authenticated active Driver staff record and a branch, then passes that branch and staff ID into `getDispatchData`. Driver reads are restricted to assigned `driver_id`, that branch, `home_service`, and confirmed/in-progress/completed bookings. Detail uses the same scoped query with booking ID. A missing or failed query is an error, not a false empty trip list. The normal booking progress action refetches booking and actor and rechecks branch, assigned driver, Home Service and transition validity before its privileged RPC. No cached view state authorizes a mutation.

## State, map and location contracts

- Actual Home Service progress: `not_started → travel_started → arrived → session_started → completed`. This Driver role may request only the first two transitions. The assigned provider owns session start and completion; no Driver completion, return-trip or route-end action was added. Booking terminal state and recorded timestamps are displayed read-only.
- Dispatch presentation maps confirmed assigned work to `ready`, then `in_route`, `arrived_at_customer`, `service_started` and `completed` from booking status/progress. The UI does not rename the stored state or mutate dispatch separately.
- The existing Driver map has a route-view model, recorded destination, optional stored ETA, location snapshot read and external Google Maps URL, but no embedded map geometry or turn-by-turn engine. Canonical Map preserves external navigation. Start Travel completes server validation before handing off to Maps; Mark Arrived remains a separate action.
- A separate legacy Driver trip list has opt-in `navigator.geolocation.getCurrentPosition` and `recordStaffLocationSnapshotAction`; this branch does not alter its permission flow or add GPS tracking. No tracking token is copied into the new canonical UI.

## Shared foundation and safe memory

- Canonical Driver uses `StaffCanvas`, shared Staff cards, status chips, segmented controls, touch-sized buttons, compact bottom navigation and existing scanner isolation. The legacy `/driver` and `/staff-portal` shells remain on their prior presentation path.
- Identity-keyed memory adds only `driverToday`, `driverTrips` and `driverMap` count summaries plus the selected Trips filter. Each summary remains capped at four short count/label pairs, expires after five minutes and stays in memory only. Foreground/reconnect refresh follows the foundation's 30-second stale threshold. Successful travel/arrival invalidates those three Driver summaries and refreshes server data; unrelated Provider and Utility summaries are untouched.
- Customer phone, address, exact coordinates, notes, QR results, route geometry, tracking tokens, auth tokens, payments and authorization decisions are not stored in safe memory. The scanner's full-document navigation can remount and clear this memory; no persistence across that handoff is claimed. There is no offline mutation queue.

## Concept features intentionally omitted

No customer QR service check-in/out, manual service QR code, embedded turn-by-turn map, route termination, vehicle management, Driver performance screen, note editing, customer phone/call action, automatic/background live-location tracking, return-trip state, or Driver-owned service completion was added. Existing detail authority deliberately returns `notes: null`; the concept's example notes and phone number are not production content. No new mapping provider, dispatch layer or booking transition was created.

## Verification actually performed

- **436 focused tests / 50 files passed:** Staff PWA, Driver role/route/query/action/assignment/branch boundaries, booking progress, Home Service, map model, scanner shell, memory identity, navigation and new native UI tests. Historical `.claude` worktrees were excluded.
- `pnpm type-check`: PASS. Scoped ESLint: PASS. Scoped Prettier: PASS. `git diff --check`: PASS.
- Optimized Next.js production build with **LOCAL** placeholder service variables: PASS; canonical Driver routes generated. The first sandboxed build failed on the known Windows SWC path canonicalization permission issue; the identical placeholder build passed with filesystem access.
- Read-only **LOCAL** HTTP: `/staff` 308 → `/staff/`; unauthenticated `/staff/` and Driver Today, Trips, detail, Map and More each 307 → `/staff/login`; `/staff/login` and `/manifest-staff.webmanifest` returned 200. No authenticated database-backed request or operational mutation was made.

## Evidence limits, rollback and next permitted action

- **AUTHENTICATED DRIVER RUNTIME — NOT VERIFIED.** No authorized safe TEST/STAGING Driver account/database was available. Driver login, Today → Trips → detail → Map → More → Today, assignment changes, real progress mutations, background refresh and external navigation require that environment.
- **MOBILE VIEWPORT EVIDENCE — NOT VERIFIED** for authenticated Driver screens at 360×800, 390×844 and 412×915. Source/build tests do not prove visual overflow, touch reachability or map-panel layout on device.
- **PHYSICAL DEVICE VERIFICATION — NOT VERIFIED.** Installed standalone launch, scanner document-navigation round trip, address bar behavior, map-app handoff and foreground/reconnect behavior need device evidence. No performance gain is claimed without timings.
- Next permitted action: independent review of the local stacked Driver branch, then safe non-production authenticated and physical verification. Reconcile with accepted Provider/Utility results and current `origin/main` before any later merge proposal. If abandoned before merge, leave or discard the local branch; no production rollback is needed.
- Next role recommendation, only after separate owner authorization and accepted prerequisites: inspect CRM / General Staff against the shared foundation and repository contracts. This handoff does not authorize that implementation, merge, production deployment or production-data mutation. No branch push was performed; preview environment isolation should be checked before any review publication.
