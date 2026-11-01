/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const location = vi.hoisted(() => ({
  needsLocationExplanation: vi.fn(),
  freshAttendanceLocation: vi.fn(),
}));
const scanner = vi.hoisted(() => ({
  push: vi.fn(),
  resolveTarget: vi.fn(),
}));
vi.mock("@/lib/attendance/browser-location", () => location);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: scanner.push }) }));
vi.mock("@/app/(dashboard)/staff/scan/actions", () => ({
  resolveStaffScanTargetAction: scanner.resolveTarget,
}));
import { useStaffScanLocation } from "@/components/features/scanner/use-staff-scan-location";
import { StaffQrScanner } from "@/components/features/scanner/staff-qr-scanner";
import { useStaffScanner } from "@/components/features/scanner/use-staff-scanner";

function Probe({ required = true }: { required?: boolean }) {
  const ready = useStaffScanLocation(required);
  return (
    <section>
      <span data-testid="state">{ready.state}</span>
      <span data-testid="accuracy">{ready.accuracyMeters ?? "-"}</span>
      <button type="button" onClick={ready.request}>
        Enable or retry
      </button>
    </section>
  );
}

function CameraProbe() {
  const camera = useStaffScanner({ onDecode: vi.fn(), autoStart: true });
  return (
    <section>
      <output>{camera.state}</output>
      <button onClick={camera.scanAgain}>Resume camera</button>
    </section>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  location.needsLocationExplanation.mockResolvedValue("ready");
  location.freshAttendanceLocation.mockResolvedValue({
    latitude: 10.6713191,
    longitude: 122.9437447,
    accuracy: 15,
    timestamp: Date.now(),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

describe("Staff PWA scanner location readiness", () => {
  it("asks for a deliberate tap on first-time permission", async () => {
    location.needsLocationExplanation.mockResolvedValue("explain");
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("permission_needed"));
    expect(location.freshAttendanceLocation).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button")));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
    expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(1);
  });

  it("silently prepares granted GPS before QR decoding", async () => {
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
    expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(1);
  });

  it("requires action for an inaccurate indoor GPS fix, then retries", async () => {
    location.freshAttendanceLocation.mockResolvedValueOnce({
      latitude: 10.6713191,
      longitude: 122.9437447,
      accuracy: 160,
      timestamp: Date.now(),
    });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inaccurate"));
    expect(screen.getByTestId("accuracy").textContent).toBe("160");
    await act(async () => fireEvent.click(screen.getByRole("button")));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
  });

  it("does not acquire location if geofencing is disabled", () => {
    render(<Probe required={false} />);
    expect(screen.getByTestId("state").textContent).toBe("ready");
    expect(location.freshAttendanceLocation).not.toHaveBeenCalled();
  });

  it("guides permission-denied staff and permits retry after settings change", async () => {
    location.needsLocationExplanation.mockResolvedValue("denied");
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("denied"));
    expect(location.freshAttendanceLocation).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button")));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
  });

  it("shows unavailable after GPS failure and recovers on a deliberate retry", async () => {
    location.freshAttendanceLocation.mockRejectedValueOnce("location_unavailable");
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("unavailable"));
    expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
    expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(2);
  });

  it.each([
    { latitude: 91, longitude: 122.9437447, accuracy: 15, timestamp: Date.now() },
    { latitude: 10.6713191, longitude: Number.NaN, accuracy: 15, timestamp: Date.now() },
    { latitude: 10.6713191, longitude: 122.9437447, accuracy: 15, timestamp: Date.now() - 60_000 },
    { latitude: 10.6713191, longitude: 122.9437447, accuracy: 0, timestamp: Date.now() },
  ])("does not enable scanning for malformed or stale GPS %#", async (fix) => {
    location.freshAttendanceLocation.mockResolvedValueOnce(fix);
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("unavailable"));
    expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(1);
  });

  it("ignores an in-flight reading after the scanner is backgrounded", async () => {
    let resolveFix!: (fix: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: number;
    }) => void;
    location.freshAttendanceLocation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFix = resolve;
      })
    );
    render(<Probe />);
    await waitFor(() => expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(1));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () =>
      resolveFix({
        latitude: 10.6713191,
        longitude: 122.9437447,
        accuracy: 15,
        timestamp: Date.now(),
      })
    );
    expect(screen.getByTestId("state").textContent).not.toBe("ready");
  });

  it("offers recovery when the GPS request never settles", async () => {
    vi.useFakeTimers();
    location.freshAttendanceLocation.mockReturnValueOnce(new Promise(() => {}));
    render(<Probe />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_100);
    });
    expect(screen.getByTestId("state").textContent).toBe("unavailable");
    vi.useRealTimers();
  });
});

