import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getOidc: vi.fn(),
  verifyOidc: vi.fn(),
  fromJSON: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock("@vercel/oidc", () => ({
  getVercelOidcToken: mocks.getOidc,
  verifyVercelOidcToken: mocks.verifyOidc,
}));
vi.mock("google-auth-library", () => ({
  ExternalAccountClient: { fromJSON: mocks.fromJSON },
}));

import {
  createVercelWifSheetTokenProvider,
  productionSheetAuthConfig,
} from "@/lib/integrations/google-sheets/sheet-vercel-wif-token-provider";

const originalEnv = process.env;
const validEnv = {
  NODE_ENV: "production",
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: "prj_Expected123",
  CRADLE_SHEET_WIF_PROJECT_NUMBER: "123456789012",
  CRADLE_SHEET_WIF_POOL_ID: "vercel-production",
  CRADLE_SHEET_WIF_PROVIDER_ID: "cradle-web",
  CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL:
    "cradle-prod-sheet-reader@cradle-production.iam.gserviceaccount.com",
  CRADLE_SHEET_WIF_VERCEL_TEAM_ID: "team_Expected123",
  CRADLE_SHEET_WIF_VERCEL_PROJECT_ID: "prj_Expected123",
  CRADLE_SHEET_WIF_VERCEL_ISSUER: "https://oidc.vercel.com/cradle-team",
  CRADLE_SHEET_WIF_VERCEL_SUBJECT: "owner:cradle-team:project:cradle-web:environment:production",
} as const;
const audience =
  "https://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/vercel-production/providers/cradle-web";

beforeEach(() => {
  process.env = { ...originalEnv, ...validEnv };
  mocks.getOidc.mockReset().mockResolvedValue("private-oidc-assertion");
  mocks.verifyOidc.mockReset().mockResolvedValue({
    payload: { sub: validEnv.CRADLE_SHEET_WIF_VERCEL_SUBJECT },
  });
  mocks.getAccessToken.mockReset().mockResolvedValue({ token: "private-google-access-token" });
  mocks.fromJSON.mockReset().mockImplementation(() => ({
    getServiceAccountEmail: () => validEnv.CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL,
    getAccessToken: mocks.getAccessToken,
  }));
});

afterEach(() => {
  process.env = originalEnv;
});

describe("production keyless Sheet provider", () => {
  it("binds the signed production assertion to the exact team, project, subject, issuer, and audience", async () => {
    expect(await createVercelWifSheetTokenProvider().getAccessToken()).toBe(
      "private-google-access-token"
    );
    expect(mocks.getOidc).toHaveBeenCalledWith({ audience });
    expect(mocks.verifyOidc).toHaveBeenCalledWith("private-oidc-assertion", {
      audience,
      issuer: validEnv.CRADLE_SHEET_WIF_VERCEL_ISSUER,
      ownerId: validEnv.CRADLE_SHEET_WIF_VERCEL_TEAM_ID,
      projectId: validEnv.CRADLE_SHEET_WIF_VERCEL_PROJECT_ID,
      environment: "production",
    });
    expect(mocks.fromJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: audience.replace("https:", ""),
        token_url: "https://sts.googleapis.com/v1/token",
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${validEnv.CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
        service_account_impersonation: { token_lifetime_seconds: 600 },
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      })
    );
    const config = mocks.fromJSON.mock.calls[0]![0];
    expect(await config.subject_token_supplier.getSubjectToken()).toBe("private-oidc-assertion");
    expect(mocks.getOidc).toHaveBeenCalledOnce();
    expect(mocks.verifyOidc.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.fromJSON.mock.invocationCallOrder[0]!
    );
  });

  it.each([
    ["missing project number", "CRADLE_SHEET_WIF_PROJECT_NUMBER", undefined],
    ["malformed pool", "CRADLE_SHEET_WIF_POOL_ID", "../other"],
    ["malformed provider", "CRADLE_SHEET_WIF_PROVIDER_ID", "https://evil.example"],
    ["malformed service account", "CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL", "bad@example.com"],
    [
      "local identity reused",
      "CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL",
      "cradlehub-sheet-reader@cradle-massage-wellness-maps.iam.gserviceaccount.com",
    ],
    ["wrong Vercel project", "VERCEL_PROJECT_ID", "prj_Other"],
    ["static OIDC assertion", "VERCEL_OIDC_TOKEN", "private-oidc-assertion"],
    ["OIDC token file", "VERCEL_OIDC_TOKEN_FILE", "/tmp/oidc-token"],
    ["missing team", "CRADLE_SHEET_WIF_VERCEL_TEAM_ID", undefined],
    ["malformed issuer", "CRADLE_SHEET_WIF_VERCEL_ISSUER", "https://evil.example"],
    [
      "preview subject",
      "CRADLE_SHEET_WIF_VERCEL_SUBJECT",
      "owner:cradle-team:project:cradle-web:environment:preview",
    ],
  ])("fails closed for %s before OIDC acquisition", async (_, name, value) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
    await expect(createVercelWifSheetTokenProvider().getAccessToken()).rejects.toThrow(
      "AUTH_UNAVAILABLE"
    );
    expect(mocks.getOidc).not.toHaveBeenCalled();
    expect(mocks.fromJSON).not.toHaveBeenCalled();
  });

  it.each(["preview", "development", "staging", ""])(
    "rejects Vercel environment %s before OIDC acquisition",
    async (environment) => {
      process.env.VERCEL_ENV = environment;
      await expect(createVercelWifSheetTokenProvider().getAccessToken()).rejects.toThrow(
        "AUTH_UNAVAILABLE"
      );
      expect(mocks.getOidc).not.toHaveBeenCalled();
    }
  );

  it("rejects an unexpected signed subject before Google exchange", async () => {
    mocks.verifyOidc.mockResolvedValueOnce({ payload: { sub: "other" } });
    await expect(createVercelWifSheetTokenProvider().getAccessToken()).rejects.toThrow(
      "AUTH_UNAVAILABLE"
    );
    expect(mocks.fromJSON).not.toHaveBeenCalled();
  });

  it("rejects a different impersonation target returned by the auth client", async () => {
    mocks.fromJSON.mockReturnValueOnce({
      getServiceAccountEmail: () => "other@other-project.iam.gserviceaccount.com",
      getAccessToken: mocks.getAccessToken,
    });
    await expect(createVercelWifSheetTokenProvider().getAccessToken()).rejects.toThrow(
      "AUTH_UNAVAILABLE"
    );
    expect(mocks.getAccessToken).not.toHaveBeenCalled();
  });

  it("sanitizes OIDC, verification, and Google errors", async () => {
    for (const failing of [mocks.getOidc, mocks.verifyOidc, mocks.getAccessToken]) {
      failing.mockRejectedValueOnce(
        new Error("private-oidc-assertion private-google-access-token")
      );
      await expect(createVercelWifSheetTokenProvider().getAccessToken()).rejects.toThrow(
        /^AUTH_UNAVAILABLE$/
      );
    }
  });

  it("derives trusted Google endpoints and does not accept a caller target", () => {
    const config = productionSheetAuthConfig(process.env);
    expect(config.serviceAccountEmail).toBe(validEnv.CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL);
    expect(config.audience).toBe(audience);
    expect(config).not.toHaveProperty("spreadsheetId");
    expect(config).not.toHaveProperty("scope");
  });
});
