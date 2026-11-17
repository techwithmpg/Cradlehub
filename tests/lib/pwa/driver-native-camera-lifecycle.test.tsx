// @vitest-environment jsdom
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { useStaffScanner } from "@/components/features/scanner/use-staff-scanner";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("pauses camera acquisition when the native shell leaves Scan", () => {
  const decode = vi.fn();
  const { result } = renderHook(() => useStaffScanner({ onDecode: decode }));
  act(() => window.dispatchEvent(new Event("cradle-driver-camera-pause")));
  expect(result.current.state).toBe("paused");
  expect(decode).not.toHaveBeenCalled();
});

it("closes a camera stream that resolves after leaving the native Scan pane", async () => {
  let resolve!: (stream: MediaStream) => void;
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(
        () =>
          new Promise<MediaStream>((done) => {
            resolve = done;
          })
      ),
    },
  });
  const { result } = renderHook(() => useStaffScanner({ onDecode: vi.fn() }));
  act(() => {
    result.current.startScan();
  });
  act(() => window.dispatchEvent(new Event("cradle-driver-camera-pause")));
  await act(async () => {
    resolve(stream);
    await Promise.resolve();
  });
  expect(stop).toHaveBeenCalledOnce();
  expect(result.current.state).toBe("paused");
});
