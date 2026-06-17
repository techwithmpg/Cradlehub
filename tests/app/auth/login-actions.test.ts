import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  getWorkspaceSwitchDestination: vi.fn(),
  logError: vi.fn(),
  redirect: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/get-user-workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
}));

vi.mock("@/lib/auth/workspace-access", () => ({
  getWorkspaceSwitchDestination: mocks.getWorkspaceSwitchDestination,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
}));

import { loginAction } from "@/app/(auth)/login/actions";
import { LOGIN_FAILURE_MESSAGE } from "@/app/(auth)/login/messages";

function loginFormData() {
  const formData = new FormData();
  formData.set("email", "staff@example.com");
  formData.set("password", "wrong-password");
  return formData;
}

beforeEach(() => {
  mocks.signInWithPassword.mockResolvedValue({ error: new Error("invalid") });
  mocks.createClient.mockResolvedValue({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      getUser: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("loginAction", () => {
  it("returns the generic reset-guided error on auth failure", async () => {
    const result = await loginAction({}, loginFormData());

    expect(result.error).toBe(LOGIN_FAILURE_MESSAGE);
    expect(result.error).toContain("reset your password");
  });
});
