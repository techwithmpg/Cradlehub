# CradleHub Driver — Android Native Navigation Foundation

**Status: isolated review branch only. Not release-ready.**

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

## Preview the focused Driver UI on a USB-connected Android phone (DEBUG ONLY)

The Android companion normally loads `https://www.cradlewellnessliving.com`.
A newer Web/PWA review branch will therefore **not** appear in the installed APK
unless its WebView uses a separate test origin. To see the Driver UI without
deploying Web to production:

1. On the isolated review branch, start Next.js using a **LOCAL/TEST Supabase
   environment**, never production accounts/bookings for mutation testing:

   ```powershell
   Set-Location E:\cradlehub-driver-android
   pnpm install --frozen-lockfile
   pnpm exec next dev -p 7100
   ```

2. In another terminal, with one authorized physical device attached:

   ```powershell
   $ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $ADB devices -l
   & $ADB -d reverse tcp:7100 tcp:7100
   & $ADB -d reverse --list
   ```

3. Use Android Studio's bundled Java for the build and pass the **explicit**
   debug-only origin flag:

   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
   Set-Location E:\cradlehub-driver-android\native\driver-android
   .\gradlew.bat :app:assembleDebug -PCRADLE_DRIVER_DEBUG_ORIGIN=http://localhost:7100
   & $ADB -d install -r ".\app\build\outputs\apk\debug\app-debug.apk"
   & $ADB -d shell am force-stop com.mpgtechnologies.cradlehub.driver
   & $ADB -d shell monkey -p com.mpgtechnologies.cradlehub.driver -c android.intent.category.LAUNCHER 1
   ```

4. The debug APK loads `http://localhost:7100/staff/driver` through USB
   reverse forwarding. **Localhost is the phone's forwarded USB loopback**,
   not a publicly reachable host. Android's debug-only network security config
   permits cleartext for exactly `localhost`, with cleartext denied elsewhere.
   Authentication must be an authorized TEST account. Never change real trips
   or check out real customers for this preview.

5. Disconnecting USB or stopping the Next.js server makes this test APK unable
   to load its Web UI. To return to the ordinary app, rebuild WITHOUT the
   `-PCRADLE_DRIVER_DEBUG_ORIGIN` property and reinstall. Release builds
   always use the production HTTPS origin and never accept the flag.

Do not paste `google-services.json`, the Navigation API key, tokens, or
`.env.local` into chat or commit them to Git.
