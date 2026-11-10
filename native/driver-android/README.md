# CradleHub Staff — Android shell (review only)

**Scope:** One locally installable Android app for the existing role-aware Staff Portal. This is a WebView-based **native Android shell**, not a separate native implementation of booking, attendance, QR or login business rules. The iOS Staff PWA is untouched.

## Behavior
- Launches the existing server-authorized `/staff/` entry point. The server resolves Driver, Provider, CSR/Front Desk and Utility roles and permissions; one staff account can only see its authorized workspace.
- Keeps exactly **one** on-screen navigation UI: the existing Staff Portal. Android adds a branded loading/offline/retry state, native system/back navigation, safe origin handling, Android camera permission for the existing QR scanner and the Android file picker for profile uploads.
- All booking/attendance/trip updates continue to use **existing Next.js server actions, RLS and authoritative server business rules**. No local queue, server bypass, device authority, or new DB.
- Preserves the existing native Google Navigation SDK for assigned Driver trips. Only the canonical `/staff/driver/map?bookingId=...&launch=native` handoff can open it; the native route requests server-verified coordinates and requires `travel_started`. An SDK arrival does **not** write booking progress.
- Restores the existing driver's FCM receiver but **does not** implement staff FCM token registration or production push delivery. Web Push is not a native Android notification channel in WebView. Do not claim background push works.

## Build locally (private installation, no Play listing)
1. Open `native/driver-android` in Android Studio with Android SDK 36, JDK 17, Gradle 9.1.0. Existing AGP/Navigation SDK dependencies are retained.
2. For isolated TEST/preview validation set `CRADLE_STAFF_ORIGIN=https://your-approved-test-host` in **local** `~/.gradle/gradle.properties`. The default is the production website. Never test mutations on production without explicit authorization.
3. Set `CRADLE_NAVIGATION_API_KEY` in that untracked Gradle properties file for native Driver navigation. The Android-restricted Google key, package name, SHA-1, terms/attribution and billing must be configured before a device navigation acceptance test.
4. Run `gradle :app:testDebugUnitTest :app:assembleDebug`, then install `app/build/outputs/apk/debug/app-debug.apk` manually on a TEST Android device. The PR workflow also retains a **review-only** debug APK artifact if compilation passes.
5. Sign in with an approved **TEST** staff account. Check role routing, login/logout, scan camera permission, profile file chooser, all four role workspaces, screen rotation/back, reconnect, notices, and single shell tabs. For drivers additionally verify assigned/not assigned and native navigation **only** with TEST bookings and approved Google configuration.

## Requirements and known limits
- This remains one WebView running existing Staff Portal UI. It preserves Web/PWA workflows; it does not provide equivalent standalone native Kotlin screens or guarantee faster measured performance. Benchmark on real devices before making performance claims.
- Existing Web sign-in/session cookies are scoped to this embedded WebView, not shared with Chrome's standalone PWA; Google OAuth can reject embedded WebView sign-in. Verify the configured staff email/password login or design authorized external-browser OAuth.
- Android WebView may not support the same browser push APIs as installed PWAs. **Native FCM staff token binding, targeted sender, retry/acknowledgment and foreground/background verification remain a separate authorized delivery requirement.**
- The existing package ID `com.mpgtechnologies.cradlehub.driver` is intentionally retained while owner approval of the permanent Staff app ID and current signed builds is pending. Do not install this preview over an accepted Driver APK until a migration/upgrade plan is approved.
- Private installation avoids Google Play listing, **not** Android application signing, Google API/Navigation license, staff data security, RLS, camera/location permissions or device testing.
- No APK, camera flow, push, native SDK routing, role authorization or Google API operation is claimed to work until exact CI output and physical TEST-device evidence are recorded.

**Rollback:** Do not merge the isolated review branch. Close its draft PR or revert its commit before an authorized native rollout. Web/iOS PWA, production databases and the existing Next.js routes are untouched.
