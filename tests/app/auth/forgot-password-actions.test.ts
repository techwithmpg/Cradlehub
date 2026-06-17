import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getStaffAccountAccessRequestContext: vi.fn(() => ({
    ipHash: null,
    userAgent: null,
  })),
  hasRecentAccountRecoveryEvent: vi.fn(),
  headers: vi.fn(),
  logError: vi.fn(),
  recordStaffAccountAccessEvent: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/account-access-events", () => ({
  getEmailDomain: (email: string | null | undefined) =>
    email?.split("@")[1]?.toLowerCase() ?? null,
  getStaffAccountAccessRequestContext: mocks.getStaffAccountAccessRequestContext,
  hasRecentAccountRecoveryEvent: mocks.hasRecentAccountRecoveryEvent,
  normalizeAuditEmail: (email: string | null | undefined) =>
    email?.trim().toLowerCase() || null,
  recordStaffAccountAccessEvent: mocks.recordStaffAccountAccessEvent,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
}));

import { requestPasswordResetAction } from "@/app/(auth)/forgot-password/actions";

function formDataForEmail(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

beforeEach(() => {
  mocks.headers.mockResolvedValue(new Headers());
  mocks.hasRecentAccountRecoveryEvent.mockResolvedValue(false);
  mocks.recordStaffAccountAccessEvent.mockResolvedValue(undefined);
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("requestPasswordResetAction", () => {
  it("builds the local reset URL in development", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    const result = await requestPasswordResetAction(
      {},
      formDataForEmail("USER@example.com")
    );

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "http://localhost:3000/reset-password",
    });
    expect(result.message).toContain("If an account is connected to that email");
  });

  it("builds the production reset URL from NEXT_PUBLIC_APP_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cradlewellnessliving.com/");
    vi.stubEnv("NODE_ENV", "production");

    await requestPasswordResetAction({}, formDataForEmail("staff@example.com"));

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("staff@example.com", {
      redirectTo: "https://cradlewellnessliving.com/reset-password",
    });
  });

  it("fails safely when the production app URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    const result = await requestPasswordResetAction(
      {},
      formDataForEmail("staff@example.com")
    );

    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(result.error).toBe("We could not send the reset link right now. Please try again.");
  });

  it("uses the safe cooldown message for rapid duplicate requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cradlewellnessliving.com");
    mocks.hasRecentAccountRecoveryEvent.mockResolvedValue(true);

    const result = await requestPasswordResetAction(
      {},
      formDataForEmail("staff@example.com")
    );

    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(result.message).toBe(
      "A reset request was recently sent. Please wait before trying again."
    );
  });
});
