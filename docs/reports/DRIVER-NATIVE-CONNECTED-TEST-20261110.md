# CradleHub Driver Connected TEST — Android staging integration

**2026-11-10 | REVIEW ONLY | stage/driver-native-connected-staging-20261110**

## Authorized objective
Replace the Android demo's sample information with real authenticated staff assignments using the same CradleHub server booking rules; one tap on an assigned trip starts travel only after server verification, and then launches existing in-app Google Navigation SDK. Preserve Web, iPhone PWA and all other Staff Portal roles.

## Implementation and authority
- Adds two Next.js route handlers, enabled only if `NATIVE_DRIVER_CONNECTED_ENABLED=true` on the approved **TEST** deployment. Default is FALSE, including current production unless explicitly changed by an authorized release.
- `/api/staff/driver/native-workspace` (GET): validates Supabase `auth.getUser()` against the signed-in cookie; reuses `getMyDriverAllJobsAction` driver/branch-scoped query; returns only limited trip fields, no payment/location coordinates, no cache.
- `/api/staff/driver/native-travel` (POST): requires same origin, `X-CradleHub-Native: driver-v1`, JSON, UUID, verified authenticated session, assigned driver/branch, active booking and valid destination. It delegates Start Travel and manually confirmed Arrived to existing `updateBookingProgressAction` and its atomic database RPC, **not** a new writer. No CORS grants, no local DB shortcut.
- Android debug-only `Driver Connected TEST` Activity reads these endpoints through WebView's existing authenticated cookie jar and synchronizes server-issued session-cookie refreshes into WebView. No service-role secrets or additional credentials stored on phone. Real assignment lists are kept only in memory; last Today/Trips/More + Trips filter preferences are local presentation state, not authorization state.
- One trip tap: server Start Travel confirmation => existing NativeNavigationActivity => already-verified native-itinerary request => live Google SDK guidance. Reopening a still-travelling trip is idempotent.
- On final Navigation SDK arrival, Android shows **Confirm arrival**, but arrival requires a deliberate tap and the existing server role/state checks. GPS callback is NOT automatically accepted as database authority and no auto-arrival write is implemented.
- The existing `Driver Flow Demo` launcher and original `CradleHub Staff` launcher remain unchanged; this connected client adds a third **debug-only** launcher to compare native UI and working PWA. Other staff roles remain in the PWA.

## Setup and safe test gate
1. Use an approved TEST Next.js deployment with an isolated or explicitly safe TEST database and TEST staff driver account; verify no production booking/attendance can be mutated by the test.
2. Deploy this review branch **only after independent review** to that TEST environment. Add `NATIVE_DRIVER_CONNECTED_ENABLED=true` only on the TEST host. Do not enable on production to test phone UI.
3. Configure the Android build `-PCRADLE_STAFF_ORIGIN=https://<your-approved-test-host>` and `-PCRADLE_NAVIGATION_API_KEY=<ANDROID-restricted-key>` locally (not committed). Google Navigation SDK requires correct Android package+SHA-1 registration, licensing/terms/attribution, Maps and Navigation configuration and billable project.
4. Build `gradle :app:testDebugUnitTest :app:assembleDebug` from `native/driver-android`; locally retain the already-configured `.staffpreview` debug application ID suffix for side-by-side install. Do NOT install the CI artifact over the old Driver app: CI has the original package ID.
5. On the phone, launch `CradleHub Staff Preview`, sign in on the TEST host with a TEST driver account, return to `Driver Connected TEST`; confirm same driver's actual TEST assignments, Today/Trips tabs, one-tap Start→Google native navigation; GPS arrival→manual confirmation and CradleHub status updates only for TEST bookings.
6. Test no session, expired session, wrong branch/driver, cancelled booking, invalid GPS, double-click/reconnect, no Nav key, long trip list, logout, background/resume, Android navigation and multiple tabs; profile timings from tap until route guidance and tab transitions.

## Repository-only review evidence
- Base: `1c8f4e4aaaf313771210841bbb7dea1611fbacf7`, derived from Staff shell review, not merged into accepted `main`.
- Head / workflow / exact checks: record once CI passes; no DB, real device, external Google API, deployment or live booking verification is asserted.
- Files: 2 new server routes, new native connected UI and cookie transport, debug launcher, Google SDK arrival result handoff, tests, CI and this report.
- Rollback: leave PR unmerged and server feature flag OFF; preserve existing Staff app and original Driver app. No historical migrations or auth/RLS changes.

## Release blockers
Independent code/security review; approved TEST deployment/database, Android device and Google Navigation tests; session refresh and logout QA, native arrival correctness, failure recovery and performance evidence. No production use until these pass and owner approves release.