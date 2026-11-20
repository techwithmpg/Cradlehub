import "server-only";
import { canonicalizeSystemRole } from "@/constants/staff";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { DriverApiError } from "@/lib/driver/server";
import { logBusinessEvent } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const ANDROID_DEBUG_CERT_SHA256 =
  "f937c5ce56b71dce93f4bee4f97fdcf51abfe10744ce7de90b8f6aa3e41a957b";
const ANDROID_DEBUG_CERT_SHA1 = "0b396adc9dff8bd6324707a4636fe49c080d3b8b";

const ALLOWED_PACKAGES = new Set([
  "com.mpgtechnologies.cradlehub.driver",
  "com.mpgtechnologies.cradlehub.driver.pilot",
]);

const DESIGNATED_ADMIN_ROLES = new Set([
  "owner",
  "manager",
  "store_manager",
  "assistant_manager",
]);

const GOOGLE_DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{15,120}$/;
const GOOGLE_DRIVE_RESOURCE_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const GOOGLE_DRIVE_FILE_PATH_PATTERN =
  /^\/file\/d\/([A-Za-z0-9_-]{15,120})(?:\/view)?\/?$/;

const MIN_APK_FILE_SIZE_BYTES = 1_000_000;
const MAX_APK_FILE_SIZE_BYTES = 500_000_000;

export type DriverApkPublicReleaseInfo = {
  appName: string;
  iconPath: string;
  available: boolean;
  statusLabel: "Available" | "Not yet available";
  unavailableReason: string | null;
  deliveryProvider: "google_drive";
  packageId: string | null;
  versionName: string | null;
  versionCode: number | null;
  minAndroidVersion: string;
  minSdk: number;
  releaseDate: string | null;
  fileSizeBytes: number | null;
  fileSizeLabel: string | null;
  sha256: string | null;
  supportEmail: string;
  supportDestinationLabel: string;
};

type ResolvedDriverApkRelease = {
  publicInfo: DriverApkPublicReleaseInfo;
  googleDriveUrl: string | null;
  fileName: string | null;
};

export type DriverApkActor = {
  userId: string;
  staffId: string;
  branchId: string | null;
  role: string;
  isDriver: boolean;
  isAdmin: boolean;
};

export type GoogleDriveUrlValidationResult =
  | { ok: true; canonicalUrl: string; fileId: string }
  | { ok: false; reason: string };

function normalizeHexFingerprint(raw: string): string {
  return raw.trim().replace(/:/g, "").toLowerCase();
}

function isDisallowedDebugOrFixtureVersion(versionName: string): boolean {
  const lower = versionName.toLowerCase();
  return (
    lower.includes("localtest") ||
    lower.includes("local-test") ||
    lower.includes("owner-phone") ||
    lower.includes("fixture") ||
    lower.includes("debug")
  );
}

export function formatApkFileSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return null;
  const megabytes = bytes / 1_000_000;
  return `${megabytes.toFixed(1)} MB`;
}

/**
 * Strictly validates an owner-supplied Google Drive single-file sharing URL.
 * Rejects non-HTTPS schemes, arbitrary external domains, Google Drive folders,
 * open-redirect query parameters, credentials in URLs, fragments, and malformed IDs.
 */
