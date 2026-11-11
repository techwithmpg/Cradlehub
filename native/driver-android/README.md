# CradleHub Driver — Android Native Navigation Foundation

**Status: isolated review branch only. Not release-ready.**

## Why this exists

Keep CradleHub's existing Next.js Driver PWA, Supabase permissions and CRM workflow as the source of truth. Add a small Android companion that presents the existing Driver workspace inside a restricted native WebView and opens Google's **native Navigation SDK 8.1.0** as a full-screen in-app turn-by-turn navigator.

This avoids pretending the Google native Navigation SDK runs in the browser. It also avoids a second database, new attendance policies, direct client service-role access or replacing the current Web/PWA.

## What is implemented

- Isolated Android Gradle application using **AGP 9.0.1, Gradle 9.1.0, Java 17, compile/target API 36, minimum API 24**, Google Navigation SDK **8.1.0**, Firebase Android BOM **35.1.0** and Firebase Messaging.
- Native Driver workspace at `https://www.cradlewellnessliving.com/staff/driver`. The WebView is restricted to that origin, requires HTTPS and has no injected JavaScript-to-native bridge.
- In draft PR #104, selecting an assigned trip (or tapping a native assignment notification) opens the existing native Navigation screen directly. One explicit **Start Navigation** tap begins guidance; the read-only route preload cannot change booking status. The native host still requires a valid signed-in driver session and rechecks assignment server-side. A booking ID is never authorization.
- The native app GETs `/api/staff/driver/native-itinerary` with its WebView session cookie. This read is allowed for a verified confirmed/in-progress driver-assigned trip either ready to start or already travelling; it returns only one authorized verified stop, never customer names, notes, payment details or further assignments. On **Start Navigation**, it POSTs `/api/staff/driver/native-start`; the existing server-authorized booking-progress RPC rechecks the driver, branch, assignment and allowed transition. Resuming also revalidates the assignment.
- Native SDK renders the route before guidance, and provides voice guidance, rerouting and native GPS arrival callbacks **after Start**. **The arrival callback does not write a booking status or confirm the therapist's service.** The currently authorized itinerary still contains only one stop; valid multi-stop and pickup sequencing remain unimplemented pending server dispatch policy.
- FirebaseMessagingService is registered and displays a generic notification with an opaque booking ID if a valid, correctly targeted FCM message is received. Firebase token registration and server sender are intentionally **not active**, because they require an authenticated staff-bound device registration design.
- Runtime notification and precise-location permissions use normal Android prompts.

## Install and configure locally

1. Open `native/driver-android` in Android Studio (current SDK/API 36 tools; Gradle 9.1.0; Java 17).
2. **Provisional Android application ID**: `com.mpgtechnologies.cradlehub.driver`. Owner must approve this permanent package ID **before Firebase registration**.
3. In Firebase Console **Cradle Massage Wellness Maps** (`cradle-massage-wellness-maps`), select **Add app → Android**, register the **exact accepted app ID**, and download `google-services.json` into `native/driver-android/app/`. This file is locally ignored; do not commit it or any Firebase Admin SDK credentials.
4. In Google Cloud **the same project**, enable **Navigation SDK for Android**, configure billing/quota alarms, generate a key restricted to the **Navigation SDK API** + Android app package name **and the actual debug/release signing certificate SHA-1**. Do not reuse an unrestricted Web/browser key. Store it **outside the repo** in `~/.gradle/gradle.properties`:

   ```properties
   CRADLE_NAVIGATION_API_KEY=YOUR_ANDROID_RESTRICTED_KEY
   ```

5. Build `gradle :app:assembleDebug`. For normal testing, install via Android Studio on a real Android device with Google Play services and accurate GPS. Terms of Service consent and Google attributions/legal screens must be accepted/implemented before any release.
6. Sign in as a driver in the native CradleHub workspace. Tap a confirmed assigned trip to open the native route. Tap **Start Navigation** once to request the existing authorized travel transition and start voice guidance. Do not simulate this with a live booking; use isolated TEST data and a signed-in Android device.

**Do not run an end-to-end test on live bookings without an approved TEST setup.** The endpoint is read-only; the existing PWA Start travel button is a real booking mutation.

## Explicit limitations / decisions to freeze

- **No native Android APK or real-device test was produced in the repo-authoring environment.** GitHub Actions is the first independent compile check; its exact run and SHA must be recorded. A successful Android compile does not prove Firebase delivery, Navigation key authorization, voice, GPS or CRM arrival accuracy.
- Native Google Maps Navigation SDK for Android 8.1.0 requires a suitable Google Cloud project and device. Google Navigation is paid per destinations requested, subject to free usage, quotas, billing and Terms of Service.
- Native WebView does not share Android browser/standalone PWA cookies. Drivers must sign in once **inside this companion**. Google OAuth may disallow embedded WebView sign-in; if driver authentication depends on Google OAuth, STOP for an approved system-browser/PKCE design before release.
- **Firebase console project creation is not Android app registration.** `google-services.json`, app signing fingerprint and Android Navigation restricted API key have not been verified.
- Firebase Messaging receiver alone will not deliver production push. No FCM token writer, sender, retry or opt-out is implemented; existing Web Push remains unchanged.
- Arrival callback is local, read-only evidence. Auto-updating server booking status still requires an approved server-side anti-spoofing, accuracy, dwell-time and assignment/branch policy and an isolated TEST database run. Never auto-start/end massage sessions or attendance.
- Multi-stop onward navigation and schedule prioritization must preserve existing confirmed appointment and Home Service dispatch semantics, therapist service readiness, vehicle capacity and pickup-before-drop-off. **This foundation intentionally requests one active stop.** Google SDK waypoint support alone is not proof of validated multi-stop dispatch.
- iOS requires a separate native SDK integration and Apple distribution arrangement; this Android foundation is not an iOS PWA upgrade.
- Google Navigation SDK legal NOTICE/LICENSE documents and first-run terms/warnings must be surfaced to drivers and independently verified before release. Do not alter or hide Google's navigation turn cards or safety UI.
- The **Web** and **Desktop** tracks do not share automatic authorization. This is a separately owned **Android** foundation; no Desktop migration or new Web workstream is authorized by it.

## Quality and rollback

- Server: `pnpm type-check`, `pnpm exec vitest run tests/lib/pwa/driver-native-itinerary.test.ts`, targeted ESLint.
- Android: isolated `gradle :app:assembleDebug` without production keys; no APK upload or production device registration.
- Required follow-up: signed-in Android phone + CRM two-session acceptance, Google API terms/key billing/quota validation, notification token ownership and revocation, OAuth sign-in path, arrival policy acceptance and native app signing/distribution plan.
- Rollback before merge: close the unmerged PR. No schema, production data or deployments to reverse.
- No automatic `main` merge; review and owner approval required.

## Official references

- https://developers.google.com/maps/documentation/navigation/android-sdk/setup-overview
- https://developers.google.com/maps/documentation/navigation/android-sdk/android-studio-setup
- https://developers.google.com/maps/documentation/navigation/android-sdk/release-notes
- https://developers.google.com/maps/documentation/navigation/android-sdk/multi-destination
- https://developers.google.com/maps/documentation/navigation/android-sdk/policies
- https://firebase.google.com/docs/android/setup
- https://firebase.google.com/docs/cloud-messaging/android/get-started
