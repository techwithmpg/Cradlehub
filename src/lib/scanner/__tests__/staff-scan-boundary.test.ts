import React from "react";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import {
  claimStaffScanGrantAction,
  resolveStaffScanTargetAction,
} from "@/app/(dashboard)/staff/scan/actions";
import ProcessPage from "@/app/(dashboard)/staff/scan/process/[publicCode]/page";
import ActivatePage from "@/app/(dashboard)/staff/scan/activate/[token]/page";
import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";
import { DeviceRecoveryScreen } from "@/components/features/attendance/device-recovery-screen";
import { getRecoveryTokenPreview } from "@/lib/attendance/device-recovery";
import {
  STAFF_SCAN_GRANT_COOKIE,
  createStaffScanGrant,
  readStaffScanGrant,
} from "@/lib/scanner/staff-scan-grant";

const ledger = vi.hoisted(() => ({
  rows: new Map<string, {
    user_id: string;
    public_code: string;
    operation_id: string;
    expires_at: string;
    claimed_at: string | null;
  }>(),
  failInsert: false,
  claimCalls: 0,
}));
const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const auth = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: {
        token_hash: string;
        user_id: string;
        public_code: string;
        operation_id: string;
        expires_at: string;
      }) => {
        if (ledger.failInsert) return { error: { message: "unavailable" } };
        ledger.rows.set(row.token_hash, { ...row, claimed_at: null });
        return { error: null };
      },
    }),
    rpc: async (_name: string, args: {
      p_token_hash: string;
      p_user_id: string;
      p_public_code: string;
      p_operation_id: string;
    }) => {
      ledger.claimCalls += 1;
      const row = ledger.rows.get(args.p_token_hash);
      if (
        !row ||
        row.user_id !== args.p_user_id ||
        row.public_code !== args.p_public_code ||
        row.operation_id !== args.p_operation_id ||
        row.claimed_at !== null ||
        row.expires_at <= new Date().toISOString()
      ) return { data: null, error: null };
      row.claimed_at = new Date().toISOString();
      return { data: row.operation_id, error: null };
    },
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/components/features/attendance/public-scan-processor", () => ({
  PublicScanProcessor: vi.fn(),
}));
vi.mock("@/components/features/attendance/device-recovery-screen", () => ({
  DeviceRecoveryScreen: vi.fn(),
}));
vi.mock("@/lib/attendance/device-recovery", () => ({ getRecoveryTokenPreview: vi.fn() }));
const source = (path: string) => readFileSync(path, "utf8");
beforeAll(() => {
  vi.stubGlobal("React", React);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("Staff server boundary and adapter reuse", () => {
  it("executes real normalization through the async server action with no business outcome", async () => {
    cookieStore.set.mockClear();
    expect(await resolveStaffScanTargetAction(" att_test ")).toEqual({
      ok: true,
      target: "public_scan",
      publicCode: "att_test",
    });
    expect(await resolveStaffScanTargetAction("act_test")).toEqual({
      ok: true,
      target: "activation",
      token: "act_test",
    });
    expect(await resolveStaffScanTargetAction("javascript:bad")).toMatchObject({
      ok: false,
      target: "invalid",
    });
    expect(await resolveStaffScanTargetAction("room_test")).toMatchObject({
      ok: true,
      target: "public_scan",
      publicCode: "room_test",
    });
    expect(await resolveStaffScanTargetAction("res_test")).toMatchObject({
      ok: true,
      target: "public_scan",
      publicCode: "res_test",
    });
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set).toHaveBeenCalledWith(
      STAFF_SCAN_GRANT_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: "/staff/scan/process", maxAge: 120 })
    );
  });
  it("poisons resolver client imports; hook only emits raw payload and component uses server action", () => {
    expect(source("src/lib/scanner/resolve-scan-target.ts")).toContain('import "server-only"');
    const action = source("src/app/(dashboard)/staff/scan/actions.ts");
    expect(action.trimStart()).toMatch(/^"use server"/);
    expect(action).toContain("resolveStaffScanTarget(raw)");
    const hook = source("src/components/features/scanner/use-staff-scanner.ts");
    expect(hook).not.toMatch(/resolveStaffScanTarget|resolve-scan-target|supabase|fetch\(/);
    const component = source("src/components/features/scanner/staff-qr-scanner.tsx");
    expect(component).not.toMatch(/resolve-scan-target|confirmed|CheckCircle|\/api\/attendance/);
    expect(component).toContain("await resolveStaffScanTargetAction(raw)");
  });
  it("renders the existing scan processor in Staff scope and passes the scope to account retries", async () => {
    const element = await ProcessPage({ params: Promise.resolve({ publicCode: "att_test%20" }) });
    expect(element.props.children.type).toBe(PublicScanProcessor);
    expect(element.props.children.props).toEqual({
      mode: "scan",
      publicCode: "att_test%20",
      scanBasePath: "/staff/scan/process",
      locationRequired: false,
    });
    const adapter = source("src/app/(dashboard)/staff/scan/process/[publicCode]/page.tsx");
    expect(adapter).not.toMatch(/redirect|decodeURIComponent/);
    const processor = source("src/components/features/attendance/public-scan-processor.tsx");
    expect(processor).toContain('scanBasePath?: "/scan" | "/staff/scan/process"');
    expect(processor).toContain('props.scanBasePath ?? "/scan"');
    expect(processor).toContain('fetch("/api/attendance/public-scan"');
  });
  it("expires the browser cookie after a user-bound claim", async () => {
    cookieStore.set.mockReset();
    await resolveStaffScanTargetAction("att_test");
    const token = String(cookieStore.set.mock.calls[0]?.[1]);
    cookieStore.get.mockReturnValue({ value: token });
    cookieStore.set.mockImplementationOnce((_name, value) => {
      if (value === "") cookieStore.get.mockReturnValue(undefined);
    });
    expect(await claimStaffScanGrantAction("att_test")).toEqual(
      readStaffScanGrant(token, "att_test", "user-1")
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      STAFF_SCAN_GRANT_COOKIE,
      "",
      expect.objectContaining({ path: "/staff/scan/process", maxAge: 0 })
    );
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
    cookieStore.get.mockReturnValue({ value: createStaffScanGrant("att_test", "user-2") });
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
  });
  it("accepts exactly one concurrent claim and rejects replay or a switched user", async () => {
    cookieStore.set.mockReset();
    await resolveStaffScanTargetAction("att_test");
    const token = String(cookieStore.set.mock.calls[0]?.[1]);
    cookieStore.get.mockReturnValue({ value: token });
    cookieStore.set.mockImplementation(() => undefined);
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const [first, second] = await Promise.all([
      claimStaffScanGrantAction("att_test"),
      claimStaffScanGrantAction("att_test"),
    ]);
    expect(first?.operationId).toBeTruthy();
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-2" } } });
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
  });
  it("rejects wrong-user and expired claims before consuming an issued grant", async () => {
    cookieStore.set.mockReset();
    await resolveStaffScanTargetAction("att_test");
    const token = String(cookieStore.set.mock.calls[0]?.[1]);
    cookieStore.get.mockReturnValue({ value: token });
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-2" } } });
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
    expect(await claimStaffScanGrantAction("att_test")).toEqual(
      readStaffScanGrant(token, "att_test", "user-1")
    );
    const expired = createStaffScanGrant("att_test", "user-1", Date.now() - 120_001);
    cookieStore.get.mockReturnValue({ value: expired });
    const updatesBeforeExpired = ledger.claimCalls;
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
    expect(ledger.claimCalls).toBe(updatesBeforeExpired);
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
  });
  it("fails closed when grant storage is unavailable or the cookie response is interrupted", async () => {
    cookieStore.set.mockReset();
    await resolveStaffScanTargetAction("att_test");
    const oldToken = String(cookieStore.set.mock.calls[0]?.[1]);
    cookieStore.get.mockReturnValue({ value: oldToken });
    cookieStore.set.mockReset();
    cookieStore.set.mockImplementation((_name, value) => {
      if (value === "") cookieStore.get.mockReturnValue(undefined);
    });
    ledger.failInsert = true;
    expect(await resolveStaffScanTargetAction("att_test")).toMatchObject({
      ok: true,
      target: "public_scan",
      publicCode: "att_test",
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      STAFF_SCAN_GRANT_COOKIE,
      "",
      expect.objectContaining({ path: "/staff/scan/process", maxAge: 0 })
    );
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
    ledger.failInsert = false;
    cookieStore.set.mockReset();
    cookieStore.set.mockImplementationOnce(() => { throw new Error("response interrupted"); });
    await expect(resolveStaffScanTargetAction("att_test")).rejects.toThrow("response interrupted");
    cookieStore.get.mockReturnValue(undefined);
    expect(await claimStaffScanGrantAction("att_test")).toBeNull();
    cookieStore.set.mockReset();
  });
  it("uses the existing recovery preview and screen without a root-scope redirect", async () => {
    const preview = { ok: false, message: "Test rejection" } as Awaited<
      ReturnType<typeof getRecoveryTokenPreview>
    >;
    vi.mocked(getRecoveryTokenPreview).mockResolvedValue(preview);
    const element = await ActivatePage({ params: Promise.resolve({ token: "act_test%20" }) });
    expect(getRecoveryTokenPreview).toHaveBeenCalledExactlyOnceWith("act_test%20");
    expect(element.props.children.type).toBe(DeviceRecoveryScreen);
    expect(element.props.children.props).toEqual({ token: "act_test%20", preview });
    expect(source("src/app/(dashboard)/staff/scan/activate/[token]/page.tsx")).not.toMatch(
      /redirect|decodeURIComponent/
    );
  });
});
