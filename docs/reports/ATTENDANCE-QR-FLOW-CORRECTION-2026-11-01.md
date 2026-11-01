# Attendance QR flow correction handoff — 2026-11-01

## Authority and scope

The owner requested a focused QR recognition and location sequencing correction, plus an independent audit of saved printed QR URLs. After the audit confirmed that refreshing a static QR URL could start a new attendance operation, the owner explicitly approved a separate fail-closed navigation change: direct/native-camera entry requires one attendance tap; Staff PWA camera decode can continue automatically using a short-lived one-use grant. Branch `fix/attendance-qr-flow-20261101` starts from accepted `origin/main` `aa30aa732351e9e81e567d189562f4ca815d5bd2`. Final candidate SHA is recorded with the pushed branch.

No database, QR point, printed code, geofence, device registration, attendance history, or server attendance authorization contract was changed. No production target was contacted or mutated.

## Root cause and corrected workflow

- `/staff/scan` previously waited for GPS readiness before mounting the camera. The camera now opens immediately. Previously granted GPS may prepare in parallel, but the processing page always obtains a new fix after QR decode. The decoded QR is single-shot; the server routing action normalizes its code before Staff navigation.
- `/staff/scan/process/[publicCode]` previously proceeded directly from a generic recognition animation to fresh GPS and the attendance API. It now shows QR recognition, location verification, attendance validation, and the actual result in that order. A Staff camera decode mints a signed, two-minute, user-bound operation grant in a path-scoped HttpOnly cookie. The processing page claims and expires that cookie in a Server Action before any location or attendance work. Missing, invalid, expired, mismatched, consumed, or stalled claims leave an explicit attendance action. A stalled claim exposes that action after eight seconds; late grants cannot auto-start it.
- `/scan/[publicCode]` is the native-camera/printed-link route. The phone camera has already recognized the QR, so it shows “QR code recognized” and one explicit “Record attendance” tap for attendance codes. This is the approved compatibility change for currently printed static URLs; no second QR scan is needed. Refresh, history, and bookmarked navigation remain inert until tapped.
- A location retry stays on the current page, obtains fresh GPS, and repeats normal server authorization with the same operation ID. The server still enforces freshness, accuracy, branch radius, assignment, device and idempotency controls. No client coordinates or grant can authorize attendance on their own.

## Verification and limits

- Focused QR, scanner, PWA shell, public scan, continuation, and error tests: 15 files, 109 tests passed after the final grant/timeout change.
- TypeScript and scoped ESLint passed. `git diff --check` passed.
- Full ESLint reported one unchanged baseline error in `tests/components/cash-flow/cash-flow-today-operations.test.tsx:162` (`no-explicit-any`) and 24 warnings outside this change.
- Independent read-only code review: **PASS** after correction of the first reusable-grant finding and the stalled-claim/early-tap paths; independent reviewer reran 40 focused tests.
- `next build --webpack` with Node 24 and isolated dummy TEST Supabase URL/keys (`test.invalid`) passed compilation, TypeScript, static generation, and route tracing. The unavailable dummy host produced expected fetch-failed logs during unrelated marketing prerender fallbacks. Default Turbopack build failed in the repository's known `next/font/google` resolver path; the Webpack build is the production-equivalent fallback. This is not production runtime verification.
- Local headless Chrome CDP check at a true 390×844 mobile layout, with an unconfigured local dev server: `/scan/att_browser_test` showed the recognized QR and one attendance button at 390px with no horizontal overflow; refresh returned the same inert screen; tapping after hydration opened the “Enable location for attendance” step. Zero `/api/attendance/public-scan` requests occurred before or after that tap. Browser and Playwright connector transports were unavailable, so this was a local Chrome CDP fallback. The screenshot evidence is stored outside the repository in the Codex visualization directory.
- Automated tests use mocked location, browser, and server behavior. No real installed Staff PWA, native camera, authenticated staff, or TEST/STAGING attendance database was available. Real-device acceptance is mandatory before operational sign-off.

## Remaining manual acceptance checklist

1. On a controlled installed Staff PWA for a test therapist and driver, open Scan Code at Main Spa and SM Branch. Confirm the camera opens without waiting for GPS, reads each currently printed code once, shows QR/location/attendance/result stages, and records exactly one authorized attendance transaction.
2. Exercise first-time location permission, denied permission, inaccurate/old GPS, outside-branch GPS, retry after moving on-site, and offline/slow grant claim. Verify clear guidance, fresh coordinates on retry, no branch-geofence bypass, and no duplicate transaction.
3. Scan a printed attendance QR with each phone's native camera. Confirm the single explicit attendance tap, no second QR scan, and the same server-authorized result. Refresh, use browser history, and reopen/bookmark both direct and Staff processing URLs before and after success/failure; verify no new attendance transaction without a new scan or explicit tap.
4. On a shared test phone, switch authenticated staff between scan and processing. Confirm the prior user's grant cannot auto-start an attendance action for the new user. Verify the two-minute expiry and device registration boundary.
5. Reconcile actual test attendance rows and scan events against the expected operation IDs, then record owner release approval before merge or deploy.

## Release and rollback

This branch is review evidence only. The next permitted step is owner-controlled real-device acceptance of Staff PWA and native-camera flows, followed by normal release approval. Merge, deployment, production migration, Cron operations, and live attendance tests are not authorized by this handoff. To roll back before merge, close the review branch. After an authorized merge, revert this correction commit through the normal reviewed release process; existing printed QR codes and attendance records need no data rollback.