describe("Staff QR camera handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    location.needsLocationExplanation.mockResolvedValue("ready");
    location.freshAttendanceLocation.mockResolvedValue({
      latitude: 10.6713191,
      longitude: 122.9437447,
      accuracy: 15,
      timestamp: Date.now(),
    });
  });

  it("mounts the viewfinder and starts the camera without waiting for GPS", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const { unmount } = render(<StaffQrScanner returnHref="/staff" locationRequired />);
    expect(screen.getByRole("img", { name: "QR code viewfinder" })).toBeTruthy();
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    const video = screen.getByRole("img", { name: "QR code viewfinder" }).querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.srcObject).toBe(stream);
    expect(screen.queryByRole("button", { name: "Enable Location" })).toBeNull();
    expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(1);
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("releases the camera on hide and requires a deliberate resume", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<StaffQrScanner returnHref="/staff" locationRequired />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(stop).toHaveBeenCalled());
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(screen.getByText(/Camera paused/)).toBeTruthy());
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Scan again/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });

  it("keeps the camera active while foreground GPS readiness is renewed", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<StaffQrScanner returnHref="/staff" locationRequired />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    let resolveFix!: (fix: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: number;
    }) => void;
    location.freshAttendanceLocation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFix = resolve;
      })
    );
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(location.freshAttendanceLocation).toHaveBeenCalledTimes(2));
    expect(stop).not.toHaveBeenCalled();
    await act(async () =>
      resolveFix({
        latitude: 10.6713191,
        longitude: 122.9437447,
        accuracy: 15,
        timestamp: Date.now(),
      })
    );
    expect(screen.queryByText(/Camera paused/)).toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("shows a retry when camera acquisition never settles", async () => {
    vi.useFakeTimers();
    const getUserMedia = vi.fn().mockReturnValue(new Promise(() => {}));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<StaffQrScanner returnHref="/staff" locationRequired />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_100);
    });
    expect(screen.getByText("Camera unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Scan again/i })).toBeTruthy();
    vi.useRealTimers();
  });

  it("decodes a QR once and routes to the fresh-location processing page", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    vi.stubGlobal(
      "BarcodeDetector",
      class {
        detect = vi.fn().mockResolvedValue([{ rawValue: "SM-QR" }]);
      }
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0)
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    scanner.resolveTarget.mockResolvedValue({
      ok: true,
      target: "public_scan",
      publicCode: "SM-QR",
    });
    render(<StaffQrScanner returnHref="/staff" locationRequired />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    const video = screen.getByRole("img", { name: "QR code viewfinder" }).querySelector("video");
    expect(video).toBeTruthy();
    fireEvent.loadedMetadata(video!);
    await waitFor(() => expect(scanner.push).toHaveBeenCalledWith("/staff/scan/process/SM-QR"));
    expect(scanner.resolveTarget).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
  });

  it("leaves a camera start interrupted by backgrounding recoverable", async () => {
    const getUserMedia = vi.fn().mockReturnValue(new Promise(() => {}));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    render(<CameraProbe />);
    await waitFor(() => expect(screen.getByText("paused")).toBeTruthy());
    expect(getUserMedia).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resume camera" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  });
});
