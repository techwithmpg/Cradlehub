// @vitest-environment jsdom
import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { useStaffScanner } from "@/components/features/scanner/use-staff-scanner";

vi.mock("jsqr", () => ({ default: vi.fn(() => null) }));
let hidden = false;
let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
const getUserMedia = vi.fn();
function media() {
  const stops = [vi.fn(), vi.fn()];
  return { stops, stream: { getTracks: () => stops.map(stop => ({ stop })) } as unknown as MediaStream };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function setup(autoStart = false) {
  const onDecode = vi.fn();
  const hook = renderHook(() => useStaffScanner({ onDecode, autoStart }));
  const video = document.createElement("video");
  Object.defineProperties(video, {
    readyState: { value: 2 }, videoWidth: { value: 2 }, videoHeight: { value: 2 },
  });
  video.play = vi.fn().mockResolvedValue(undefined);
  const canvas = document.createElement("canvas");
  canvas.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }),
  });
  hook.result.current.videoRef.current = video;
  hook.result.current.canvasRef.current = canvas;
  return { ...hook, onDecode, video };
}
async function start(hook: ReturnType<typeof setup>) {
  await act(async () => { hook.result.current.startScan(); });
  await act(async () => { hook.video.dispatchEvent(new Event("loadedmetadata")); });
}
async function frame() {
  const entry = frames.entries().next().value;
  if (!entry) throw new Error("No decoder frame scheduled");
  frames.delete(entry[0]);
  await act(async () => { await entry[1](0); });
  return entry[1];
}
function visibility(value: boolean) {
  act(() => { hidden = value; document.dispatchEvent(new Event("visibilitychange")); });
}
beforeEach(() => {
  vi.clearAllMocks();
  hidden = false;
  frames = new Map();
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  vi.stubGlobal("React", React);
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { frames.set(++nextFrame, cb); return nextFrame; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { frames.delete(id); }));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  delete (window as unknown as Record<string, unknown>).BarcodeDetector;
  vi.mocked(jsQR).mockReturnValue(null);
  getUserMedia.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Staff scanner capture lifecycle", () => {
  it("stops every track on hide, clears video, cancels decode; visible waits for explicit retry", async () => {
    const first = media(); const second = media();
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    const hook = setup();
    await start(hook);
    expect(hook.result.current.state).toBe("scanning");
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: "environment" } }, audio: false });
    visibility(true);
    first.stops.forEach(stop => expect(stop).toHaveBeenCalledOnce());
    expect(hook.video.srcObject).toBeNull();
    expect(frames.size).toBe(0);
    expect(hook.result.current.state).toBe("paused");
    visibility(false);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => { hook.result.current.scanAgain(); });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(hook.video.srcObject).toBe(second.stream);
    hook.unmount();
    second.stops.forEach(stop => expect(stop).toHaveBeenCalledOnce());
  });
  it("stops a late permission stream after hiding without attaching or decoding it", async () => {
    const pending = deferred<MediaStream>(); const late = media();
    getUserMedia.mockReturnValue(pending.promise);
    const hook = setup();
    act(() => { hook.result.current.startScan(); });
    visibility(true); visibility(false);
    await act(async () => { pending.resolve(late.stream); });
    late.stops.forEach(stop => expect(stop).toHaveBeenCalledOnce());
    expect(hook.video.srcObject).toBeNull();
    expect(hook.onDecode).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
  it("locks duplicate jsQR frames and passes the unclassified raw payload once", async () => {
    const active = media(); getUserMedia.mockResolvedValue(active.stream);
    const hook = setup(); await start(hook);
    vi.mocked(jsQR).mockReturnValue({ data: "javascript:untrusted" } as ReturnType<typeof jsQR>);
    const callback = await frame();
    await act(async () => { callback(0); });
    expect(hook.onDecode).toHaveBeenCalledExactlyOnceWith("javascript:untrusted", expect.any(String));
    expect(hook.result.current.state).toBe("code_detected");
    active.stops.forEach(stop => expect(stop).toHaveBeenCalledOnce());
    expect(frames.size).toBe(0);
  });
  it("discards native decode completing after hide and never restarts in the background", async () => {
    const pending = deferred<{ rawValue: string }[]>();
    const detect = vi.fn(() => pending.promise);
    vi.stubGlobal("BarcodeDetector", class { detect = detect; });
    const active = media(); getUserMedia.mockResolvedValue(active.stream);
    const hook = setup(); await start(hook);
    const entry = frames.entries().next().value!; frames.delete(entry[0]);
    let decoding: unknown;
    act(() => { decoding = entry[1](0); });
    visibility(true); visibility(false);
    await act(async () => { pending.resolve([{ rawValue: "att_test" }]); await decoding; });
    expect(hook.onDecode).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    active.stops.forEach(stop => expect(stop).toHaveBeenCalledOnce());
  });
  it("locks native decode duplicates and retains jsQR fallback when native construction fails", async () => {
    const detect = vi.fn().mockResolvedValue([{ rawValue: "act_test" }]);
    vi.stubGlobal("BarcodeDetector", class { detect = detect; });
    getUserMedia.mockResolvedValue(media().stream);
    const hook = setup(); await start(hook);
    const callback = await frame();
    await act(async () => { await callback(0); });
    expect(hook.onDecode).toHaveBeenCalledExactlyOnceWith("act_test", expect.any(String));
    vi.stubGlobal("BarcodeDetector", class { constructor() { throw new Error("unsupported"); } });
    await act(async () => { hook.result.current.scanAgain(); });
    await act(async () => { hook.video.dispatchEvent(new Event("loadedmetadata")); });
    await frame();
    expect(jsQR).toHaveBeenCalledOnce();
  });
  it("does not resume from a late play promise after hide", async () => {
    getUserMedia.mockResolvedValue(media().stream);
    const hook = setup(); const play = deferred<void>(); hook.video.play = vi.fn(() => play.promise);
    await start(hook); visibility(true); visibility(false);
    await act(async () => { play.resolve(); });
    expect(frames.size).toBe(0);
    expect(hook.result.current.state).toBe("paused");
  });
  it("falls back to another camera without audio and reports permission denial", async () => {
    getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    const hook = setup(); await start(hook);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: true, audio: false });
    expect(hook.result.current.state).toBe("permission_denied");
  });
  it("automatically attempts startScan on initial mount when autoStart is enabled without second tap", async () => {
    const streamObj = media();
    getUserMedia.mockResolvedValue(streamObj.stream);
    const onDecode = vi.fn();
    const hook = renderHook(() => useStaffScanner({ onDecode, autoStart: true }));
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    expect(hook.result.current.state).toBe("permission_request");
    hook.unmount();
  });
  it("does not auto-loop on permission denial with autoStart", async () => {
    getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    const onDecode = vi.fn();
    const hook = renderHook(() => useStaffScanner({ onDecode, autoStart: true }));
    await act(async () => {});
    expect(hook.result.current.state).toBe("permission_denied");
    // Primary attempt + fallback attempt only, no infinite loop
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    hook.unmount();
  });
  it("does not auto-resume when returning from hidden state with autoStart", async () => {
    const streamObj = media();
    getUserMedia.mockResolvedValue(streamObj.stream);
    const hook = setup(true);
    await act(async () => {});
    await act(async () => { hook.video.dispatchEvent(new Event("loadedmetadata")); });
    expect(hook.result.current.state).toBe("scanning");

    visibility(true);
    expect(hook.result.current.state).toBe("paused");
    visibility(false);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state).toBe("paused");
    hook.unmount();
  });
  it("explicitly reacquires camera on scanAgain after pause or denial", async () => {
    const first = media(); const second = media();
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    const hook = setup(true);
    await act(async () => {});
    await act(async () => { hook.video.dispatchEvent(new Event("loadedmetadata")); });
    visibility(true);
    expect(hook.result.current.state).toBe("paused");
    visibility(false);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await act(async () => { hook.result.current.scanAgain(); });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    hook.unmount();
  });
});
