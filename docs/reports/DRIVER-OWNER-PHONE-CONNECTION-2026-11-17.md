# Driver owner-phone connection — 2026-11-17

**PARTIAL ACCEPTANCE: native UI and authenticated production reads work; live Maps remains blocked by key authorization.** No release/independent-review PASS is claimed.

## Authorization and source

The owner requested full-area native Map, removal of its UI TEST header, the same PWA app icon, and a real system test. After discovery found only the existing production project, the owner explicitly selected **“Connect my phone to the existing production system.”** That is a narrow personal-client exception to earlier TEST-only instructions. It does not authorize server deployment, SQL installation, a main merge/push or general staff distribution. Required Maps client configuration is within this connection scope.

- Branch/worktree: `stage/driver-native-compose-20261117`, `E:/cradlehub/.worktrees/driver-native-compose`.
- Accepted main/fetched origin/main: `51ba200580068691a0358323e00c8c4a7a8de11e`, unchanged.
- Previous owner-phone installation head: `971789416d0d37761d6b9b252446a8b401b60105`.
- Native implementation head: `30218cde2f6795500e15272c164af68fe4753591`.
- [Exact native implementation files](driver-owner-phone-2026-11-17/implementation-files.txt). Changes are native Android/README and governance/evidence only. No Web/API/SQL/public-asset/package-lock source changes from the preceding head.
- Later evidence-only closeout HEAD can be resolved with `git rev-parse stage/driver-native-compose-20261117`.

## Implemented and installed

Map omits the brand header, rounded upper content inset and opaque “No trip selected” cover. Its native Google SDK pane fills the available area between Android system insets and the persistent bottom navigation. Without a trip, a compact View trips action overlays the map; no disabled destination/footer consumes space. With a trip, the SDK retains its safety/attribution/turn UI and the existing trip footer. The fragment is initialized on entering Map even without a selected trip and remains attached across ordinary tabs. No fake map, turn, ETA or route was added.

The launcher directly copies `public/staff-pwa-icon-512-gold.png` and the maskable512 asset, byte for byte, with native adaptive-icon XML and safe insets. Manifest icon/roundIcon references are installed in the owner APK. Existing public PWA assets were not modified.

The debug-only production exception requires the exact accepted API/Supabase pair, explicit `CRADLE_NATIVE_PRODUCTION_OWNER_PHONE=true`, public client key and fixtures disabled. Release/pilot packaging through this exception is blocked. Unknown targets, production hosts labeled TEST, privileged keys, other production pairs and production fixtures remain rejected. No service-role/server key was embedded. Configuration is owner-managed outside tracked source.

The installed package is `com.mpgtechnologies.cradlehub.driver.localtest`, version `0.3.0-native-compose-review-owner-phone`, on RMX3081 / Android13 / API33. It updates the previous personal test package without uninstalling app data. `NATIVE_TARGET=PRODUCTION`, `NATIVE_OWNER_PHONE=true`, `NATIVE_UI_FIXTURE=false` were inspected in generated build metadata without printing keys. Signature verification passed. [Installed artifact SHA-256 and signing fingerprint](driver-owner-phone-2026-11-17/installed-artifact.json). Current APK SHA-256: `fab626563b9350ae17fd1bffc383f5d5297b0854c831f753a1938b47cc677509`.

## Existing deployed API compatibility

Unauthenticated public probes confirmed `/api/staff/driver/journeys`404, native-itinerary400 without a booking, and native-start405 for GET. Accepted main contains the latter two endpoints. No production contract was deployed to compensate for the missing new APIs.

On an explicitly missing/inactive journey API only, native reads use existing authenticated booking RLS scoped to the verified driver and branch, Home Service, confirmed/in-progress and the established recent/upcoming period. Destination and travel Start remain independently server-authorized by native-itinerary/native-start. Booking status is only a display projection; no pickup/collection stage is invented from a delivery booking. A401/403, arbitrary503, other server error or malformed successful journey response cannot trigger this downgrade. Pure tests cover the boundary and wrong-driver/branch/cancelled/location-review cases.

The full separate pickup/delivery/service/collection/return candidate remains uninstalled in production. Native-location/device APIs and full CRM GPS/push acceptance are also not live merely because the app is connected. The existing PWA remains intact. No attendance rules, device limits or feature activation changed; the client sends evidence to existing server policy rather than establishing payroll/shift authority.

Native QR now captures raw location **after** a recognized QR and normal precise-location permission. It cancels on leaving the activity, bounds the wait, and sends the existing latitude/longitude/accuracy/timestamp contract. The existing server owns geofence, device enrollment/limits, idempotency and attendance. No raw location is logged. Physical QR submission has not been performed by the assistant.

## Phone sign-in diagnosis and observed recovery

The owner reported sign-in failure although the same email/password worked in the PWA. Workstation public Auth settings checks returned200 with both existing public keys. Native diagnostics then showed `configured=true fixture=false` and `UnknownHostException` before an Auth request could complete. Android shell could not resolve Google/CradleHub/Supabase, although a public IP was reachable and the owner reported normal browser access. App Internet permission was granted.

The owner explicitly approved a temporary `dns.google` test with restoration on failure. Android rejected direct writes with WRITE_SECURE_SETTINGS permission denial. No permission grant, root attempt, certificate bypass or ACL change was attempted. Original Private DNS mode/specifier were subsequently re-read and matched exactly. The normal Settings screen was initially obscured by the phone lock screen; the owner unlocked it. Before any Settings UI change, the app recovered and authenticated reads succeeded, so no DNS change was needed or made. The cause of the transient Android resolver failure is not conclusively established.

