# CradleHub Driver — controlled Android pilot installation

**Status:** OWNER-APPROVED PREPARATION / **NOT READY TO DISTRIBUTE**  
**Date:** 2026-11-11  
**Scope:** Android package and review-only installation pipeline. No Web/CRM/Attendance/Payment or database implementation.  
**Baseline:** Web `main` commit `4c376a2dc798ec11614c7ed275a74f3a143adcfd`.  
**Stage branch:** `stage/driver-android-controlled-pilot-20261111`. No automatic merge/deploy.

## Why a separate install is required
The existing Chrome **Add to Home Screen** PWA cannot execute Google's Android Navigation SDK. Drivers need **one installed Android companion**, which embeds the existing Driver PWA in a restricted WebView and opens the already-developed Google Navigation activity. Web UI still updates from CradleHub normally; native code updates require a new Android package. A Chrome PWA shortcut cannot be converted or silently upgraded into an APK.

This pilot app installs **alongside** the normal Chrome shortcut and any future production Driver app:
- Package: `com.mpgtechnologies.cradlehub.driver.pilot`
- Name: **CradleHub Driver Pilot**
- Web source: owner-provided **non-production HTTPS** TEST environment, never the live `www.cradlewellnessliving.com`.
- APK must be signed with a **persistent private TEST signing key**, retained securely by the owner. Never commit a keystore, passwords, unrestricted Google keys, customer data or service-role credentials.

## Prerequisites / owner checklist

1. **Approve a real isolated TEST environment** (domain, backend identity, authorization, booking/service test fixtures). Do not point pilot at production, re-use production staff sessions, or enable development authorization bypass on a reachable site. If no tested backend exists, **STOP** before enabling an installable APK.
2. Approve the permanent production package ID separately; this pilot's `.pilot` ID is intentionally not the future store package.
3. In Google Cloud, enable **Navigation SDK for Android** with billing/quota alerts. Restrict the **pilot** API key to **Navigation SDK for Android** and the **pilot package ID plus SHA-1 fingerprint** of the signing certificate. Never use an unrestricted browser key. The API key will be embedded in the installed Android APK, so app+API restrictions are essential.
4. Create a stable pilot signing keystore **locally**, and back it up offline. Android Studio is optional; a JDK `keytool` is sufficient:
   ```shell
   keytool -genkeypair -v -keystore cradle-driver-pilot.jks -alias cradle-driver-pilot -keyalg RSA -keysize 3072 -validity 3650
   keytool -list -v -keystore cradle-driver-pilot.jks -alias cradle-driver-pilot
   ```
   Record the SHA-1 fingerprint (public certificate identifier). Do **not** share the private keystore or passwords in chat/PR/issues. Use this **same** keystore for every pilot update. An APK signed with a different key cannot update the already installed app normally.
