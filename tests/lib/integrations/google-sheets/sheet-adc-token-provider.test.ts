import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authState = vi.hoisted(() => ({
  options: null as unknown,
  getClient: vi.fn(),
  getAccessToken: vi.fn(),
}));
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    constructor(options: unknown) {
      authState.options = options;
    }
    getClient = authState.getClient;
  },
  Impersonated: class {
    constructor(public options: { targetPrincipal: string }) {}
    getAccessToken = authState.getAccessToken;
    getTargetPrincipal() {
      return this.options.targetPrincipal;
    }
  },
}));

import { Impersonated } from "google-auth-library";
import { createLocalAdcSheetTokenProvider } from "@/lib/integrations/google-sheets/sheet-adc-token-provider";

describe("local ADC Sheet token provider", () => {
  beforeEach(() => {
    authState.getClient.mockReset();
    authState.getAccessToken.mockReset();
    vi.unstubAllEnvs();
  });

  it("requests only the readonly scope from the expected impersonated identity", async () => {
    authState.getAccessToken.mockResolvedValue({ token: "ephemeral-test-token" });
    authState.getClient.mockResolvedValue(
      new Impersonated({
        targetPrincipal:
          "cradlehub-sheet-reader@cradle-massage-wellness-maps.iam.gserviceaccount.com",
      })
    );
    await expect(createLocalAdcSheetTokenProvider().getAccessToken()).resolves.toBe(
      "ephemeral-test-token"
    );
    expect(authState.options).toEqual({
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    expect(authState.getAccessToken).toHaveBeenCalledOnce();
  });

  it("rejects an unexpected impersonation target before requesting a token", async () => {
    authState.getAccessToken.mockResolvedValue({ token: "wrong-identity-token" });
    authState.getClient.mockResolvedValue(
      new Impersonated({ targetPrincipal: "other@example.com" })
    );
    await expect(createLocalAdcSheetTokenProvider().getAccessToken()).rejects.toThrow(
      "AUTH_NOT_CONFIGURED"
    );
    expect(authState.getAccessToken).not.toHaveBeenCalled();
  });

  it("returns a controlled state if ADC is unavailable", async () => {
    authState.getClient.mockRejectedValue(new Error("private ADC details"));
    await expect(createLocalAdcSheetTokenProvider().getAccessToken()).rejects.toThrow(
      "AUTH_NOT_CONFIGURED"
    );
  });

  it("blocks production before loading ADC", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(createLocalAdcSheetTokenProvider().getAccessToken()).rejects.toThrow(
      "AUTH_NOT_CONFIGURED"
    );
    expect(authState.getClient).not.toHaveBeenCalled();
  });
});
