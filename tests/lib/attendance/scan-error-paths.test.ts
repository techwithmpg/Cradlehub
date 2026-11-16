import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const adminClient = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));

import { getAttendanceSettings } from "@/lib/attendance/queries";
import { consumeDeviceRecoveryLink } from "@/lib/attendance/device-recovery";
import { activateDeviceWithToken } from "@/lib/attendance/scan-engine";

function queryBuilder(result: unknown) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

describe("attendance scan structured error paths", () => {
  beforeEach(() => {
    adminClient.from.mockReset();
    adminClient.rpc.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not treat attendance settings query errors as missing settings", async () => {
    adminClient.from.mockImplementation((table: string) =>
      queryBuilder({ data: null, error: table === "attendance_settings" ? {
          code: "42501",
          message: "permission denied for table attendance_settings",
        } : null })
    );

    await expect(getAttendanceSettings("branch-1")).rejects.toMatchObject({
      code: "ATTENDANCE_RLS_DENIED",
      dbCode: "42501",
      details: {
        stage: "get_attendance_settings",
        branchId: "branch-1",
      },
    });
    expect(adminClient.from).toHaveBeenCalledWith("attendance_settings");
  });

  it("keeps fallback branch lookup failures structured while creating settings", async () => {
    adminClient.from.mockImplementation((table: string) =>
        queryBuilder({ data: null, error: table === "branches" ? {
            code: "42501",
            message: "permission denied for table branches",
          } : null })
      );

    await expect(getAttendanceSettings("branch-2")).rejects.toMatchObject({
      code: "ATTENDANCE_RLS_DENIED",
      details: {
        stage: "require_branch",
        branchId: "branch-2",
      },
    });
  });

  it("does not treat activation token lookup failures as invalid links", async () => {
    adminClient.from.mockReturnValueOnce(
      queryBuilder({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the device activation token query in the schema cache.",
        },
      })
    );

    await expect(
      activateDeviceWithToken("activation-token", {
        requestId: "attendance-activation-test",
        userAgent: "Vitest",
      })
    ).rejects.toMatchObject({
      code: "ATTENDANCE_RPC_SIGNATURE_MISMATCH",
      details: {
        stage: "activate_device_token_lookup",
      },
      operationId: "attendance-activation-test",
    });
  });

  it.each([true, false])("fails closed on rule-version errors with settings present=%s", async (hasSettings) => {
    adminClient.from.mockImplementation((table: string) => queryBuilder({
      data: table === "attendance_settings" && hasSettings ? { branch_id: "branch-rules" } : null,
      error: table === "attendance_rule_versions" ? { code: "42501", message: "TEST rule access denied" } : null,
    }));
    await expect(getAttendanceSettings("branch-rules")).rejects.toMatchObject({
      code: "ATTENDANCE_RLS_DENIED", details: { stage: "get_effective_attendance_rule_version", branchId: "branch-rules" },
    });
    expect(adminClient.from).not.toHaveBeenCalledWith("branches");
  });

  it("maps recovery RPC failures to structured attendance errors", async () => {
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "42883",
        message: "function public.consume_attendance_device_recovery does not exist",
      },
    });

    await expect(
      consumeDeviceRecoveryLink({
        rawToken: "recovery-token",
        userAgent: "Vitest",
      })
    ).rejects.toMatchObject({
      code: "ATTENDANCE_RPC_MISSING",
      details: {
        stage: "consume_attendance_device_recovery",
      },
    });
    expect(adminClient.rpc).toHaveBeenCalledWith(
      "consume_attendance_device_recovery",
      expect.objectContaining({
        p_raw_token: "recovery-token",
        p_active_device_limit: 2,
      })
    );
  });
});