5. On GitHub configure a protected **environment named `driver-pilot`** and require a human approval before its secrets can be used. Limit deployment branches to `main`. Grant the minimal people access to build downloads.
6. Put these values in that environment's **Secrets**, never in source files:

   | Environment secret | Value |
   | --- | --- |
   | `CRADLE_PILOT_WEB_ORIGIN` | Approved TEST HTTPS origin, no trailing path |
   | `CRADLE_PILOT_NAVIGATION_API_KEY` | Google Android-restricted navigation key for `.pilot` |
   | `CRADLE_PILOT_KEYSTORE_BASE64` | Base64-encoded contents of the **private** pilot .jks keystore |
   | `CRADLE_PILOT_STORE_PASSWORD` | Keystore password |
   | `CRADLE_PILOT_KEY_ALIAS` | Signing alias (e.g. `cradle-driver-pilot`) |
   | `CRADLE_PILOT_KEY_PASSWORD` | Private key password |

   On Windows PowerShell, to encode the keystore locally without printing it to chat:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\secure\cradle-driver-pilot.jks")) | Set-Clipboard
   ```
   Paste into GitHub's secret input and clear the clipboard. Protect the original keystore with offline backups. Avoid storing passwords in shell history.

## Safe GitHub build and APK retrieval

- **During PR review:** `CradleHub Driver Android TEST Pilot` compiles the pilot source *without secrets* and deliberately produces **no distributable artifact**. The existing native foundation QA continues separately. These compile checks are **not** a phone acceptance test.
- **Only after external review, separate owner merge approval and appropriate Web release gate:** the manual build workflow must first exist on accepted `main` (GitHub requirement). An owner selects **Actions → CradleHub Driver Android TEST Pilot → Run workflow**, on **main**, and enters `BUILD_TEST_APK_ONLY`.
- The job requires `driver-pilot` environment approval and validates all six secrets. It rejects production/invalid web origins and missing signing/Navigation credentials. No TEST server is contacted during build.
- It produces a signed, separate `app-pilot.apk`, verifies APK signature, prints SHA-256 + signer certificate fingerprints, and uploads a short-lived **3-day** GitHub Actions artifact for authorized reviewers. The artifact is not automatically sent to staff or published to Google Play/Firebase.
- The owner downloads the artifact ZIP from the successful **Actions run → Artifacts**, extracts `app-pilot.apk`, and retains the recorded SHA-256. Do not host an unauthenticated public APK link. Never send it to normal drivers before pilot/device certification.

**Important:** GitHub environment protection and secret access availability depend on repository visibility/plan; verify the settings actually enforce an approval gate. Do not treat selecting an environment name alone as proof of protection.

## First phone smoke test (TEST data ONLY)

1. Use a physical Android phone with Google Play services, accurate GPS, connectivity and staff-approved TEST credentials. Android Studio/USB are optional for installation; USB + `adb logcat` are helpful for diagnosis.
2. Open the authorized APK on the phone and approve installation from the chosen source only as needed. Confirm the installed icon says **CradleHub Driver Pilot**; the Chrome PWA shortcut remains unchanged.
3. Sign in *inside the Android companion*; Chrome PWA cookies are **not** reused. If sign-in requires unsupported Google OAuth within WebView, **STOP** and plan approved system-browser/PKCE authentication instead of weakening auth.
4. Using only isolated TEST assignments: open **Trips → assigned trip**; expect native Google Navigation immediately; tap **Start Navigation** once; inspect guided voice, GPS permissions, traffic rerouting, Back/resume and a clean return to the Driver PWA.
5. QR Scanner remains the existing Staff PWA scanner. Test that camera/attendance operations do not bypass server authorization.
6. Check that no native GPS arrival event automatically starts service, modifies attendance or payments. Native arrival currently does **not** safely write booking progress: this is an explicit **release blocker** for the full approved driver journey.
7. Test device rotation/resume, denied permissions, no-network, reassigned/cancelled TEST trip, failed API key authorization, and multiple devices. Capture exact Android build SHA, device model/API level, test booking IDs (redacted in reports), timings and screenshots.
8. Verify no loss of the accepted Staff/CRM PWA performance behavior. Do not claim performance equivalence without measured before/after values.

## Driver-wide delivery AFTER successful pilot acceptance

**Recommended:** Register the separate production Android package in Firebase/Google Play only after permanent package/signing approval; use **Firebase App Distribution** for an invite-only group or Google Play internal testing. Firebase App Distribution supports manual signed APK upload, tester invitations and controlled updates. Drivers install the **native Android app**, not another Chrome home-screen shortcut. Future Web pages continue updating through CradleHub; native SDK versions update by approved new APKs.

Native FCM token registration/sender, native pickup notifications, server-authorized GPS arrival, traffic-aware multi-stop/pickup sequencing and therapist service countdown **are not certified or added by this packaging work**.

## Safety, rollback, evidence
- Build workflow is opt-in and main-only for signed artifacts; branch PR is code-review evidence only.
- **No production database mutation, APK distribution, Google key configuration or Android device validation** is performed by committing this workflow.
- If a pilot fails, remove the pilot app from TEST devices; retain investigation evidence. Do not remove Chrome PWA or production app until explicit owner rollout acceptance.
- Avoid recording credentials in logs. CI compilation, an APK digest, and a successful Vercel status do not constitute native-device or production verification.
- Mandatory independent review + owner approval before merge; production-driver release requires a separate approved release gate.

## Official sources
- https://developer.android.com/studio/publish/app-signing
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments
- https://firebase.google.com/docs/app-distribution/android/distribute-console
- https://developers.google.com/maps/documentation/navigation/android-sdk/get-api-key