export function validateApprovedGoogleDriveFileUrl(
  rawUrl: string | null | undefined
): GoogleDriveUrlValidationResult {
  const trimmed = rawUrl?.trim() ?? "";
  if (!trimmed) {
    return { ok: false, reason: "Google Drive APK download link is not configured." };
  }
  if (trimmed.length > 512 || /[\s\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, reason: "Configured Google Drive URL contains invalid characters." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Configured Google Drive URL is malformed." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Download URL must use HTTPS." };
  }

  if (parsed.username || parsed.password || parsed.port || parsed.hash) {
    return {
      ok: false,
      reason: "Download URL must not include credentials, custom ports, or fragments.",
    };
  }

  if (parsed.hostname.toLowerCase() !== "drive.google.com") {
    return {
      ok: false,
      reason: "Only verified drive.google.com single-file sharing links are permitted.",
    };
  }

  if (/\/folders?\//i.test(parsed.pathname) || parsed.pathname.includes("..")) {
    return {
      ok: false,
      reason: "Google Drive folder links are not permitted. Share only the single approved APK file.",
    };
  }

  const queryEntries = Array.from(parsed.searchParams.entries());
  const seenKeys = new Set<string>();
  for (const [key] of queryEntries) {
    if (seenKeys.has(key)) {
      return { ok: false, reason: "Download URL contains duplicate query parameters." };
    }
    seenKeys.add(key);
  }

  let fileId: string | null = null;
  let resourceKey: string | null = null;

  const fileMatch = GOOGLE_DRIVE_FILE_PATH_PATTERN.exec(parsed.pathname);
  if (fileMatch) {
    fileId = fileMatch[1] ?? null;
    for (const [key, value] of queryEntries) {
      if (key === "usp") {
        if (value !== "sharing" && value !== "drive_link") {
          return { ok: false, reason: "Unsupported Google Drive sharing parameter." };
        }
      } else if (key === "resourcekey") {
        if (!GOOGLE_DRIVE_RESOURCE_KEY_PATTERN.test(value)) {
          return { ok: false, reason: "Invalid Google Drive resource key." };
        }
        resourceKey = value;
      } else {
        return { ok: false, reason: "Unexpected query parameters in Google Drive URL." };
      }
    }
  } else if (parsed.pathname === "/uc") {
    const idVal = parsed.searchParams.get("id") ?? "";
    const exportVal = parsed.searchParams.get("export") ?? "";
    if (!GOOGLE_DRIVE_FILE_ID_PATTERN.test(idVal) || exportVal !== "download") {
      return { ok: false, reason: "Google Drive /uc link must specify export=download and a valid file id." };
    }
    for (const [key, value] of queryEntries) {
      if (key === "id" || key === "export") continue;
      if (key === "resourcekey") {
        if (!GOOGLE_DRIVE_RESOURCE_KEY_PATTERN.test(value)) {
          return { ok: false, reason: "Invalid Google Drive resource key." };
        }
        resourceKey = value;
      } else {
        return { ok: false, reason: "Unexpected query parameters in Google Drive download URL." };
      }
    }
    fileId = idVal;
  } else if (parsed.pathname === "/open") {
    const idVal = parsed.searchParams.get("id") ?? "";
    if (!GOOGLE_DRIVE_FILE_ID_PATTERN.test(idVal)) {
      return { ok: false, reason: "Google Drive /open link must specify a valid file id." };
    }
    for (const [key, value] of queryEntries) {
      if (key === "id") continue;
      if (key === "resourcekey") {
        if (!GOOGLE_DRIVE_RESOURCE_KEY_PATTERN.test(value)) {
          return { ok: false, reason: "Invalid Google Drive resource key." };
        }
        resourceKey = value;
      } else {
        return { ok: false, reason: "Unexpected query parameters in Google Drive URL." };
      }
    }
    fileId = idVal;
  } else {
    return {
      ok: false,
      reason: "URL must be a direct Google Drive file link (drive.google.com/file/d/<id>/view).",
    };
  }

  if (!fileId || !GOOGLE_DRIVE_FILE_ID_PATTERN.test(fileId)) {
    return { ok: false, reason: "Google Drive file ID is missing or invalid." };
  }

  const canonicalUrl = resourceKey
    ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing&resourcekey=${encodeURIComponent(resourceKey)}`
    : `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

  return { ok: true, canonicalUrl, fileId };
}