Observed after recovery: native Sign in screen absent; Today/Trips/Scan/Map/More and On duty present; no loading/access failure label; Auth and RLS data responses200. The assigned-trip query succeeds, but real row contents/counts were not copied into evidence. No password was read, entered by the assistant, retained or requested in chat. No trip Start, attendance scan, live location sample or push was submitted by the assistant.

The diagnostic update distinguishes connection, secure-connection, Auth rejection, session-storage and verification errors. Logs contain only boolean configuration, HTTP channel/status and exception class names—no credentials, cookies, payloads, exact positions or staff/customer identifiers. [Safe phone diagnostics](driver-owner-phone-2026-11-17/phone-safe-auth-diagnostics.txt).

## Google Maps blocker and owner action

The existing owner-managed native Navigation key is configured and has the expected key format, but emulator SDK logs show INVALID_ARGUMENT/authorization failure for Maps/Navigation. The exact same package/signing identity is used on the owner phone:

- Android package: `com.mpgtechnologies.cradlehub.driver.localtest`.
- SHA-1: `0B:39:6A:DC:9D:FF:8B:D6:32:47:07:A4:63:6F:E4:9C:08:0D:3B:8B`.

Discovery confirmed the existing Google project `cradle-massage-wellness-maps`, number791453622688. Navigation SDK was enabled while Maps SDK for Android was absent. The owner-authorized connection work requested enabling `maps-android-backend.googleapis.com` and `apikeys.googleapis.com`; Google returned successful operation `operations/acat.p2-791453622688-7a0dbe46-3ea7-49b7-a2e9-e1efeab53686`. This successful activation request is **not** proof of working map authorization. A subsequent SDK check still failed.

Key metadata/IAM calls through the available local account were denied (service-use/key-management access). No IAM role was granted or key restriction weakened. A standard user-controlled Google authorization flow opened; an ADC-cache file write was refused by Windows, and no filesystem ACL/security setting was changed. Browser-control runtimes also could not initialize. The owner therefore opened Credentials themselves and supplied a screenshot showing **CradleHub Driver Navigation Android**, restricted to Android apps and one API. They were directed to edit that existing key, preserve existing app entries, add the package/SHA above, and allow Navigation SDK plus Maps SDK for Android. No key string was requested in chat or shown in evidence.

**Pending:** owner confirms the restrictions are saved; recheck live tiles on the synthetic emulator and then the phone. Do not claim a live map, route or guidance result until that evidence exists. [Key-redacted SDK diagnostics](driver-owner-phone-2026-11-17/owner-map-after-api-diagnostics.txt), [actual full-area native Map with key still rejected](driver-owner-phone-2026-11-17/map-full-area-key-blocked.png).

## Verification and practical limits

| Check | Evidence |
| --- | --- |
| Unit tests | **40 pass:** nine retained state +31 policy/target/compatibility/SSR/QR tests. [Summary](driver-owner-phone-2026-11-17/unit-results.json). |
| Fixture UI | **7/7 pass**,30.252s: prior six cases plus banner-free unobstructed empty Map. [Transcript](driver-owner-phone-2026-11-17/owner-phone-instrumentation.log). An earlier run was interrupted during manual capture and was not counted as a pass. The successful rerun completed before capture. |
| Fixture build/lint | Pass,0 errors/39 warnings. [Build](driver-owner-phone-2026-11-17/owner-phone-ui-validation.log). |
| Final owner build | Pass:40 unit tests, debug APK and lint. Subsequent changes after the fixture UI run were Auth errors/credential-free diagnostics/health check; layout unchanged. [Final build](driver-owner-phone-2026-11-17/owner-phone-production-build.log). |
| Physical installation | ADB success; native activity opened, final owner version confirmed; public Auth and authenticated Driver/RLS reads now succeed. No operational write acceptance claimed. |
| Icon/scope | Both copied icon files match existing PWA bytes; `git diff --check` passes. No Web/SQL source change from prior owner-phone head. |
| Live Maps | **FAIL / OPEN:** SDK rejects the current native key. No fabricated loaded-tile or route result. |
| Production full workflow | **NOT ACCEPTED:** uninstalled full journey/native-location/device APIs and physical guidance/voice/QR/CRM/push acceptance remain separate gates. |
| Independent review | **PENDING.** Self inspection, tests and owner browsing are not external acceptance. |

The original native handoff and prior22 disposable LOCAL TEST SQL scenarios remain historical evidence only; this task does not install/replay that package. Main remains production-connected and unchanged. No server release, SQL, Auth/RLS mutation, general APK distribution or real notification occurred. The Maps service activation request above is the explicit Google Cloud configuration change in this task.

The current permitted next step is to finish the owner-controlled Android key restriction correction and verify live rendering. Then perform separately scoped physical route/QR/CRM acceptance using current authority, without silently activating the new journey backend. To abandon this personal test, sign out through the app and park the branch; do not delete PWA data or disable shared Google services without impact review. No production server rollback is needed because no server code/schema was deployed.

Primary implementation references: [Navigation SDK setup](https://developers.google.com/maps/documentation/navigation/android-sdk/setup-overview), [GoogleMap interactions](https://developers.google.com/maps/documentation/navigation/android-sdk/googlemap-interactions-best-practices), [API key information](https://docs.cloud.google.com/api-keys/docs/get-info-api-keys).
