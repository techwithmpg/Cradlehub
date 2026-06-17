import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RECOVERY_SESSION_COOKIE } from "@/lib/auth/auth-redirects";
import { PASSWORD_REQUIREMENT_MESSAGE } from "@/lib/auth/password-policy";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  createClient: vi.fn(),
  getStaffAccountAccessRequestContext: vi.fn(() => ({
    ipHash: null,
    userAgent: null,
  })),
  getUser: vi.fn(),
  headers: vi.fn(),
  logError: vi.fn(),
  recordStaffAccountAccessEvent: vi.fn(),
  selectStaff: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.cookieDelete,
    get: mocks.cookieGet,
  })),
  headers: mocks.headers,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/account-access-events", () => ({
  getEmailDomain: (email: string | null | undefined) =>
    email?.split("@")[1]?.toLowerCase() ?? null,
  getStaffAccountAccessRequestContext: mocks.getStaffAccountAccessRequestContext,
  normalizeAuditEmail: (email: string | null | undefined) =>
    email?.trim().toLowerCase() || null,
  recordStaffAccountAccessEvent: mocks.recordStaffAccountAccessEvent,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
}));

import { updatePasswordAction } from "@/app/(auth)/reset-password/actions";

function resetFormData(password: string, confirmPassword = password) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("confirmPassword", confirmPassword);
  return formData;
}

beforeEach(() => {
  mocks.headers.mockResolvedValue(new Headers());
  mocks.cookieGet.mockReturnValue({ value: "1" });
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        email: "staff@example.com",
        id: "auth-user-id",
      },
    },
    error: null,
  });
  mocks.recordStaffAccountAccessEvent.mockResolvedValue(undefined);
  mocks.selectStaff.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "staff-id" },
        error: null,
      }),
    }),
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      updateUser: mocks.updateUser,
    },
    from: vi.fn(() => ({
      select: mocks.selectStaff,
    })),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("updatePasswordAction", () => {
  it("rejects weak passwords", async () => {
    const result = await updatePasswordAction({}, resetFormData("weakpass1"));

    expect(result.fieldErrors?.password).toBe(PASSWORD_REQUIREMENT_MESSAGE);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects password mismatches", async () => {
    const result = await updatePasswordAction(
      {},
      resetFormData("Strong123", "Strong124")
    );

    expect(result.fieldErrors?.confirmPassword).toBe("Passwords do not match");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("requires the recovery-session marker before updating", async () => {
    mocks.cookieGet.mockImplementation((name: string) =>
      name === PASSWORD_RECOVERY_SESSION_COOKIE ? undefined : null
    );

    const result = await updatePasswordAction({}, resetFormData("Strong123"));

    expect(result.error).toBe("This password-reset link is invalid or has expired.");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates the Supabase user password and signs out the recovery session", async () => {
    const result = await updatePasswordAction({}, resetFormData("Strong123"));

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "Strong123" });
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.cookieDelete).toHaveBeenCalledWith(PASSWORD_RECOVERY_SESSION_COOKIE);
    expect(result.status).toBe("success");
  });
});
