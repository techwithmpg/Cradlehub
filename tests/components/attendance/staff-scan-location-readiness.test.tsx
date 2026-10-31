/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const location = vi.hoisted(() => ({
  needsLocationExplanation: vi.fn(),
  freshAttendanceLocation: vi.fn(),
}));
vi.mock("@/lib/attendance/browser-location", () => location);
import { useStaffScanLocation } from "@/components/features/scanner/use-staff-scan-location";

function Probe({ required = true }: { required?: boolean }) {
  const ready = useStaffScanLocation(required);
  return (
    <section>
      <span data-testid="state">{ready.state}</span>
      <span data-testid="accuracy">{ready.accuracyMeters ?? "-"}</span>
      <button type="button" onClick={ready.request}>Enable or retry</button>
    </section>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  location.needsLocationExplanation.mockResolvedValue("ready");
  location.freshAttendanceLocation.mockResolvedValue({
    latitude: 10.6713191, longitude: 122.9437447, accuracy: 15, timestamp: Date.now(),
  });
});
afterEach(cleanup);

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
      latitude: 10.6713191, longitude: 122.9437447, accuracy: 160, timestamp: Date.now(),
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
});
