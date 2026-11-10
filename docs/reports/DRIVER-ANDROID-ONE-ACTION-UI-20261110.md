# Driver Android + Staff PWA — one-action route UI (isolated review)

Date: 2026-11-10 Asia/Manila

## Authority and scope
- Owner requested: notification tap should open the assigned route; one **Start Trip** action starts travel/navigation; arrival should end the driving leg automatically. Minimize driver work and eliminate competing native/PWA controls.
- **Target:** CradleHub Web Staff Driver PWA plus Android-only companion. Not Desktop.
- **Branch:** `stage/driver-single-action-route-ui-20261110`, created from accepted main `47b456d46fd5b492080ae0037cb0393ae696ca89`.
- **Repository evidence:** PR #95, #96, #97 show as merged in connected GitHub. The prior #97 description still says DRAFT / CORRECTION REQUIRED and says no device test was done in its authoring environment. Owner subsequently supplied Windows Android Studio build, ADB installation/login and real-phone Staff PWA screenshots; they are **user-reported local tests**, NOT production navigation/Firebase verification. Reconciling past merge/release approvals remains a governance task.
- No production DB, schema, RLS, Auth, booking payment, attendance or deployment changes are authorized by this UI pass.

## Current-system ownership and consumers
- Staff Driver PWA `/staff/driver` and `/staff/driver/map?bookingId=...`: authoritative server queries `getMyDriverJobsAction`, `getDriverDispatchSnapshotAction`, `getMyDriverJobByIdAction`.
- Existing `updateBookingProgressAction` (server + DB RPC) remains the only Start Trip writer. Driver assignment, branch, booking progress and status continue to be validated by the server and database.
- Android `DriverShellActivity`: authenticated same-origin WebView. No JavaScript bridge; a URL query/notification booking ID is a selector, never a permit. Native screen re-reads one verified `travel_started` + `in_route` itinerary through a private server endpoint.
- Google Navigation SDK `NativeNavigationActivity` owns voice guidance and navigation callbacks. No direct database or service-role key in Android.
- Browser PWA is retained as a fallback; the existing combined map / GPS-to-CRM logic is not deleted. Other staff roles, attendance and legacy Driver URLs remain untouched.

## Proposed / implemented presentation flow in this review branch
1. Assignment push **tap** loads `/staff/driver/map?bookingId=...`. A foreground web push and the native FCM pending intent both route there. Android handles repeat taps with `onNewIntent`.
2. The PWA route looks up the currently authorized assigned trip and shows **one simple route preview**, destination and a single **Start Trip** button (or **Resume Navigation** if already traveling). The old combined map is not shown in the focused route.
3. Start Trip calls existing `updateBookingProgressAction(... nextStatus: "travel_started")`. Only on successful server acknowledgement does it request the special same-origin `nativeNavigation=1` URL.
4. Android WebView intercepts that exact verified-shape URL and launches Google native guidance. The native itinerary API re-authorizes the booking and only then supplies coordinates. Standalone browser PWA follows the existing combined map as fallback; no external Google Maps deep link is required.
5. When Google SDK reports reaching the final destination, Android **stops guidance and clears destinations** automatically, with no additional driver tap. This is local UI/navigation state only.

## Explicit limitations — NOT yet delivered
- **Automatic booking arrival confirmation is NOT implemented.** A GPS/Google arrival callback is not sufficient evidence to write `booking_progress_status=arrived`. Needs owner-approved minimum accuracy, dwell, drift/spoof handling, cancellation/reassignment, offline retry, authenticated server validation, audit trail, and tested idempotency. Never automatically complete the massage/service/payment or attendance.
- **Native push is NOT active**: FCM receiver foundation exists, but staff-bound token registration/revocation and authorized server sender do not. UI deep links work **when a notification is delivered**; this change cannot guarantee delivery.
- No real-device Google guidance, voice, end-of-route callback or two-session CRM tracking acceptance test has been performed for this branch. No live booking should be mutated just to test.
- If native Android is updated without corresponding Web UI, the one-tap intent is not sent. Coordinate a preview/TEST rollout and version compatibility before any release; keep existing production experience intact.
- Existing driver attendance scan is available under More → Attendance QR scan and never doubles as a trip action. Attendance authorization, schedule and scan rules are unchanged.
- Native Google SDK attribution/terms, billing, release signing and driver distribution still require release gates.
- No speculative auto-acceptance of trip ownership: CRM assignment remains the server source of truth.

## QA and release gate
- Run `pnpm type-check`.
- Run `pnpm exec vitest run tests/lib/pwa/driver-native-itinerary.test.ts tests/lib/pwa/driver-focused-trip-ui.test.tsx tests/lib/pwa/driver-android-navigation-contract.test.ts tests/lib/pwa/driver-single-shell-contract.test.ts tests/lib/pwa/driver-native-ui.test.tsx`.
- Run targeted ESLint on changed TypeScript/TSX files.
- Build `gradle :app:assembleDebug` on Java 17/Android SDK 36 without production credentials.
- Inspect exact branch/base/head SHA, changed file list and CI job logs. A passing CI test is **not** phone/browser/native/production verification.
- TEST-only acceptance: open native FCM test notification on cold/warm Android app; expired/reassigned/cancelled/offline booking; duplicate taps; successful Start Trip and native guidance; GPS denied; native return; browser PWA fallback; driver arrival while stationary; CRM two-session readback; branch isolation and no booking service/payments/attendance side effects.
- Rollback: do not merge/deploy branch; undo staged UI and Android APK in TEST separately. Production untouched by authoring.

**Release status:** REVIEW / CORRECTION REQUIRED until exact-head checks, independent review, owner approval and device/CRM acceptance.
