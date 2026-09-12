// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffQrScanner } from "@/components/features/scanner/staff-qr-scanner";
import { resolveStaffScanTargetAction } from "@/app/(dashboard)/staff/scan/actions";
import type { UseStaffScannerOptions } from "@/components/features/scanner/use-staff-scanner";

const harness = vi.hoisted(() => ({ push: vi.fn(), setState: vi.fn(), onDecode: null as UseStaffScannerOptions["onDecode"] | null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: harness.push }) }));
vi.mock("@/app/(dashboard)/staff/scan/actions", () => ({ resolveStaffScanTargetAction: vi.fn() }));
vi.mock("@/components/features/scanner/use-staff-scanner", () => ({
  useStaffScanner: ({ onDecode }: UseStaffScannerOptions) => {
    harness.onDecode = onDecode;
    return { state: "processing", videoRef: { current: null }, canvasRef: { current: null }, startScan: vi.fn(), scanAgain: vi.fn(), setState: harness.setState };
  },
}));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("React", React); });
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
});
