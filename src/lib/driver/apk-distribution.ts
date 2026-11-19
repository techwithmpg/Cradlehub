import "server-only";
import { canonicalizeSystemRole } from "@/constants/staff";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { DriverApiError } from "@/lib/driver/server";
import { logBusinessEvent, logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
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

const STORAGE_OBJECT_PATTERN =
  /^releases\/[A-Za-z0-9._-]+\/cradlehub-driver-[A-Za-z0-9._-]+\.apk$/;

export type DriverApkPublicReleaseInfo = {
  appName: string;
  iconPath: string;
  available: boolean;
  statusLabel: "Available" | "Not yet available";
  unavailableReason: string | null;
  packageId: string | null;
  versionName: string | null;
  versionCode: number | null;
  minAndroidVersion: string;
  minSdk: number;
  releaseDate: string | null;
  sha256: string | null;
  supportEmail: string;
  supportDestinationLabel: string;
};

type ResolvedDriverApkRelease = {
  publicInfo: DriverApkPublicReleaseInfo;
  storageBucket: string | null;
  storageObject: string | null;
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

export function resolveDriverApkReleaseState(
  env: NodeJS.ProcessEnv = process.env
): ResolvedDriverApkRelease {
  const baseInfo: DriverApkPublicReleaseInfo = {
    appName: "CradleHub Driver",
    iconPath: "/staff-pwa-icon-192-gold.png",
    available: false,
    statusLabel: "Not yet available",
    unavailableReason:
      "An approved release-signed Android APK has not been published yet. Continue using the Driver workspace while release certification completes.",
    packageId: null,
    versionName: null,
    versionCode: null,
    minAndroidVersion: "Android 7.0+ (Nougat, API 24)",
    minSdk: 24,
    releaseDate: null,
    sha256: null,
    supportEmail: "support@cradlewellnessliving.com",
    supportDestinationLabel: "Branch Front Desk CRM or Operations Center",
  };

  if (env.CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED !== "true") {
    return {
      publicInfo: baseInfo,
      storageBucket: null,
      storageObject: null,
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
  const storageBucket =
    env.CRADLEHUB_DRIVER_APK_STORAGE_BUCKET?.trim() || "driver-apk-releases";
  const storageObject = env.CRADLEHUB_DRIVER_APK_STORAGE_OBJECT?.trim() ?? "";

  if (!ALLOWED_PACKAGES.has(packageId) || packageId.endsWith(".localtest")) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason:
          "Configured package identity is not an approved driver distribution package.",
      },
      storageBucket: null,
      storageObject: null,
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
      storageBucket: null,
      storageObject: null,
      fileName: null,
    };
  }

  if (!Number.isInteger(versionCode) || versionCode < 1 || String(versionCode) !== versionCodeRaw) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason: "Configured APK version code is invalid.",
      },
      storageBucket: null,
      storageObject: null,
      fileName: null,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason: "Configured APK release date is missing or invalid.",
      },
      storageBucket: null,
      storageObject: null,
      fileName: null,
    };
  }

  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason: "Configured APK SHA-256 checksum is missing or invalid.",
      },
      storageBucket: null,
      storageObject: null,
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
      storageBucket: null,
      storageObject: null,
      fileName: null,
    };
  }

  if (
    !/^[a-z0-9][a-z0-9._-]{2,62}$/.test(storageBucket) ||
    !STORAGE_OBJECT_PATTERN.test(storageObject) ||
    storageObject.includes("..")
  ) {
    return {
      publicInfo: {
        ...baseInfo,
        unavailableReason:
          "Private APK artifact storage path is not configured or failed validation.",
      },
      storageBucket: null,
      storageObject: null,
      fileName: null,
    };
  }

  const fileName = `cradlehub-driver-v${versionName}.apk`;

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
      sha256,
    },
    storageBucket,
    storageObject,
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

export async function issueDriverApkSignedDownload(): Promise<{
  downloadUrl: string;
  expiresInSeconds: number;
  fileName: string;
  versionName: string;
  versionCode: number;
  sha256: string;
}> {
  const actor = await requireDriverApkActor();
  const resolved = resolveDriverApkReleaseState();

  if (
    !resolved.publicInfo.available ||
    !resolved.storageBucket ||
    !resolved.storageObject ||
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

  const expiresInSeconds = 300;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(resolved.storageBucket)
    .createSignedUrl(resolved.storageObject, expiresInSeconds, {
      download: resolved.fileName,
    });

  if (error || !data?.signedUrl || !data.signedUrl.startsWith("https://")) {
    logError("driver.apk_signed_url_failed", {
      staffId: actor.staffId,
      branchId: actor.branchId,
      versionName: resolved.publicInfo.versionName,
      error: error?.message ?? "Signed URL unavailable",
    });
    throw new DriverApiError(
      503,
      "apk_artifact_unreachable",
      "Approved Driver APK artifact could not be retrieved from private storage. Contact your administrator."
    );
  }

  logBusinessEvent("driver.apk_download_issued", {
    actorStaffId: actor.staffId,
    branchId: actor.branchId,
    role: actor.role,
    packageId: resolved.publicInfo.packageId,
    versionName: resolved.publicInfo.versionName,
    versionCode: resolved.publicInfo.versionCode,
    sha256: resolved.publicInfo.sha256,
    expiresInSeconds,
  });

  return {
    downloadUrl: data.signedUrl,
    expiresInSeconds,
    fileName: resolved.fileName,
    versionName: resolved.publicInfo.versionName,
    versionCode: resolved.publicInfo.versionCode,
    sha256: resolved.publicInfo.sha256,
  };
}
