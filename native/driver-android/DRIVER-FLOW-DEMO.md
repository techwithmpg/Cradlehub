# Android Driver Flow Demo — UI review only (2026-11-10)

This DEBUG-only native Android Driver Flow Demo implements the owner-approved low-tap UI concept without changing live Staff Portal bookings, attendance, or dispatch logic.

## Preview behavior
- Debug APK exposes a second launcher entry labeled Driver Flow Demo, using the same accepted Staff PWA launcher icon. The existing CradleHub Staff launcher remains unchanged.
- Today: one sample next trip and Start navigation.
- Trips: Today / Upcoming / Completed, each sample trip card goes DIRECTLY to the Navigation screen.
- Navigation: an illustrative route map, not Google Navigation or live GPS. Arrived shows only a demo confirmation.
- Arrival: demo-only completion and next sample trip; never submits booking progress.
- More: Open real Staff Portal and Reset demo.
- Native tabs require no network; only the demo screen, demo filter, and fixture index are stored in private Android SharedPreferences. No personal information, cookies, credentials, GPS, booking UUID or authorization state is persisted.
- Existing driver Navigation SDK, server-side booking actions and native-itinerary API are left intact. No operational writes in the demo.

## Local PowerShell
Source branch: stage/driver-native-flow-preview-20261110, based on stage/staff-android-shell-20261110 at 79c76c9591f6678ee606631b5ed95c6bd7ed7746.
Copy the four new debug/test files into your local working branch without resetting modified Gradle or strings files. Build using existing Android Studio JBR and Gradle wrapper:

    $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
    Set-Location 'E:\cradlehub-staff-android-review\native\driver-android'
    .\gradlew.bat :app:testDebugUnitTest :app:assembleDebug '-PCRADLE_STAFF_ORIGIN=https://staff-review.invalid' --no-daemon

The intentionally inactive Staff origin allows the native DEMO to run safely without a production connection. Build with an authorized TEST origin only when testing the real authenticated Staff Portal.
Do not install over the accepted Driver app. Verify the generated APK applicationId ends with .staffpreview, matching your existing local debug package suffix, before installing.

## Limits and release gates
- UI interaction prototype with explicitly labeled fixtures, not operational trips, not live Google navigation, and not proof of production performance.
- Existing Staff Portal uses WebView auth; this demo has no independent authentication or permission model, and cannot be used for real assignments.
- Required: focused Gradle unit tests + build, real Android device tap/restore/screenshot, session check for the unchanged Staff Portal, and independent review.
- Real integration later requires a reviewed server-authorized atomic Start Travel request that revalidates driver, assigned booking, branch, state and destination; reject stale/unassigned trips; server-confirm arrival. Never trust UI cache to authorize.
- No SQL/Auth/RLS/Web changes; no main merge or production deployment.

Evidence: docs/reports/DRIVER-NATIVE-FLOW-PREVIEW-20261110.md.