import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RECOVERY_SESSION_COOKIE } from "@/lib/auth/auth-redirects";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
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
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/auth/callback", () => {
  it("routes recovery callbacks to reset-password and marks the recovery session", async () => {
    const response = await GET(
      new NextRequest("https://cradlewellnessliving.com/auth/callback?code=abc&next=/reset-password")
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe(
      "https://cradlewellnessliving.com/reset-password"
    );
    expect(response.headers.get("set-cookie")).toContain(
      PASSWORD_RECOVERY_SESSION_COOKIE
    );
  });

  it("sanitizes external next paths back to workspace selection", async () => {
    const response = await GET(
      new NextRequest("https://cradlewellnessliving.com/auth/callback?code=abc&next=https://evil.test")
    );

    expect(response.headers.get("location")).toBe(
      "https://cradlewellnessliving.com/select-workspace"
    );
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      PASSWORD_RECOVERY_SESSION_COOKIE
    );
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
  });
});
