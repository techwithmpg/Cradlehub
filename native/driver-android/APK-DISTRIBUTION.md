# CradleHub Driver — Signed APK Google Drive Distribution & Rollback Procedures

This document defines the release signing, verification, owner-managed Google Drive upload, server-authorized Driver Portal distribution, security model, version replacement, and rollback procedures for the **CradleHub Driver** native Android application.

> [!IMPORTANT]
> Never publish an unsigned, debug-signed (`CN=Android Debug`), `.localtest`, or unapproved APK. The distribution service (`src/lib/driver/apk-distribution.ts`) fails closed to **Not yet available** whenever release metadata is missing, `CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED !== "true"`, the certificate is a debug certificate, or `CRADLEHUB_DRIVER_APK_GOOGLE_DRIVE_URL` fails strict single-file Google Drive validation.

---

## 1. Release Signing & Artifact Verification

1. **Accepted Package Identities**:
   - Production release: `com.mpgtechnologies.cradlehub.driver`
   - Controlled TEST pilot: `com.mpgtechnologies.cradlehub.driver.pilot`
   - Disallowed for distribution: `com.mpgtechnologies.cradlehub.driver.localtest` (rejected by `resolveDriverApkReleaseState`).
2. **Durable Release Keystore**:
   - Store the production `.jks` keystore and passwords exclusively in protected owner-managed storage outside Git. Never commit APK binaries or signing credentials to Git.
   - Increment `versionCode` monotonically on every changed release so Android devices perform seamless in-place updates without clearing encrypted session storage.
3. **Pre-Publication Checksum & Certificate Audit**:
   - Verify package metadata via `aapt2 dump badging <apk>` and `aapt2 dump permissions <apk>`.
   - Verify APK Signature Scheme v2/v3 and signer certificate SHA-256 via:
     ```powershell
     apksigner verify --print-certs <apk>
     ```
   - Confirm the signer SHA-256 digest is **not** the Android Debug certificate (`f937c5ce56b71dce93f4bee4f97fdcf51abfe10744ce7de90b8f6aa3e41a957b`).
   - Compute and match the exact APK SHA-256 digest:
     ```powershell
     (Get-FileHash <apk> -Algorithm SHA256).Hash.ToLower()
     ```

---

## 2. Owner-Managed Google Drive Upload & Configuration

1. **Upload the Single Approved APK File**:
   - Sign in to the **owner-controlled Google Drive account**.
   - Upload **only** the verified installer file (`CradleHub-Driver-v1.0.0.apk` from `releases/driver-android/`).
   - Right-click **that single file only** (never share a parent folder containing confidential documents) → **Share**.
   - Set General Access to **Anyone with the link** with role **Viewer** (or restricted to explicit driver Google accounts if all drivers sign in to Chrome with managed accounts).
   - Click **Copy link** (`https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing`).
2. **Server-Only Environment Configuration (Vercel Production)**:
   - Configure these server-only environment variables (never prefix with `NEXT_PUBLIC_`) after verifying the uploaded file is downloadable and matches the exact SHA-256 checksum:
     ```dotenv
     CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED=true
     CRADLEHUB_DRIVER_APK_GOOGLE_DRIVE_URL=https://drive.google.com/file/d/<VERIFIED_FILE_ID>/view?usp=sharing
     CRADLEHUB_DRIVER_APK_PACKAGE_ID=com.mpgtechnologies.cradlehub.driver
     CRADLEHUB_DRIVER_APK_VERSION_NAME=1.0.0
     CRADLEHUB_DRIVER_APK_VERSION_CODE=2
     CRADLEHUB_DRIVER_APK_RELEASE_DATE=2026-11-19
     CRADLEHUB_DRIVER_APK_FILE_SIZE_BYTES=91131319
     CRADLEHUB_DRIVER_APK_SHA256=410ad0616e2413ed9333423a4ef8f09c953167bb5e3c285a9f59ca589220a896
     CRADLEHUB_DRIVER_APK_SIGNER_SHA256=b1a13afa4154ef930bd44c93536e1b6f6568e8487cb268b540495461603354b1
     ```
   - `validateApprovedGoogleDriveFileUrl()` accepts only HTTPS `drive.google.com` single-file links (`/file/d/<id>/view`, `/uc?export=download&id=<id>`, `/open?id=<id>`) and rejects arbitrary external domains, non-HTTPS schemes, Google Drive folders, open-redirect query parameters, credentials in URLs, and malformed IDs.
   - Client requests to `GET /api/staff/driver/apk-download` receive only safe display metadata (never the Google Drive URL). `POST /api/staff/driver/apk-download` validates the user's session, role, and same-origin request before returning the canonical Google Drive URL.