export function resolveDriverApkReleaseState(
  env: NodeJS.ProcessEnv = process.env
): ResolvedDriverApkRelease {
  const baseInfo: DriverApkPublicReleaseInfo = {
    appName: "CradleHub Driver",
    iconPath: "/staff-pwa-icon-192-gold.png",
    available: false,
    statusLabel: "Not yet available",
    unavailableReason:
      "The approved Android installer is not yet published. Continue using the Driver Web Portal while distribution completes.",
    deliveryProvider: "google_drive",
    packageId: null,
    versionName: null,
    versionCode: null,
    minAndroidVersion: "Android 7.0+ (Nougat, API 24)",
    minSdk: 24,
    releaseDate: null,
    fileSizeBytes: null,
    fileSizeLabel: null,
    sha256: null,
    supportEmail: "support@cradlewellnessliving.com",
    supportDestinationLabel: "Branch Front Desk CRM or Operations Center",
  };

  if (env.CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED !== "true") {
    return {
      publicInfo: baseInfo,
      googleDriveUrl: null,
      fileName: null,
    };
  }

  const packageId = env.CRADLEHUB_DRIVER_APK_PACKAGE_ID?.trim() ?? "";
  const versionName = env.CRADLEHUB_DRIVER_APK_VERSION_NAME?.trim() ?? "";
  const versionCodeRaw = env.CRADLEHUB_DRIVER_APK_VERSION_CODE?.trim() ?? "";
  const versionCode = Number.parseInt(versionCodeRaw, 10);
  const releaseDate = env.CRADLEHUB_DRIVER_APK_RELEASE_DATE?.trim() ?? "";
  const sha256 = normalizeHexFingerprint(env.CRADLEHUB_DRIVER_APK_SHA256 ?? "");
  const signerRaw = normalizeHexFingerprint(env.CRADLEHUB_DRIVER_APK_SIGNER_SHA256 ?? "");
  const fileSizeRaw = env.CRADLEHUB_DRIVER_APK_FILE_SIZE_BYTES?.trim() ?? "";
  const googleDriveUrlRaw = env.CRADLEHUB_DRIVER_APK_GOOGLE_DRIVE_URL?.trim() ?? "";

  if (!ALLOWED_PACKAGES.has(packageId) || packageId.endsWith(".localtest")) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason:
          "Configured package identity is not an approved driver distribution package.",
      },
      googleDriveUrl: null,
      fileName: null,
    };
  }

  if (
    !versionName ||
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9._-]+)?$/.test(versionName) ||
    isDisallowedDebugOrFixtureVersion(versionName)
  ) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason:
          "Configured APK version is a debug/test build or lacks an approved release version name.",
      },
      googleDriveUrl: null,
      fileName: null,
    };
  }

  if (
    !Number.isInteger(versionCode) ||
    versionCode < 1 ||
    String(versionCode) !== versionCodeRaw
  ) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason: "Configured APK version code is invalid.",
      },
      googleDriveUrl: null,
      fileName: null,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason: "Configured APK release date is missing or invalid.",
      },
      googleDriveUrl: null,
      fileName: null,
    };
  }

  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason: "Configured APK SHA-256 checksum is missing or invalid.",
      },
      googleDriveUrl: null,
      fileName: null,
    };
  }

  if (
    !/^[a-f0-9]{64}$/.test(signerRaw) ||
    signerRaw === ANDROID_DEBUG_CERT_SHA256 ||
    signerRaw.includes(ANDROID_DEBUG_CERT_SHA1)
  ) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason:
          "Debug-signed or unsigned APKs cannot be distributed. A durable release signing certificate is required.",
      },
      googleDriveUrl: null,
      fileName: null,
    };
  }

  let fileSizeBytes: number | null = null;
  if (fileSizeRaw) {
    const parsedSize = Number.parseInt(fileSizeRaw, 10);
    if (
      !Number.isInteger(parsedSize) ||
      String(parsedSize) !== fileSizeRaw ||
      parsedSize < MIN_APK_FILE_SIZE_BYTES ||
      parsedSize > MAX_APK_FILE_SIZE_BYTES
    ) {
      return {
        publicInfo: {
          ...baseInfo,
          unavailableReason: "Configured APK file size metadata is invalid.",
        },
        googleDriveUrl: null,
        fileName: null,
      };
    }
    fileSizeBytes = parsedSize;
  }

  const driveValidation = validateApprovedGoogleDriveFileUrl(googleDriveUrlRaw);
  if (!driveValidation.ok) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason: driveValidation.reason,
      },
      googleDriveUrl: null,
      fileName: null,
    };
  }

  const fileName = `CradleHub-Driver-v${versionName}.apk`;

  return {
    publicInfo: {
      ...baseInfo,
      available: true,
      statusLabel: "Available",
      unavailableReason: null,
      packageId,
      versionName,
      versionCode,
      releaseDate,
      fileSizeBytes,
      fileSizeLabel: formatApkFileSize(fileSizeBytes),
      sha256,
    },
    googleDriveUrl: driveValidation.canonicalUrl,
    fileName,
  };
}

