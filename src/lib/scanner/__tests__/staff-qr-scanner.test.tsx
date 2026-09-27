// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffQrScanner } from "@/components/features/scanner/staff-qr-scanner";
import { resolveStaffScanTargetAction } from "@/app/(dashboard)/staff/scan/actions";
import type { ScannerState, UseStaffScannerOptions } from "@/components/features/scanner/use-staff-scanner";

const harness = vi.hoisted(() => ({
  push: vi.fn(),
  setState: vi.fn(),
  onDecode: null as UseStaffScannerOptions["onDecode"] | null,
  autoStart: null as boolean | null | undefined,
  state: "processing" as ScannerState,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push }),
  usePathname: () => "/staff",
}));
vi.mock("@/app/(dashboard)/staff/scan/actions", () => ({ resolveStaffScanTargetAction: vi.fn() }));
vi.mock("@/components/features/scanner/use-staff-scanner", () => ({
  useStaffScanner: ({ onDecode, autoStart }: UseStaffScannerOptions) => {
    harness.onDecode = onDecode;
    harness.autoStart = autoStart;
    return {
      state: harness.state,
      videoRef: { current: null },
      canvasRef: { current: null },
      startScan: vi.fn(),
      scanAgain: vi.fn(),
      setState: harness.setState,
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  harness.state = "processing";
  vi.stubGlobal("React", React);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Staff scanner server delegation", () => {
  it.each([
    [{ ok: true, target: "public_scan", publicCode: "att_a b" }, "/staff/scan/process/att_a%20b"],
    [{ ok: true, target: "activation", token: "act_a b" }, "/staff/scan/activate/act_a%20b"],
  ] as const)("waits for normalization then navigates inside Staff without operation success", async (result, path) => {
    let resolve!: (value: typeof result) => void;
    vi.mocked(resolveStaffScanTargetAction).mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(<StaffQrScanner returnHref="/staff/" />);
    act(() => { void harness.onDecode!("raw payload", "attempt"); });
    expect(resolveStaffScanTargetAction).toHaveBeenCalledExactlyOnceWith("raw payload");
    expect(harness.setState).toHaveBeenCalledExactlyOnceWith("processing");
    expect(harness.push).not.toHaveBeenCalled();
    await act(async () => { resolve(result); });
    expect(harness.push).toHaveBeenCalledExactlyOnceWith(path);
    expect(harness.setState.mock.calls).toEqual([["processing"]]);
    expect(screen.queryByText(/confirmed|success|recorded|redirecting/i)).toBeNull();
    expect(view.container.querySelector('.lucide-circle-check')).toBeNull();
  });
  it("maps server action failure to network_unknown", async () => {
    vi.mocked(resolveStaffScanTargetAction).mockRejectedValue(new Error("network"));
    render(<StaffQrScanner returnHref="/staff/" />);
    await act(async () => { await harness.onDecode!("att_test", "attempt"); });
    expect(harness.setState.mock.calls).toEqual([["processing"], ["network_unknown"]]);
    expect(harness.push).not.toHaveBeenCalled();
  });
  it("maps rejected payload to invalid without navigation", async () => {
    vi.mocked(resolveStaffScanTargetAction).mockResolvedValue({ ok: false, target: "invalid", reason: "bad" });
    render(<StaffQrScanner returnHref="/staff/" />);
    await act(async () => { await harness.onDecode!("bad", "attempt"); });
    expect(harness.setState.mock.calls).toEqual([["processing"], ["invalid"]]);
    expect(harness.push).not.toHaveBeenCalled();
  });
  it("does not navigate from a response arriving after unmount", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof resolveStaffScanTargetAction>>) => void;
    vi.mocked(resolveStaffScanTargetAction).mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(<StaffQrScanner returnHref="/staff/" />);
    act(() => { void harness.onDecode!("att_test", "attempt"); });
    view.unmount();
    await act(async () => { resolve({ ok: true, target: "public_scan", publicCode: "att_test" }); });
    expect(harness.push).not.toHaveBeenCalled();
  });
  it("enables autoStart on initial mount and requires no normal second Start Scanning control", () => {
    harness.state = "permission_request";
    render(<StaffQrScanner returnHref="/staff/" />);
    expect(harness.autoStart).toBe(true);
    expect(screen.queryByRole("button", { name: /start scanning/i })).toBeNull();
    expect(screen.queryByText(/tap start to begin scanning/i)).toBeNull();
    expect(screen.getAllByText(/starting camera…/i).length).toBeGreaterThan(0);
  });
  it("renders honest recovery controls on permission denial or pause without start button", () => {
    harness.state = "permission_denied";
    const view1 = render(<StaffQrScanner returnHref="/staff/" />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /start scanning/i })).toBeNull();
    view1.unmount();

    harness.state = "paused";
    const view2 = render(<StaffQrScanner returnHref="/staff/" />);
    expect(screen.getByRole("button", { name: /scan again/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /start scanning/i })).toBeNull();
    view2.unmount();
  });
  it("displays truthful camera privacy copy and never claims 'No data stored on device'", () => {
    render(<StaffQrScanner returnHref="/staff/" />);
    expect(screen.queryByText(/no data stored on device/i)).toBeNull();
    expect(screen.getByText(/camera active only while scanning · camera images are not saved/i)).toBeDefined();
  });
  it("verifies Scan nav performs full document navigation to /staff/scan via standard anchor", async () => {
    const { StaffBottomNav } = await import("@/components/features/staff-pwa/bottom-nav");
    const { PROVIDER_NAV_ITEMS } = await import("@/components/features/staff-pwa/role-navigation");
    const view = render(<StaffBottomNav items={PROVIDER_NAV_ITEMS} />);
    const scanLink = screen.getByRole("link", { name: /scan qr code/i });
    expect(scanLink.tagName.toLowerCase()).toBe("a");
    expect(scanLink.getAttribute("href")).toBe("/staff/scan");
    view.unmount();
  });
});
