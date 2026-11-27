import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

import {
  formatApkFileSize,
  issueDriverApkDownloadLink,
  requireDriverApkActor,
  resolveDriverApkReleaseState,
  validateApprovedGoogleDriveFileUrl,
} from "@/lib/driver/apk-distribution";
import { isIosUserAgent } from "@/lib/driver/platform";
import { GET, POST } from "@/app/api/staff/driver/apk-download/route";

const SAMPLE_DRIVE_FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const SAMPLE_DRIVE_URL = `https://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view?usp=sharing`;

const VALID_RELEASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED: "true",
  CRADLEHUB_DRIVER_APK_GOOGLE_DRIVE_URL: SAMPLE_DRIVE_URL,
  CRADLEHUB_DRIVER_APK_PACKAGE_ID: "com.mpgtechnologies.cradlehub.driver",
  CRADLEHUB_DRIVER_APK_VERSION_NAME: "1.0.0",
  CRADLEHUB_DRIVER_APK_VERSION_CODE: "2",
  CRADLEHUB_DRIVER_APK_RELEASE_DATE: "2026-11-19",
  CRADLEHUB_DRIVER_APK_FILE_SIZE_BYTES: "91131319",
  CRADLEHUB_DRIVER_APK_SHA256:
    "410ad0616e2413ed9333423a4ef8f09c953167bb5e3c285a9f59ca589220a896",
  CRADLEHUB_DRIVER_APK_SIGNER_SHA256:
    "b1a13afa4154ef930bd44c93536e1b6f6568e8487cb268b540495461603354b1",
};

const ENV_KEYS = [
  "CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED",
  "CRADLEHUB_DRIVER_APK_GOOGLE_DRIVE_URL",
  "CRADLEHUB_DRIVER_APK_PACKAGE_ID",
  "CRADLEHUB_DRIVER_APK_VERSION_NAME",
  "CRADLEHUB_DRIVER_APK_VERSION_CODE",
  "CRADLEHUB_DRIVER_APK_RELEASE_DATE",
  "CRADLEHUB_DRIVER_APK_FILE_SIZE_BYTES",
  "CRADLEHUB_DRIVER_APK_SHA256",
  "CRADLEHUB_DRIVER_APK_SIGNER_SHA256",
] as const;