---

## 3. Access Control & Google Drive Security Model

- **CradleHub Server Authorization**:
  - `requireDriverApkActor()` authenticates the session via Supabase Auth and verifies an active, non-archived, non-merged `public.staff` record.
  - Access is restricted to active branch-assigned **Driver** accounts (`resolveStaffPwaOperationalGroup === "driver"`) and designated administrators (`owner`, `manager`, `store_manager`, `assistant_manager`).
  - Unauthenticated requests receive `401`; therapists, utility staff, and archived/merged/unassigned/disabled accounts receive `403`.
  - No Supabase service-role credentials are used or exposed.
- **Explicit Google Drive Sharing Security Boundary**:
  - **CradleHub authentication protects discovery of the link inside the Driver Portal, but it does NOT make the underlying Google Drive file private if shared as "Anyone with the link."**
  - Anyone who receives a forwarded "Anyone with the link" URL can download the APK binary directly from Google Drive. (Note: the APK contains zero privileged credentials, zero service-role keys, and requires an active CradleHub Driver login to operate.)
  - Always host the APK in an **owner-controlled Google Drive account** and share **only the single approved APK file** — never share a folder containing private or operational documents.
  - To revoke access immediately at Google Drive, change the file's sharing setting back to **Restricted** in Google Drive in addition to disabling `CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED`.

---

## 4. Version Replacement & Immediate Rollback

- **Version Replacement**:
  1. Build, sign with the same permanent release keystore, increment `versionCode`, and physically accept the new APK.
  2. Upload the new single APK file to the owner's Google Drive, verify the downloaded SHA-256, and update `CRADLEHUB_DRIVER_APK_GOOGLE_DRIVE_URL`, `CRADLEHUB_DRIVER_APK_VERSION_NAME`, `CRADLEHUB_DRIVER_APK_VERSION_CODE`, `CRADLEHUB_DRIVER_APK_RELEASE_DATE`, `CRADLEHUB_DRIVER_APK_FILE_SIZE_BYTES`, and `CRADLEHUB_DRIVER_APK_SHA256`.
- **Immediate Disable / Rollback**:
  1. Set `CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED=false` in Vercel Production and redeploy (or roll back the Vercel deployment) to immediately return `/driver/app` and `/staff/driver/app` to fail-closed **Not yet available**.
  2. In Google Drive, set the file's sharing permission back to **Restricted** to prevent forwarded link downloads.
  3. Note: Android prevents downgrading an installed app to a lower `versionCode` without uninstalling; supersede any defective release with an incremented `versionCode`.

---

## 5. Approved Release Manifest — `v1.0.0` (`versionCode = 2`)

- **Installer Filename**: `CradleHub-Driver-v1.0.0.apk` (byte-for-byte copy of `native/driver-android/app/build/outputs/apk/release/cradlehub-driver-v1.0.0.apk`)
- **Package ID**: `com.mpgtechnologies.cradlehub.driver`
- **Version Name / Code**: `1.0.0` / `2` (`minSdk = 24`, `targetSdk = 36`, `compileSdk = 36`)
- **Supported CPU Architectures**: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`
- **APK File Size**: `91,131,319` bytes (`91.1 MB` / `86.91 MiB`)
- **APK SHA-256**: `410ad0616e2413ed9333423a4ef8f09c953167bb5e3c285a9f59ca589220a896`
- **Signing Scheme**: APK Signature Scheme v2 (`RSA 4096-bit`)
- **Signer Certificate DN**: `CN=CradleHub Driver Release, OU=Mobile Engineering, O=Cradle Wellness Living Inc., L=Bacolod, ST=Negros Occidental, C=PH`
- **Signer Certificate SHA-256**: `b1a13afa4154ef930bd44c93536e1b6f6568e8487cb268b540495461603354b1`
- **Signer Certificate SHA-1**: `E9:44:2D:E6:DA:98:89:CE:4B:E0:81:0D:37:B4:2C:5B:43:D0:80:72`
- **Physical Acceptance**: Passed on `Realme RMX3081` (`Android 13 / API 33`) including real sign-in, live Google Navigation SDK map tiles, live GPS routing, active turn-by-turn guidance, background/resume continuity, `End route`, and Camera/Location permission recovery.
