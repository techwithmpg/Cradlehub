# Android Staff Shell — review handoff — 2026-11-10

- **Owner direction:** Reuse current Staff PWA login and operational logic, preserve iPhone PWA, build a more polished Android shell for all four staff groups; do not reimplement booking/payment/attendance state.
- **Target:** Android app only, isolated repository review branch. Production Web and production database **untouched**.
- **Branch:** `stage/staff-android-shell-20261110`.
- **Base:** accepted Web main `4383a27d59f2b3d1de509e3ade3c1bd436cf69cf`.
- **Changed scope:** `native/driver-android` Java WebView shell, launch policy, splash/loading/retry layout, manifest permissions, Gradle origin setting, unit tests, shell docs and native QA workflow.
- **Preserved consumers:** existing Driver FCM receiver -> DriverShellActivity; existing NativeNavigationActivity -> WEB_ORIGIN + authenticated native itinerary API; existing Staff Portal `/staff/` -> server role router; PWA login, booking, scanner, attendance, notification and session logic untouched.
- **Auth / source of truth:** session remains HTTPS WebView cookies; all server-authorized Web actions and RLS remain authoritative. The native app selects no role, validates no booking, performs no offline mutations.
- **Native support:** Android WebView camera and Geolocation callbacks accept only configured origin; camera grants only VIDEO_CAPTURE, no microphone or unknown WebView resources. Android chooser supports uploads; standard secure HTTPS and contact links use external OS handlers without sharing WebView cookies.
- **Driver handoff:** only canonical, explicit route `/staff/driver/map?bookingId=...&launch=native` triggers existing native SDK. The server must still authorize assignment/status and destination.
- **Checks:** request CI Android Gradle :app:testDebugUnitTest/:app:assembleDebug and existing Web driver contract suite, plus real TEST-device role/camera/file/link/back/navigation checks. A successful compile does not prove phone or production behavior.
- **Known release blockers:** native role-device acceptance, push FCM registration/sender, OEM WebView PWA compatibility, Web OAuth if used, Android app signing/package identity, Google Nav SDK key/terms/attribution/device capability, performance baseline, external independent review and owner approval.
- **Production status:** NO production deployment, SQL, RLS/Auth change or service credential modification. **No Android device/window evidence asserted.**
- **Rollback:** close review PR; no Web rollback or DB rollback needed.

- **Safety correction:** Review APKs use the intentionally inactive `https://staff-review.invalid` origin unless the builder explicitly configures an owner-approved TEST origin. Live production URL is never silently selected for a CI debug APK.
