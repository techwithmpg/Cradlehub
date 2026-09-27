// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";

const state = vi.hoisted(() => ({
  switchScanAccountAction: vi.fn().mockResolvedValue(undefined),
  disconnectAttendancePhoneAction: vi.fn().mockResolvedValue(undefined),
  props: null as null | { onSwitchAccount: () => Promise<void>; onDisconnectPhone: () => Promise<void> },
}));
vi.mock("@/app/scan/actions", () => ({
  switchScanAccountAction: state.switchScanAccountAction,
  disconnectAttendancePhoneAction: state.disconnectAttendancePhoneAction,
  activateDeviceAction: vi.fn(), requestBranchCorrectionAction: vi.fn(), signInAndRegisterAttendanceDeviceAction: vi.fn(),
}));
vi.mock("@/components/features/attendance/public-scan-result", () => ({
  PublicScanResultView: (props: NonNullable<typeof state.props>) => { state.props = props; return null; },
}));
vi.mock("@/components/features/attendance/public-scan-stage", () => ({ PublicScanStage: () => null }));
vi.mock("@/components/features/attendance/public-scan-login-form", () => ({ PublicScanLoginForm: () => null }));
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, title: "Blocked", message: "Rejected", reasonCode: "device_revoked" }) }));
  state.props = null;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Reused processor account retries", () => {
  it.each([
    [undefined, "/scan/att_a%20b"],
    ["/staff/scan/process", "/staff/scan/process/att_a%20b"],
  ] as const)("keeps the existing default or supplied Staff scope: %s", async (base, expected) => {
    render(<PublicScanProcessor mode="scan" publicCode="att_a b" scanBasePath={base} />);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(state.props).not.toBeNull();
    const originalWindow = window;
    const replace = vi.fn();
    // Only the retry callbacks run against this stub, after the real component
    // renders with mocked subsystem responses. No navigation or server mutation.
    vi.stubGlobal("window", { location: { replace, reload: vi.fn() } });
    try {
      await state.props!.onSwitchAccount();
      await state.props!.onDisconnectPhone();
    } finally {
      vi.stubGlobal("window", originalWindow);
    }
    expect(state.switchScanAccountAction).toHaveBeenCalledOnce();
    expect(state.disconnectAttendancePhoneAction).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledTimes(2);
    for (const [url] of replace.mock.calls) expect(url).toMatch(new RegExp(`^${expected}\\?scan=.+`));
  });
});
