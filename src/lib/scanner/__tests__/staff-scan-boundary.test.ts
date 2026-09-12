import React from "react";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { resolveStaffScanTargetAction } from "@/app/(dashboard)/staff/scan/actions";
import ProcessPage from "@/app/(dashboard)/staff/scan/process/[publicCode]/page";
import ActivatePage from "@/app/(dashboard)/staff/scan/activate/[token]/page";
import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";
import { DeviceRecoveryScreen } from "@/components/features/attendance/device-recovery-screen";
import { getRecoveryTokenPreview } from "@/lib/attendance/device-recovery";

vi.mock("server-only", () => ({}));
vi.mock("@/components/features/attendance/public-scan-processor", () => ({ PublicScanProcessor: vi.fn() }));
vi.mock("@/components/features/attendance/device-recovery-screen", () => ({ DeviceRecoveryScreen: vi.fn() }));
vi.mock("@/lib/attendance/device-recovery", () => ({ getRecoveryTokenPreview: vi.fn() }));
const source = (path: string) => readFileSync(path, "utf8");
beforeAll(() => { vi.stubGlobal("React", React); });
afterAll(() => { vi.unstubAllGlobals(); });

describe("Staff server boundary and adapter reuse", () => {
  it("executes real normalization through the async server action with no business outcome", async () => {
    expect(await resolveStaffScanTargetAction(" att_test ")).toEqual({ ok: true, target: "public_scan", publicCode: "att_test" });
    expect(await resolveStaffScanTargetAction("act_test")).toEqual({ ok: true, target: "activation", token: "act_test" });
    expect(await resolveStaffScanTargetAction("javascript:bad")).toMatchObject({ ok: false, target: "invalid" });
  });
  it("poisons resolver client imports; hook only emits raw payload and component uses server action", () => {
    expect(source("src/lib/scanner/resolve-scan-target.ts")).toContain('import "server-only"');
    const action = source("src/app/(dashboard)/staff/scan/actions.ts");
    expect(action.trimStart()).toMatch(/^"use server"/);
    expect(action).toContain("return resolveStaffScanTarget(raw)");
    const hook = source("src/components/features/scanner/use-staff-scanner.ts");
    expect(hook).not.toMatch(/resolveStaffScanTarget|resolve-scan-target|supabase|fetch\(/);
    const component = source("src/components/features/scanner/staff-qr-scanner.tsx");
    expect(component).not.toMatch(/resolve-scan-target|confirmed|CheckCircle|\/api\/attendance/);
    expect(component).toContain("await resolveStaffScanTargetAction(raw)");
  });
  it("renders the existing scan processor in Staff scope and passes the scope to account retries", async () => {
    const element = await ProcessPage({ params: Promise.resolve({ publicCode: "att_test%20" }) });
    expect(element.props.children.type).toBe(PublicScanProcessor);
    expect(element.props.children.props).toEqual({ mode: "scan", publicCode: "att_test%20", scanBasePath: "/staff/scan/process" });
    const adapter = source("src/app/(dashboard)/staff/scan/process/[publicCode]/page.tsx");
    expect(adapter).not.toMatch(/redirect|decodeURIComponent/);
    const processor = source("src/components/features/attendance/public-scan-processor.tsx");
    expect(processor).toContain('scanBasePath?: "/scan" | "/staff/scan/process"');
    expect(processor).toContain('props.scanBasePath ?? "/scan"');
    expect(processor).toContain('fetch("/api/attendance/public-scan"');
  });
  it("uses the existing recovery preview and screen without a root-scope redirect", async () => {
    const preview = { ok: false, message: "Test rejection" } as Awaited<ReturnType<typeof getRecoveryTokenPreview>>;
    vi.mocked(getRecoveryTokenPreview).mockResolvedValue(preview);
    const element = await ActivatePage({ params: Promise.resolve({ token: "act_test%20" }) });
    expect(getRecoveryTokenPreview).toHaveBeenCalledExactlyOnceWith("act_test%20");
    expect(element.props.children.type).toBe(DeviceRecoveryScreen);
    expect(element.props.children.props).toEqual({ token: "act_test%20", preview });
    expect(source("src/app/(dashboard)/staff/scan/activate/[token]/page.tsx")).not.toMatch(/redirect|decodeURIComponent/);
  });
});
