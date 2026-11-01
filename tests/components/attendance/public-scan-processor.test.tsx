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
  disconnectAttendancePhoneAction: vi.fn(),
  signInAndRegisterAttendanceDeviceAction: vi.fn(),
  switchScanAccountAction: vi.fn(),
}));
const browserLocationMocks = vi.hoisted(() => ({
  freshAttendanceLocation: vi.fn(),
  needsLocationExplanation: vi.fn(),
  warmAttendanceLocation: vi.fn(),
}));
const grantMocks = vi.hoisted(() => ({ claimStaffScanGrantAction: vi.fn() }));

vi.mock("@/app/scan/actions", () => actionMocks);
vi.mock("@/app/(dashboard)/staff/scan/actions", () => grantMocks);
vi.mock("@/lib/attendance/browser-location", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/attendance/browser-location")>()),
  ...browserLocationMocks,
}));
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

function response(result: PublicScanResult, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(result),
  } as unknown as Response;
}

async function finishTimers(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await vi.runAllTimersAsync();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(unknownDevice)));
  Object.values(actionMocks).forEach((mock) => mock.mockReset());
  Object.values(browserLocationMocks).forEach((mock) => mock.mockReset());
  grantMocks.claimStaffScanGrantAction.mockReset().mockResolvedValue(null);
  browserLocationMocks.needsLocationExplanation.mockResolvedValue("ready");
  browserLocationMocks.freshAttendanceLocation.mockResolvedValue({
    latitude: 10.6713191,
    longitude: 122.9437447,
    accuracy: 15,
    timestamp: Date.now(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PublicScanProcessor first-device continuation", () => {
  it("does not auto-retry a consumed scanner grant after a failed location attempt", async () => {
    grantMocks.claimStaffScanGrantAction
      .mockResolvedValueOnce({ operationId: "scanner-one-use" })
      .mockResolvedValueOnce(null);
    browserLocationMocks.freshAttendanceLocation.mockRejectedValueOnce("location_unavailable");
    const fetchMock = vi.fn().mockResolvedValue(response(finalAttendance));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(
      <PublicScanProcessor
        mode="scan"
        publicCode="att_main"
        scanBasePath="/staff/scan/process"
        locationRequired
      />
    );
    await act(async () => {
      await Promise.resolve();
    });
    await finishTimers();
    expect(screen.getByRole("heading", { name: "Location needed" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    first.unmount();
    render(
      <PublicScanProcessor
        mode="scan"
        publicCode="att_main"
        scanBasePath="/staff/scan/process"
        locationRequired
      />
    );
    await finishTimers();
    expect(screen.getByRole("heading", { name: "QR code recognized" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(grantMocks.claimStaffScanGrantAction).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Record attendance" }));
    await finishTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps manual attendance unavailable while a scanner grant claim is pending", async () => {
    let resolveClaim!: (value: { operationId: string } | null) => void;
    grantMocks.claimStaffScanGrantAction.mockReturnValue(
      new Promise((resolve) => {
        resolveClaim = resolve;
      })
    );
    const fetchMock = vi.fn().mockResolvedValue(response(finalAttendance));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PublicScanProcessor
        mode="scan"
        publicCode="att_main"
        scanBasePath="/staff/scan/process"
        locationRequired
      />
    );
    expect(screen.getByRole("status").textContent).toContain("Preparing this scan");
    expect(screen.queryByRole("button", { name: "Record attendance" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => resolveClaim(null));
    fireEvent.click(screen.getByRole("button", { name: "Record attendance" }));
    await finishTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed after a stalled grant claim and ignores a late grant during manual processing", async () => {
    let resolveClaim!: (value: { operationId: string } | null) => void;
    grantMocks.claimStaffScanGrantAction.mockReturnValue(
      new Promise((resolve) => {
        resolveClaim = resolve;
      })
    );
    let resolveResponse!: (value: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PublicScanProcessor
        mode="scan"
        publicCode="att_main"
        scanBasePath="/staff/scan/process"
        locationRequired
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_100);
    });
    expect(screen.getByRole("button", { name: "Record attendance" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Record attendance" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestId = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)
    ).requestId;
    await act(async () => resolveClaim({ operationId: "too-late" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)).requestId).toBe(
      requestId
    );
    await act(async () => resolveResponse(response(finalAttendance)));
    await finishTimers();
    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
  });

  it("shows QR, location, and attendance stages in order before a successful result", async () => {
    let resolveLocation!: (value: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: number;
    }) => void;
    let resolveResponse!: (value: Response) => void;
    browserLocationMocks.freshAttendanceLocation.mockReturnValue(
      new Promise((resolve) => {
        resolveLocation = resolve;
      })
    );
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicScanProcessor mode="scan" autoProcess publicCode="att_main" locationRequired />);
    expect(screen.getByRole("heading", { name: "QR code recognized" })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByRole("heading", { name: "Verifying location..." })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () =>
      resolveLocation({
        latitude: 10.6713191,
        longitude: 122.9437447,
        accuracy: 15,
        timestamp: Date.now(),
      })
    );
    expect(screen.getByRole("heading", { name: "Validating attendance..." })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveResponse(response(finalAttendance)));
    await finishTimers();
    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
  });

  it("asks for location permission after QR recognition and before any scan request", async () => {
    browserLocationMocks.needsLocationExplanation.mockResolvedValue("explain");
    const fetchMock = vi.fn().mockResolvedValue(response(finalAttendance));
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicScanProcessor mode="scan" autoProcess publicCode="att_main" locationRequired />);
    await finishTimers();
    expect(screen.getByRole("heading", { name: "Enable location for attendance" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(browserLocationMocks.freshAttendanceLocation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enable Location" }));
    await finishTimers();
    expect(browserLocationMocks.freshAttendanceLocation).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a direct printed QR URL inert until an explicit attendance action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(finalAttendance));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(
      <PublicScanProcessor mode="scan" publicCode="att_main" locationRequired />
    );
    await finishTimers();
    expect(screen.getByRole("heading", { name: "QR code recognized" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record attendance" })).toBeTruthy();
    expect(browserLocationMocks.freshAttendanceLocation).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    first.unmount();

    // A refresh, bookmark, or history entry starts from the same inert state.
    render(<PublicScanProcessor mode="scan" publicCode="att_main" locationRequired />);
    await finishTimers();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Record attendance" }));
    await finishTimers();
    expect(browserLocationMocks.freshAttendanceLocation).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
  });

  it("reuses the scanner operation ID on a route refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(finalAttendance));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(
      <PublicScanProcessor
        mode="scan"
        autoProcess
        operationId="scanner-operation-1"
        publicCode="att_main"
        locationRequired
      />
    );
    await finishTimers();
    first.unmount();
    render(
      <PublicScanProcessor
        mode="scan"
        autoProcess
        operationId="scanner-operation-1"
        publicCode="att_main"
        locationRequired
      />
    );
    await finishTimers();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body))
    );
    expect(requests.map((request) => request.requestId)).toEqual([
      "scanner-operation-1",
      "scanner-operation-1",
    ]);
    expect(browserLocationMocks.freshAttendanceLocation).toHaveBeenCalledTimes(2);
  });

  it("reacquires fresh GPS after QR decode before sending a scan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(finalAttendance));
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicScanProcessor mode="scan" autoProcess publicCode="MAIN-QR" locationRequired />);
    await finishTimers();
    expect(browserLocationMocks.freshAttendanceLocation).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(request?.body).toEqual(expect.any(String));
    const payload = JSON.parse(String(request?.body));
    expect(payload).toMatchObject({
      publicCode: "MAIN-QR",
      location: { latitude: 10.6713191, longitude: 122.9437447, accuracy: 15 },
    });
    expect(payload.requestId).toEqual(expect.any(String));
  });

  it("does not send a scan when fresh GPS acquisition fails", async () => {
    browserLocationMocks.freshAttendanceLocation.mockRejectedValue("location_unavailable");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicScanProcessor mode="scan" autoProcess publicCode="MAIN-QR" locationRequired />);
    await finishTimers();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Location needed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try location again" })).toBeTruthy();
  });

  it("offers on-site GPS guidance and recovers with a new fix and authorized scan", async () => {
    const outside: PublicScanResult = {
      ok: false,
      outcome: "blocked",
      reasonCode: "location_outside",
      severity: "warning",
      title: "On-site scan required",
      message: "You must be on-site to scan attendance. No Attendance change was made.",
    };
    const initialFix = {
      latitude: 10.672,
      longitude: 122.944,
      accuracy: 20,
      timestamp: Date.now(),
    };
    const recoveredFix = {
      latitude: 10.6713191,
      longitude: 122.9437447,
      accuracy: 12,
      timestamp: Date.now() + 1_000,
    };
    browserLocationMocks.freshAttendanceLocation
      .mockResolvedValueOnce(initialFix)
      .mockResolvedValueOnce(recoveredFix);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(outside))
      .mockResolvedValueOnce(response(finalAttendance));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicScanProcessor
        mode="scan"
        autoProcess
        publicCode="SM-QR"
        scanBasePath="/staff/scan/process"
        locationRequired
      />
    );
    await finishTimers();
    expect(screen.getByRole("heading", { name: "On-site scan required" })).toBeTruthy();
    expect(
      screen.getByText(/already at your assigned branch, enable Precise Location/)
    ).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Try location again" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);
    await finishTimers();
    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
    expect(browserLocationMocks.freshAttendanceLocation).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body)
    );
    const second = JSON.parse(
      String((fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.body)
    );
    expect(first.location).toEqual(initialFix);
    expect(second.location).toEqual(recoveredFix);
    expect(second.requestId).toBe(first.requestId);
  });

  it("opens the connection form automatically and hides the technical unknown-device result", async () => {
    render(<PublicScanProcessor mode="scan" autoProcess publicCode="MAIN-QR" />);
    await finishTimers();

    expect(screen.getByRole("heading", { name: "Connect this phone" })).toBeTruthy();
    expect(screen.getByText(/continue your original Attendance scan/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect phone and finish scan" })).toBeTruthy();
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

    render(<PublicScanProcessor mode="scan" autoProcess publicCode="MAIN-QR" />);
    await finishTimers();
    fireEvent.change(screen.getByLabelText("Your staff email"), {
      target: { value: "nikki@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect phone and finish scan" }));

    expect(screen.getByRole("button", { name: "Connecting this phone…" })).toBeTruthy();
    await finishTimers();

    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).toHaveBeenCalledTimes(1);
    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        publicCode: "MAIN-QR",
        email: "nikki@example.com",
        password: "correct-password",
      })
    );
    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
    expect(screen.getByText(finalAttendance.attendance!.staffName)).toBeTruthy();
    expect(screen.queryByText(/scan again/i)).toBeNull();
  });

  it("returns an invalid sign-in to the same connection form", async () => {
    actionMocks.signInAndRegisterAttendanceDeviceAction.mockResolvedValueOnce({
      ok: false,
      error: "Check your email and password, then try again.",
    });

    render(<PublicScanProcessor mode="scan" autoProcess publicCode="MAIN-QR" />);
    await finishTimers();
    fireEvent.change(screen.getByLabelText("Your staff email"), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect phone and finish scan" }));
    await act(async () => Promise.resolve());

    expect(screen.getByRole("heading", { name: "Connect this phone" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Check your email and password");
    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).toHaveBeenCalledTimes(1);
  });

  it("keeps a revoked phone blocked instead of entering registration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ok: false,
          outcome: "blocked",
          reasonCode: "device_revoked",
          severity: "critical",
          title: "This phone is no longer approved",
          message: "Ask CRM to review or replace this phone.",
        })
      )
    );

    render(<PublicScanProcessor mode="scan" autoProcess publicCode="MAIN-QR" />);
    await finishTimers();

    expect(screen.getByRole("heading", { name: "This phone is no longer approved" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Connect this phone" })).toBeNull();
    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).not.toHaveBeenCalled();
  });

  it("renders a successful Test Mode result with an explicit non-live status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ok: true,
          outcome: "success",
          reasonCode: "clock_in",
          severity: "success",
          title: "Clocked in",
          message: "Attendance recorded.",
          isTest: true,
          operationId: "safe-test-receipt",
          attendance: {
            action: "clock_in",
            staffName: "Nicole Santos",
            branchName: "Cradle Main",
            branchTimezone: "Asia/Manila",
            shiftLabel: "single",
            occurredAt: "2026-07-29T01:52:00.000Z",
            sessionStartedAt: "2026-07-29T01:52:00.000Z",
          },
        })
      )
    );

    render(<PublicScanProcessor mode="scan" autoProcess publicCode="MAIN-QR" />);
    await finishTimers();

    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Training Mode" }).textContent).toBe(
      "Training Mode · Not live Attendance"
    );
    expect(screen.queryByLabelText("Your staff email")).toBeNull();
    expect(actionMocks.signInAndRegisterAttendanceDeviceAction).not.toHaveBeenCalled();
  });
});
