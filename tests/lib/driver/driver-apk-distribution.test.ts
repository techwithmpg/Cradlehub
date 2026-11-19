import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockState = vi.hoisted(() => ({
  user: { id: "auth-driver-1" } as { id: string } | null,
  staff: {
    id: "staff-driver-1",
    branch_id: "branch-main-1",
    system_role: "driver",
    staff_type: "driver",
    is_active: true,
    archived_at: null,
    merged_into_staff_id: null,
  } as Record<string, unknown> | null,
  signedUrlResult: {
    data: {
      signedUrl:
        "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/sign/driver-apk-releases/releases/1.0.0/cradlehub-driver-v1.0.0.apk?token=signed123",
    },
    error: null as { message: string } | null,
  },
  createSignedUrlMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockState.user },
        error: mockState.user ? null : { message: "No session" },
      }),
    },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: mockState.staff, error: null }),
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: (
          objectPath: string,
          expiresIn: number,
          options?: { download?: string }
        ) => {
          mockState.createSignedUrlMock(bucket, objectPath, expiresIn, options);
          return Promise.resolve(mockState.signedUrlResult);
        },
      }),
    },
  }),
}));

import {
  issueDriverApkSignedDownload,
  requireDriverApkActor,
  resolveDriverApkReleaseState,
} from "@/lib/driver/apk-distribution";
import { GET, POST } from "@/app/api/staff/driver/apk-download/route";

const VALID_RELEASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED: "true",
  CRADLEHUB_DRIVER_APK_PACKAGE_ID: "com.mpgtechnologies.cradlehub.driver",
  CRADLEHUB_DRIVER_APK_VERSION_NAME: "1.0.0",
  CRADLEHUB_DRIVER_APK_VERSION_CODE: "10",
  CRADLEHUB_DRIVER_APK_RELEASE_DATE: "2026-11-19",
  CRADLEHUB_DRIVER_APK_SHA256:
    "a1b2c3d4e5f60718293a4b5c6d7e8f9011223344556677889900aabbccddeeff",
  CRADLEHUB_DRIVER_APK_SIGNER_SHA256:
    "11223344556677889900aabbccddeeff00112233445566778899aabbccddeeff",
  CRADLEHUB_DRIVER_APK_STORAGE_BUCKET: "driver-apk-releases",
  CRADLEHUB_DRIVER_APK_STORAGE_OBJECT:
    "releases/1.0.0/cradlehub-driver-v1.0.0.apk",
};

describe("Driver APK distribution workflow & fail-closed security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.user = { id: "auth-driver-1" };
    mockState.staff = {
      id: "staff-driver-1",
      branch_id: "branch-main-1",
      system_role: "driver",
      staff_type: "driver",
      is_active: true,
      archived_at: null,
      merged_into_staff_id: null,
    };
    mockState.signedUrlResult = {
      data: {
        signedUrl:
          "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/sign/driver-apk-releases/releases/1.0.0/cradlehub-driver-v1.0.0.apk?token=signed123",
      },
      error: null,
    };
    delete process.env.CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED;
  });

  it("defaults to fail-closed Not yet available when no release APK is configured", () => {
    const state = resolveDriverApkReleaseState({ NODE_ENV: "test" });
    expect(state.publicInfo.available).toBe(false);
    expect(state.publicInfo.statusLabel).toBe("Not yet available");
    expect(state.storageObject).toBeNull();
  });

  it("rejects .localtest package IDs, owner-phone/debug versions, and Android Debug certificates", () => {
    const localTestPkg = resolveDriverApkReleaseState({
      ...VALID_RELEASE_ENV,
      CRADLEHUB_DRIVER_APK_PACKAGE_ID:
        "com.mpgtechnologies.cradlehub.driver.localtest",
    });
    expect(localTestPkg.publicInfo.available).toBe(false);

    const ownerPhoneVer = resolveDriverApkReleaseState({
      ...VALID_RELEASE_ENV,
      CRADLEHUB_DRIVER_APK_VERSION_NAME: "0.3.0-owner-phone",
    });
    expect(ownerPhoneVer.publicInfo.available).toBe(false);

    const debugSigned = resolveDriverApkReleaseState({
      ...VALID_RELEASE_ENV,
      CRADLEHUB_DRIVER_APK_SIGNER_SHA256:
        "f9:37:c5:ce:56:b7:1d:ce:93:f4:be:e4:f9:7f:dc:f5:1a:bf:e1:07:44:ce:7d:e9:0b:8f:6a:a3:e4:1a:95:7b",
    });
    expect(debugSigned.publicInfo.available).toBe(false);
    expect(debugSigned.publicInfo.unavailableReason).toContain(
      "Debug-signed or unsigned APKs cannot be distributed"
    );

    const traversalPath = resolveDriverApkReleaseState({
      ...VALID_RELEASE_ENV,
      CRADLEHUB_DRIVER_APK_STORAGE_OBJECT: "releases/../secret.apk",
    });
    expect(traversalPath.publicInfo.available).toBe(false);
  });

  it("enforces role access: permits active drivers and designated admins, denies therapists and unauthenticated callers", async () => {
    const driverActor = await requireDriverApkActor();
    expect(driverActor.isDriver).toBe(true);

    mockState.staff = {
      id: "staff-owner-1",
      branch_id: null,
      system_role: "owner",
      staff_type: "managerial",
      is_active: true,
      archived_at: null,
      merged_into_staff_id: null,
    };
    const ownerActor = await requireDriverApkActor();
    expect(ownerActor.isAdmin).toBe(true);

    mockState.staff = {
      id: "staff-therapist-1",
      branch_id: "branch-main-1",
      system_role: "staff",
      staff_type: "therapist",
      is_active: true,
      archived_at: null,
      merged_into_staff_id: null,
    };
    const deniedRes = await GET();
    expect(deniedRes.status).toBe(403);

    mockState.user = null;
    const unauthRes = await POST();
    expect(unauthRes.status).toBe(401);
  });

  it("returns 503 when download is requested while no approved signed APK is enabled, and issues expiring HTTPS URL when enabled", async () => {
    const unavailableRes = await POST();
    expect(unavailableRes.status).toBe(503);
    const unavailableJson = (await unavailableRes.json()) as {
      ok: boolean;
      code: string;
    };
    expect(unavailableJson.ok).toBe(false);
    expect(unavailableJson.code).toBe("apk_not_available");

    Object.assign(process.env, VALID_RELEASE_ENV);
    try {
      const signed = await issueDriverApkSignedDownload();
      expect(signed.downloadUrl).toContain("https://");
      expect(signed.expiresInSeconds).toBe(300);
      expect(signed.fileName).toBe("cradlehub-driver-v1.0.0.apk");
      expect(mockState.createSignedUrlMock).toHaveBeenCalledWith(
        "driver-apk-releases",
        "releases/1.0.0/cradlehub-driver-v1.0.0.apk",
        300,
        { download: "cradlehub-driver-v1.0.0.apk" }
      );
    } finally {
      for (const key of Object.keys(VALID_RELEASE_ENV)) {
        if (key !== "NODE_ENV") delete process.env[key];
      }
    }
  });
});
