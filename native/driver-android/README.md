# CradleHub Driver — Android Native Navigation Foundation

**Status: native foundation in accepted Web main, but not verified on real driver devices or certified for distribution.**\n\nFor the separately signed TEST-only installation pipeline and driver distribution gates, see [PILOT-INSTALLATION.md](PILOT-INSTALLATION.md). The Chrome-installed PWA does not contain the native Android SDK.

## Why this exists

Keep CradleHub's existing Next.js Driver PWA, Supabase permissions and CRM workflow as the source of truth. Add a small Android companion that presents the existing Driver workspace inside a restricted native WebView and opens Google's **native Navigation SDK 8.1.0** as a full-screen in-app turn-by-turn navigator.

This avoids pretending the Google native Navigation SDK runs in the browser. It also avoids a second database, new attendance policies, direct client service-role access or replacing the current Web/PWA.

## What is implemented

- Isolated Android Gradle application using **AGP 9.0.1, Gradle 9.1.0, Java 17, compile/target API 36, minimum API 24**, Google Navigation SDK **8.1.0**, Firebase Android BOM **35.1.0** and Firebase Messaging.
- Native Driver workspace at `https://www.cradlewellnessliving.com/staff/driver`. The WebView is restricted to that origin, requires HTTPS and has no injected JavaScript-to-native bridge.
- Driver views their booking in the existing authenticated workspace. When the canonical `/staff/driver/map?bookingId=<uuid>` is active, **Open live navigation** launches the native Navigation UI. An untrusted booking UUID is never interpreted as authorization or a destination.
- The native app makes a one-hop same-origin HTTPS GET to `/api/staff/driver/native-itinerary` with its WebView session cookie. This server endpoint reuses the existing driver-specific assignment query. It requires confirmed/in-progress, currently assigned driver, `travel_started`, `in_route`, branch identity and reviewed destination coordinates. It returns only the single current authorized stop, no names, notes, payments, credentials or additional upcoming trip destinations.
- Native SDK renders the route, provides voice guidance and rerouting, and observes Google arrival callbacks. **The callback does NOT write a booking status.** Next-stop sequencing remains a separate approved release task because a driver may be waiting for the Home Service session to finish after reaching the first customer.
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
6. Sign in as a driver in the native CradleHub workspace. Choose an assigned **confirmed** Home Service booking and tap **Start travel** in CradleHub. Open its route page then **Open live navigation**. The server must re-verify the booking before the native map starts.

**Do not run an end-to-end test on live bookings without an approved TEST setup.** The endpoint is read-only; the existing PWA Start travel button is a real booking mutation.

## Explicit limitations / decisions to freeze

- **No native Android APK or real-device test was produced in the repo-authoring environment.** GitHub Actions is the first independent compile check; its exact run and SHA must be recorded. A successful Android compile does not prove Firebase delivery, Navigation key authorization, voice, GPS or CRM arrival accuracy.
- Native Google Maps Navigation SDK for Android 8.1.0 requires a suitable Google Cloud project and device. Google Navigation is paid per destinations requested, subject to free usage, quotas, billing and Terms of Service.
- Native WebView does not share Android browser/standalone PWA cookies. Drivers must sign in once **inside this companion**. Google OAuth may disallow embedded WebView sign-in; if driver authentication depends on Google OAuth, STOP for an approved system-browser/PKCE design before release.
- **Firebase console project creation is not Android app registration.** `google-services.json`, app signing fingerprint and Android Navigation restricted API key have not been verified.
- Firebase Messaging receiver alone will not deliver production push. No FCM token writer, sender, retry or opt-out is implemented; existing Web Push remains unchanged.
- Arrival callback is local, read-only evidence. Auto-updating server booking status must be authorized and verified with anti-spoofing, accuracy, dwell time and server-side assignment/branch checks. Never auto-start/end massage sessions or attendance.
- Multi-stop onward navigation and schedule prioritization must preserve existing confirmed appointment and Home Service dispatch semantics. Google supports up to 25 waypoints but **this safe foundation intentionally requests one active stop**.
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