describe("Driver APK Google Drive URL validation & release gate", () => {
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
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("accepts and canonicalizes approved Google Drive single-file sharing URLs", () => {
    const sharing = validateApprovedGoogleDriveFileUrl(
      `https://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view?usp=sharing`
    );
    expect(sharing).toEqual({
      ok: true,
      canonicalUrl: SAMPLE_DRIVE_URL,
      fileId: SAMPLE_DRIVE_FILE_ID,
    });

    const driveLink = validateApprovedGoogleDriveFileUrl(
      `https://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view?usp=drive_link`
    );
    expect(driveLink).toEqual({
      ok: true,
      canonicalUrl: SAMPLE_DRIVE_URL,
      fileId: SAMPLE_DRIVE_FILE_ID,
    });

    const ucDownload = validateApprovedGoogleDriveFileUrl(
      `https://drive.google.com/uc?export=download&id=${SAMPLE_DRIVE_FILE_ID}`
    );
    expect(ucDownload).toEqual({
      ok: true,
      canonicalUrl: SAMPLE_DRIVE_URL,
      fileId: SAMPLE_DRIVE_FILE_ID,
    });

    const openLink = validateApprovedGoogleDriveFileUrl(
      `https://drive.google.com/open?id=${SAMPLE_DRIVE_FILE_ID}`
    );
    expect(openLink).toEqual({
      ok: true,
      canonicalUrl: SAMPLE_DRIVE_URL,
      fileId: SAMPLE_DRIVE_FILE_ID,
    });

    const withResourceKey = validateApprovedGoogleDriveFileUrl(
      `https://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view?usp=sharing&resourcekey=0-AbCdEf123456`
    );
    expect(withResourceKey).toEqual({
      ok: true,
      canonicalUrl: `${SAMPLE_DRIVE_URL}&resourcekey=0-AbCdEf123456`,
      fileId: SAMPLE_DRIVE_FILE_ID,
    });
  });

  it("rejects non-HTTPS, arbitrary external hosts, Drive folders, open redirects, and malformed URLs", () => {
    const invalidUrls = [
      "",
      "   ",
      `http://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view?usp=sharing`,
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      `https://evil.example/file/d/${SAMPLE_DRIVE_FILE_ID}/view?usp=sharing`,
      "https://www.google.com/url?q=https://evil.example/app.apk",
      `https://drive.google.com/drive/folders/${SAMPLE_DRIVE_FILE_ID}?usp=sharing`,
      `https://drive.google.com/drive/u/0/folders/${SAMPLE_DRIVE_FILE_ID}`,
      `https://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view?url=https://evil.example`,
      `https://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view?usp=sharing&continue=https://evil.example`,
      `https://drive.google.com/uc?export=view&id=${SAMPLE_DRIVE_FILE_ID}`,
      `https://drive.google.com/open?id=${SAMPLE_DRIVE_FILE_ID}&id=otherId1234567890`,
      `https://user:pass@drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view`,
      `https://drive.google.com:8443/file/d/${SAMPLE_DRIVE_FILE_ID}/view`,
      `https://drive.google.com/file/d/${SAMPLE_DRIVE_FILE_ID}/view#frag`,
      "https://drive.google.com/file/d/short/view",
      `https://drive.google.com/file/d/../../etc/passwd/view`,
    ];

    for (const url of invalidUrls) {
      const result = validateApprovedGoogleDriveFileUrl(url);
      expect(result.ok, `Expected rejection for: ${url}`).toBe(false);
    }
  });

  it("fails closed when distribution flag is disabled or Google Drive link is missing", () => {
    const disabled = resolveDriverApkReleaseState({ NODE_ENV: "test" });
    expect(disabled.publicInfo.available).toBe(false);
    expect(disabled.publicInfo.statusLabel).toBe("Not yet available");
    expect(disabled.googleDriveUrl).toBeNull();

    const missingLink = resolveDriverApkReleaseState({
      ...VALID_RELEASE_ENV,
      CRADLEHUB_DRIVER_APK_GOOGLE_DRIVE_URL: "",
    });
    expect(missingLink.publicInfo.available).toBe(false);
    expect(missingLink.googleDriveUrl).toBeNull();
  });

  it("rejects .localtest packages, debug/owner-phone builds, debug certificates, and bad file sizes", () => {
    expect(
      resolveDriverApkReleaseState({
        ...VALID_RELEASE_ENV,
        CRADLEHUB_DRIVER_APK_PACKAGE_ID: "com.mpgtechnologies.cradlehub.driver.localtest",
      }).publicInfo.available
    ).toBe(false);

    expect(
      resolveDriverApkReleaseState({
        ...VALID_RELEASE_ENV,
        CRADLEHUB_DRIVER_APK_VERSION_NAME: "0.3.0-owner-phone",
      }).publicInfo.available
    ).toBe(false);

    expect(
      resolveDriverApkReleaseState({
        ...VALID_RELEASE_ENV,
        CRADLEHUB_DRIVER_APK_SIGNER_SHA256:
          "f937c5ce56b71dce93f4bee4f97fdcf51abfe10744ce7de90b8f6aa3e41a957b",
      }).publicInfo.available
    ).toBe(false);

    expect(
      resolveDriverApkReleaseState({
        ...VALID_RELEASE_ENV,
        CRADLEHUB_DRIVER_APK_FILE_SIZE_BYTES: "not-a-number",
      }).publicInfo.available
    ).toBe(false);
  });

  it("resolves valid release metadata with formatted APK size and keeps Google Drive URL out of publicInfo", () => {
    const resolved = resolveDriverApkReleaseState(VALID_RELEASE_ENV);
    expect(resolved.publicInfo.available).toBe(true);
    expect(resolved.publicInfo.statusLabel).toBe("Available");
    expect(resolved.publicInfo.versionName).toBe("1.0.0");
    expect(resolved.publicInfo.versionCode).toBe(2);
    expect(resolved.publicInfo.fileSizeBytes).toBe(91131319);
    expect(resolved.publicInfo.fileSizeLabel).toBe("91.1 MB");
    expect(resolved.googleDriveUrl).toBe(SAMPLE_DRIVE_URL);
    expect("googleDriveUrl" in resolved.publicInfo).toBe(false);
    expect(formatApkFileSize(91131319)).toBe("91.1 MB");
  });

  it("detects iPhone/iPad/iPod user agents accurately for iOS fallback", () => {
    expect(
      isIosUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
      )
    ).toBe(true);
    expect(
      isIosUserAgent(
        "Mozilla/5.0 (Linux; Android 13; RMX3081) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
      )
    ).toBe(false);
    expect(isIosUserAgent(null)).toBe(false);
  });
});

