import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RECOVERY_SESSION_COOKIE } from "@/lib/auth/auth-redirects";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  logError: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
}));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "auth-user-id" } },
    error: null,
  });
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
      verifyOtp: mocks.verifyOtp,
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("/auth/callback", () => {
  it("does not treat an untyped authorization code as password recovery", async () => {
    const response = await GET(
      new NextRequest(
        "https://cradlewellnessliving.com/auth/callback?code=abc&next=/reset-password"
      )
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cradlewellnessliving.com/select-workspace"
    );
    expect(response.headers.get("set-cookie")).toContain(`${PASSWORD_RECOVERY_SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("sanitizes external next paths back to workspace selection", async () => {
    const response = await GET(
      new NextRequest(
        "https://cradlewellnessliving.com/auth/callback?code=abc&next=https://evil.test"
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://cradlewellnessliving.com/select-workspace"
    );
    expect(response.headers.get("set-cookie")).toContain(`${PASSWORD_RECOVERY_SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("can verify recovery token-hash callbacks", async () => {
    const response = await GET(
      new NextRequest(
        "https://cradlewellnessliving.com/auth/callback?token_hash=token&type=recovery&next=/reset-password"
      )
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "token",
      type: "recovery",
    });
    expect(response.headers.get("location")).toBe(
      "https://cradlewellnessliving.com/reset-password"
    );
    expect(mocks.getUser).toHaveBeenCalledOnce();
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${PASSWORD_RECOVERY_SESSION_COOKIE}=1`);
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).toContain("Path=/reset-password");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
  });

  it("exchanges explicit recovery codes and marks only a verified recovery session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(
      new NextRequest(
        "https://www.cradlewellnessliving.com/auth/callback?code=abc&type=recovery&next=/reset-password"
      )
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(
      "https://www.cradlewellnessliving.com/reset-password"
    );
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("shows the branded invalid-link state when recovery verification fails", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: new Error("expired") });

    const response = await GET(
      new NextRequest(
        "https://www.cradlewellnessliving.com/auth/callback?token_hash=expired&type=recovery&next=/reset-password"
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://www.cradlewellnessliving.com/reset-password?error=invalid_or_expired"
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects a recovery callback when no authenticated user was established", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(
      new NextRequest(
        "https://www.cradlewellnessliving.com/auth/callback?code=abc&type=recovery&next=/reset-password"
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://www.cradlewellnessliving.com/reset-password?error=invalid_or_expired"
    );
  });

  it("handles provider and malformed recovery errors without exposing provider details", async () => {
    const providerResponse = await GET(
      new NextRequest(
        "https://www.cradlewellnessliving.com/auth/callback?error=access_denied&error_description=Sensitive+provider+detail&type=recovery&next=/reset-password"
      )
    );
    const malformedResponse = await GET(
      new NextRequest(
        "https://www.cradlewellnessliving.com/auth/callback?type=recovery&next=/reset-password"
      )
    );

    expect(providerResponse.headers.get("location")).toBe(
      "https://www.cradlewellnessliving.com/reset-password?error=invalid_or_expired"
    );
    expect(providerResponse.headers.get("location")).not.toContain("Sensitive");
    expect(malformedResponse.headers.get("location")).toBe(
      "https://www.cradlewellnessliving.com/reset-password?error=invalid_or_expired"
    );
  });

  it("rejects token hashes with a non-recovery type", async () => {
    const response = await GET(
      new NextRequest(
        "https://www.cradlewellnessliving.com/auth/callback?token_hash=token&type=signup&next=/reset-password"
      )
    );

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://www.cradlewellnessliving.com/reset-password?error=invalid_or_expired"
    );
  });
});