export async function requireDriverApkActor(): Promise<DriverApkActor> {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) {
    throw new DriverApiError(
      401,
      "sign_in_required",
      "Sign in with an authorized Driver or administrator account."
    );
  }

  const result = await db
    .from("staff")
    .select("id, branch_id, system_role, staff_type, is_active, archived_at, merged_into_staff_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const staff = result.data as
    | (NonNullable<typeof result.data> & {
        archived_at?: string | null;
        merged_into_staff_id?: string | null;
      })
    | null;

  if (
    result.error ||
    !staff ||
    !staff.is_active ||
    Boolean(staff.archived_at) ||
    Boolean(staff.merged_into_staff_id)
  ) {
    throw new DriverApiError(
      403,
      "driver_or_admin_required",
      "An active Driver or designated administrator account is required."
    );
  }

  const canonicalRole = canonicalizeSystemRole(staff.system_role);
  const isDriver =
    resolveStaffPwaOperationalGroup(staff.system_role, staff.staff_type) === "driver";
  const isAdmin = DESIGNATED_ADMIN_ROLES.has(canonicalRole);

  if (!isDriver && !isAdmin) {
    throw new DriverApiError(
      403,
      "driver_or_admin_required",
      "Only authorized Driver accounts and designated administrators can access the Driver App download."
    );
  }

  if (isDriver && !isAdmin && !staff.branch_id) {
    throw new DriverApiError(
      403,
      "driver_branch_required",
      "Driver account must be assigned to an active branch."
    );
  }

  return {
    userId: user.id,
    staffId: staff.id,
    branchId: staff.branch_id ?? null,
    role: canonicalRole,
    isDriver,
    isAdmin,
  };
}

export async function issueDriverApkDownloadLink(): Promise<{
  downloadUrl: string;
  provider: "google_drive";
  fileName: string;
  versionName: string;
  versionCode: number;
  fileSizeBytes: number | null;
  fileSizeLabel: string | null;
  sha256: string;
}> {
  const actor = await requireDriverApkActor();
  const resolved = resolveDriverApkReleaseState();

  if (
    !resolved.publicInfo.available ||
    !resolved.googleDriveUrl ||
    !resolved.fileName ||
    !resolved.publicInfo.versionName ||
    !resolved.publicInfo.versionCode ||
    !resolved.publicInfo.sha256
  ) {
    throw new DriverApiError(
      503,
      "apk_not_available",
      resolved.publicInfo.unavailableReason ??
        "Approved signed Driver APK is not yet available for download."
    );
  }

  logBusinessEvent("driver.apk_download_issued", {
    actorStaffId: actor.staffId,
    branchId: actor.branchId,
    role: actor.role,
    provider: "google_drive",
    packageId: resolved.publicInfo.packageId,
    versionName: resolved.publicInfo.versionName,
    versionCode: resolved.publicInfo.versionCode,
    sha256: resolved.publicInfo.sha256,
  });

  return {
    downloadUrl: resolved.googleDriveUrl,
    provider: "google_drive",
    fileName: resolved.fileName,
    versionName: resolved.publicInfo.versionName,
    versionCode: resolved.publicInfo.versionCode,
    fileSizeBytes: resolved.publicInfo.fileSizeBytes,
    fileSizeLabel: resolved.publicInfo.fileSizeLabel,
    sha256: resolved.publicInfo.sha256,
  };
}
