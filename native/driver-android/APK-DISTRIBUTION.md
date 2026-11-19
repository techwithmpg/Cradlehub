# CradleHub Driver — Signed APK Distribution & Rollback Procedures

This document defines the release signing, verification, private storage upload, server-authorized distribution, version replacement, and rollback procedures for the **CradleHub Driver** native Android application.

> [!IMPORTANT]
> Never publish an unsigned, debug-signed (`CN=Android Debug`), `.localtest`, or unapproved APK. The distribution service (`src/lib/driver/apk-distribution.ts`) fails closed to a **Not yet available** state whenever release metadata is missing or references a debug/fixture certificate.

---

## 1. Release Signing & Artifact Verification

1. **Accepted Package Identities**:
   - Production release: `com.mpgtechnologies.cradlehub.driver`
   - Controlled TEST pilot: `com.mpgtechnologies.cradlehub.driver.pilot`
   - Disallowed for distribution: `com.mpgtechnologies.cradlehub.driver.localtest` (rejected by `resolveDriverApkReleaseState`).
2. **Durable Release Keystore**:
   - Store the production/pilot `.jks` or `.keystore` file and credentials exclusively in protected owner-managed storage outside the Git repository.
   - Increment `versionCode` monotonically on every published release so Android devices perform seamless in-place updates without clearing encrypted session storage.
3. **Pre-Publication Checksum & Certificate Audit**:
   - Verify package metadata via `aapt2 dump badging <apk>`.
   - Verify V2/V3 APK signature and capture the signer certificate SHA-256 digest via:
     ```powershell
     apksigner verify --print-certs <apk>
     ```
   - Confirm the signer SHA-256 digest is **not** the Android Debug certificate (`f937c5ce56b71dce93f4bee4f97fdcf51abfe10744ce7de90b8f6aa3e41a957b`).
   - Compute the APK file SHA-256 digest:
     ```powershell
     (Get-FileHash <apk> -Algorithm SHA256).Hash.ToLower()
     ```

---

## 2. Private Artifact Upload & Publication

1. **Private Storage Bucket**:
   - Upload the verified signed APK to the **private** Supabase Storage bucket `driver-apk-releases` under the canonical versioned path:
     ```text
     releases/<versionName>/cradlehub-driver-v<versionName>.apk
     ```
   - Keep the bucket **private** (`public = false`). Do not grant anonymous or direct public read policies on `driver-apk-releases`.
2. **Server Environment Configuration**:
   - Configure the following server-only environment variables in the target deployment after independent review and owner release approval:
     ```dotenv
     CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED=true
     CRADLEHUB_DRIVER_APK_PACKAGE_ID=com.mpgtechnologies.cradlehub.driver
     CRADLEHUB_DRIVER_APK_VERSION_NAME=1.0.0
     CRADLEHUB_DRIVER_APK_VERSION_CODE=100
     CRADLEHUB_DRIVER_APK_RELEASE_DATE=2026-11-19
     CRADLEHUB_DRIVER_APK_SHA256=<64-char-lowercase-hex-apk-sha256>
     CRADLEHUB_DRIVER_APK_SIGNER_SHA256=<64-char-lowercase-hex-cert-sha256>
     CRADLEHUB_DRIVER_APK_STORAGE_BUCKET=driver-apk-releases
     CRADLEHUB_DRIVER_APK_STORAGE_OBJECT=releases/1.0.0/cradlehub-driver-v1.0.0.apk
     ```
   - Client requests to `GET /api/staff/driver/apk-download` and `POST /api/staff/driver/apk-download` cannot supply or override any release metadata, bucket name, or object key.

---

## 3. Access Control & Expiring Download Links

- **Authorized Roles Only**:
  - `requireDriverApkActor()` in `src/lib/driver/apk-distribution.ts` authenticates the session via Supabase Auth and verifies an active, non-archived, non-merged `public.staff` record.
  - Access is restricted to active branch-assigned **Driver** accounts (`resolveStaffPwaOperationalGroup === "driver"`) and designated administrators (`owner`, `manager`, `store_manager`, `assistant_manager`).
  - Unauthenticated requests receive `401`; non-driver/non-admin staff (e.g. therapists, utility staff) receive `403`.
- **Short-Lived HTTPS Signed URL**:
  - `POST /api/staff/driver/apk-download` issues a 300-second (`5-minute`) expiring HTTPS signed URL from private Supabase Storage (`createSignedUrl`) and logs a `driver.apk_download_issued` business audit event.
  - No service-role key or storage write credential is ever exposed to the browser.

---

## 4. Version Replacement & Immediate Rollback

- **Version Replacement**:
  1. Upload the new signed APK to `releases/<newVersion>/cradlehub-driver-v<newVersion>.apk` without deleting previous release objects.
  2. Update `CRADLEHUB_DRIVER_APK_VERSION_NAME`, `CRADLEHUB_DRIVER_APK_VERSION_CODE`, `CRADLEHUB_DRIVER_APK_RELEASE_DATE`, `CRADLEHUB_DRIVER_APK_SHA256`, and `CRADLEHUB_DRIVER_APK_STORAGE_OBJECT`.
- **Immediate Disable / Rollback**:
  - To immediately halt APK downloads (returning the portal to the fail-closed **Not yet available** state), set:
    ```dotenv
    CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED=false
    ```
  - Note: Android prevents downgrading an installed package to a lower `versionCode` without uninstalling; if a defective release must be superseded on already-updated devices, publish a hotfix build with an incremented `versionCode`.
