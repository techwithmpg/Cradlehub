# CradleHub Driver — native Android candidate

The current candidate uses Kotlin and Jetpack Compose for **Today | Trips | Scan | Map | More**. No WebView is constructed. CameraX and bundled ML Kit handle QR capture; the existing Google Navigation SDK 8.1.0 owns the native map, voice and routing. The Driver PWA remains intact as a fallback.

Status: **LOCAL EMULATOR VERIFICATION / RELEASE CORRECTION REQUIRED**. See [the current handoff](../../docs/reports/DRIVER-NATIVE-COMPOSE-HANDOFF-2026-11-17.md) for evidence, screenshots and remaining gates. No staff distribution, main merge, production activation or deployment is authorized.

## Architecture and authority

`NativeDriverActivity` owns Compose and a persistent native SDK fragment. `NativeDriverModel` retains presentation state and refreshes existing authenticated contracts. `NativeDriverBackend` uses Supabase password authentication, verifies the user, stores refresh credentials in AndroidKeyStore-backed encrypted private preferences, and sends the existing SSR cookie wire format to the existing Driver/attendance APIs. No password is retained. No new backend, privileged key, database or local business-status writer is introduced.

Tap a trip to open Map directly. The server resolves the current authorized leg. Start explicitly authorizes travel and begins guidance. End route stops guidance only. GPS never establishes boarding, therapist service completion or attendance. Existing pickup/delivery/service/collection/return/drop-off checks remain server-owned. No second attendance scan is introduced: arrival up to 120 minutes early is retained, credited time starts at scheduled shift start.

Profile, attendance, service history, durable notifications and support are native destinations. History labels completed **service**, without pretending that collection/return is complete. Authentication currently supports existing email/password credentials; an OAuth-only account needs a separately reviewed system-browser/PKCE flow.

## Local emulator UI verification

Use JBR 21 with the installed Gradle 9.6.0 / Android SDK toolchain. AGP 9.0.1 provides built-in Kotlin; Compose compiler is 2.2.10, compile/target 36, min 24. From the repository root:

```powershell
gradle -p native/driver-android --no-daemon `
  -PCRADLE_DRIVER_DEBUG_ORIGIN=http://localhost:7100 `
  -PCRADLE_DRIVER_LOCAL_TEST=true `
  -PCRADLE_NATIVE_UI_FIXTURE=true `
  -PCRADLE_NAVIGATION_API_KEY=LOCAL_TEST_NOT_CONFIGURED `
  :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug
```

The debug fixture requires the `.localtest` package, has a visible UI TEST brand and synthetic identities, and refuses operational API calls. Its class exists only in `src/debug`. It proves rendering and local interactions, not connected business acceptance. Never distribute this fixture APK to drivers. Normal builds default to inert `UNCONFIGURED` targets; there is no sample-data fallback in release sources.

Install the local app/test APKs only in the disposable emulator, then run:

```powershell
adb -s emulator-5580 shell am instrument -w -r com.mpgtechnologies.cradlehub.driver.localtest.test/androidx.test.runner.AndroidJUnitRunner
```

Optional debug-only capture intents accept `fixtureScreen` Today/Trips/Scan/Map/More. Use the full activity component `com.mpgtechnologies.cradlehub.driver.localtest/com.mpgtechnologies.cradlehub.driver.NativeDriverActivity`. For the disconnected Map fixture, pass synthetic `bookingId=11111111-1111-4111-8111-111111111111`. Routing/ETA/turns are deliberately unavailable without verified backend authority and a restricted Navigation key.

## Connected TEST configuration — pending owner identification

Use existing approved TEST resources only; never paste secrets into chat. Set outside the repository:

```properties
CRADLE_NATIVE_TARGET=TEST
CRADLE_NATIVE_API_ORIGIN=https://APPROVED_TEST_API_HOST
CRADLE_NATIVE_SUPABASE_URL=https://APPROVED_TEST_PROJECT.supabase.co
CRADLE_NATIVE_PUBLIC_KEY=APPROVED_PUBLISHABLE_OR_ANON_PUBLIC_KEY
CRADLE_NAVIGATION_API_KEY=ANDROID_RESTRICTED_TEST_KEY
```

Production hosts and privileged keys are rejected at build time and runtime. Unknown targets are a stop condition. No TEST resource has been selected for connected acceptance yet. No existing `.env` or live staff session was reused. Optional Firebase `app/google-services.json` must match the separately approved TEST package/signing configuration; it is ignored by Git. Existing FCM token registration remains inactive without that configuration. Migrating to the newer Firebase Installation ID contract would require a separately reviewed backend change.

## Verification and release limits

Run native tests, lint, debug/test APK builds and release source compilation. Real-device acceptance must cover sign-in/refresh/logout/revocation, QR decode and duplicate retry, offline/reassignment, accurate GPS, voice/reroute, background/resume, camera lifecycle, notifications/opt-out and two-session CRM parity. The earlier 22 disposable LOCAL TEST SQL scenarios remain evidence for the unchanged preceding candidate, not proof of connected Supabase parity.

[Controlled pilot gates](PILOT-INSTALLATION.md) remain open. The older hybrid workflow is superseded; do not run its signed-artifact workflow for this candidate until native TEST configuration is explicitly wired, reviewed and accepted. Self-review is not external acceptance. Rollback before acceptance is to park this branch and retain the existing app/PWA; no runtime database change needs reversing.

## Primary references

- [Android AGP built-in Kotlin](https://developer.android.com/build/migrate-to-built-in-kotlin)
- [CameraX image analysis](https://developer.android.com/media/camera/camerax/analyze)
- [ML Kit QR scanning](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
- [Navigation SDK setup](https://developers.google.com/maps/documentation/navigation/android-sdk/setup-overview)
- [AndroidX test releases](https://developer.android.com/jetpack/androidx/releases/test)
