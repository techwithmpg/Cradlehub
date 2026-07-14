/**
 * @vitest-environment jsdom
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";
import type { PublicScanResult } from "@/lib/attendance/types";

const actionMocks = vi.hoisted(() => ({
  activateDeviceAction: vi.fn(),
  requestBranchCorrectionAction: vi.fn(),
  signInAndRegisterAttendanceDeviceAction: vi.fn(),
  tryAnotherScanAccountAction: vi.fn(),
}));

vi.mock("@/app/scan/actions", () => actionMocks);
vi.mock("@/components/shared/brand-logo", () => ({
  BrandLogo: () => <div data-testid="brand-logo" />,
}));

const unknownDevice: PublicScanResult = {
  ok: false,
  outcome: "blocked",
  reasonCode: "unknown_device",
  severity: "warning",
  title: "Device not registered",
  message: "Activate this device before scanning.",
  operationId: "unknown-device-operation",
};

const finalAttendance: PublicScanResult = {
  ok: true,
  outcome: "success",
  reasonCode: "clock_in",
  severity: "success",
  title: "Welcome in, Nikki ☀️",
  message: "You’re clocked in at 9:52 AM. Have a lovely day!",
  attendance: {
    action: "clock_in",
    staffName: "Nicole Santos",
    branchName: "Cradle Main",
    branchTimezone: "Asia/Manila",
    shiftLabel: "single",
    occurredAt: "2026-07-15T01:52:00.000Z",
    sessionStartedAt: "2026-07-15T01:52:00.000Z",
  },
};

function response(result: PublicScanResult): Response {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(result),
  } as unknown as Response;
}

async function finishTimers(): Promise<void> {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(unknownDevice)));
  Object.values(actionMocks).forEach((mock) => mock.mockReset());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PublicScanProcessor first-device continuation", () => {
  it("opens the connection form automatically and hides the technical unknown-device result", async () => {
    render(<PublicScanProcessor mode="scan" publicCode="MAIN-QR" />);
    await finishTimers();

    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeTruthy();
    expect(screen.getByText(/connect it and continue your attendance scan/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect phone and continue" })).toBeTruthy();
    expect(screen.queryByText("Device not registered")).toBeNull();
    expect(screen.queryByText("unknown-device-operation")).toBeNull();
  });

  it("connects the phone once and continues the same scan to its final result", async () => {
    actionMocks.signInAndRegisterAttendanceDeviceAction.mockResolvedValueOnce({
      ok: true,
      deviceRegistered: true,
      cookieSet: true,
      nextScanRequired: false,
      staffDeviceId: "device-1",
      staffName: "Nicole Santos",
      branchName: "Cradle Main",
      message: "This phone is now connected for faster attendance scans.",
      result: finalAttendance,
    });

    render(<PublicScanProcessor mode="scan" publicCode="MAIN-QR" />);
    await finishTimers();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "nikki@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect phone and continue" }));

    expect(screen.getByRole("button", { name: "Connecting phone…" })).toBeTruthy();
    await finishTimers();

    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).toHaveBeenCalledTimes(1);
    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        publicCode: "MAIN-QR",
        email: "nikki@example.com",
        password: "correct-password",
      })
    );
    expect(screen.getByRole("heading", { name: finalAttendance.title })).toBeTruthy();
    expect(screen.queryByText(/scan again/i)).toBeNull();
  });

  it("returns an invalid sign-in to the same connection form", async () => {
    actionMocks.signInAndRegisterAttendanceDeviceAction.mockResolvedValueOnce({
      ok: false,
      error: "Check your email and password, then try again.",
    });

    render(<PublicScanProcessor mode="scan" publicCode="MAIN-QR" />);
    await finishTimers();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect phone and continue" }));
    await act(async () => Promise.resolve());

    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Check your email and password");
    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).toHaveBeenCalledTimes(1);
  });

  it("keeps a revoked phone blocked instead of entering registration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      ok: false,
      outcome: "blocked",
      reasonCode: "device_revoked",
      severity: "critical",
      title: "This phone is no longer approved",
      message: "Ask CRM to review or replace this phone.",
    })));

    render(<PublicScanProcessor mode="scan" publicCode="MAIN-QR" />);
    await finishTimers();

    expect(screen.getByRole("heading", { name: "This phone is no longer approved" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sign in to continue" })).toBeNull();
    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).not.toHaveBeenCalled();
  });
});