describe("Driver APK download endpoint authorization & lifecycle", () => {
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
    Object.assign(process.env, VALID_RELEASE_ENV);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("blocks unauthenticated requests with 401", async () => {
    mockState.user = null;
    const getRes = await GET();
    expect(getRes.status).toBe(401);
    const req = new NextRequest("https://www.cradlewellnessliving.com/api/staff/driver/apk-download", {
      method: "POST",
    });
    const postRes = await POST(req);
    expect(postRes.status).toBe(401);
  });

  it("blocks therapists, utility staff, disabled, archived, merged, and unassigned drivers with 403", async () => {
    const blockedProfiles: Array<Record<string, unknown>> = [
      { id: "s1", branch_id: "b1", system_role: "service_staff", staff_type: "therapist", is_active: true },
      { id: "s2", branch_id: "b1", system_role: "utility", staff_type: "utility", is_active: true },
      { id: "s3", branch_id: "b1", system_role: "driver", staff_type: "driver", is_active: false },
      { id: "s4", branch_id: "b1", system_role: "driver", staff_type: "driver", is_active: true, archived_at: "2026-11-01T00:00:00Z" },
      { id: "s5", branch_id: "b1", system_role: "driver", staff_type: "driver", is_active: true, merged_into_staff_id: "staff-other" },
      { id: "s6", branch_id: null, system_role: "driver", staff_type: "driver", is_active: true },
    ];

    for (const profile of blockedProfiles) {
      mockState.staff = profile;
      const req = new NextRequest("https://www.cradlewellnessliving.com/api/staff/driver/apk-download", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status, `Expected 403 for profile ${String(profile.id)}`).toBe(403);
    }
  });

  it("rejects cross-origin POST requests with 403", async () => {
    const req = new NextRequest("https://www.cradlewellnessliving.com/api/staff/driver/apk-download", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("invalid_request_origin");
  });

  it("serves safe metadata on GET (no Drive URL) and returns verified Google Drive URL on same-origin POST for active drivers", async () => {
    const getRes = await GET();
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("cache-control")).toContain("no-store");
    expect(getRes.headers.get("referrer-policy")).toBe("no-referrer");
    const getBody = await getRes.json();
    expect(getBody.ok).toBe(true);
    expect(getBody.release.available).toBe(true);
    expect(getBody.release.versionName).toBe("1.0.0");
    expect(getBody.release.fileSizeLabel).toBe("91.1 MB");
    expect(JSON.stringify(getBody)).not.toContain("drive.google.com");

    const req = new NextRequest("https://www.cradlewellnessliving.com/api/staff/driver/apk-download", {
      method: "POST",
      headers: { origin: "https://www.cradlewellnessliving.com" },
    });
    const postRes = await POST(req);
    expect(postRes.status).toBe(200);
    expect(postRes.headers.get("cache-control")).toContain("no-store");
    expect(postRes.headers.get("referrer-policy")).toBe("no-referrer");
    const postBody = await postRes.json();
    expect(postBody).toMatchObject({
      ok: true,
      downloadUrl: SAMPLE_DRIVE_URL,
      provider: "google_drive",
      fileName: "CradleHub-Driver-v1.0.0.apk",
      versionName: "1.0.0",
      versionCode: 2,
      fileSizeBytes: 91131319,
      fileSizeLabel: "91.1 MB",
    });
  });

  it("allows designated administrators and immediately disables download when flag is switched off", async () => {
    mockState.staff = {
      id: "staff-owner-1",
      branch_id: null,
      system_role: "owner",
      staff_type: "managerial",
      is_active: true,
      archived_at: null,
      merged_into_staff_id: null,
    };

    const actor = await requireDriverApkActor();
    expect(actor.isAdmin).toBe(true);
    const issued = await issueDriverApkDownloadLink();
    expect(issued.downloadUrl).toBe(SAMPLE_DRIVE_URL);

    process.env.CRADLEHUB_DRIVER_APK_DISTRIBUTION_ENABLED = "false";
    const getRes = await GET();
    const getBody = await getRes.json();
    expect(getBody.release.available).toBe(false);
    expect(getBody.release.statusLabel).toBe("Not yet available");

    const postReq = new NextRequest("https://www.cradlewellnessliving.com/api/staff/driver/apk-download", {
      method: "POST",
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(503);
    const postBody = await postRes.json();
    expect(postBody.code).toBe("apk_not_available");
  });
});
