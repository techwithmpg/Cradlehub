import { describe, expect, it, vi } from "vitest";
import { createStaffScanGrant, readStaffScanGrant } from "@/lib/scanner/staff-scan-grant";

vi.mock("server-only", () => ({}));

describe("Staff scanner operation grant", () => {
  it("binds one operation ID to the decoded code for two minutes", () => {
    const now = Date.now();
    const token = createStaffScanGrant("att_main", "user-1", now);
    const grant = readStaffScanGrant(token, "att_main", "user-1", now + 1000);
    expect(grant?.operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(readStaffScanGrant(token, "att_main", "user-1", now + 1000)).toEqual(grant);
    expect(readStaffScanGrant(token, "att_other", "user-1", now + 1000)).toBeNull();
    expect(readStaffScanGrant(token, "att_main", "user-2", now + 1000)).toBeNull();
    expect(readStaffScanGrant(token, "att_main", "user-1", now + 120_000)).toBeNull();
  });

  it("rejects a forged or malformed operation grant", () => {
    const token = createStaffScanGrant("att_main", "user-1");
    const [payload, signature] = token.split(".");
    expect(readStaffScanGrant(`${payload}.${"0".repeat(64)}`, "att_main", "user-1")).toBeNull();
    expect(readStaffScanGrant(`${payload}.${signature}.extra`, "att_main", "user-1")).toBeNull();
    expect(readStaffScanGrant(undefined, "att_main", "user-1")).toBeNull();
  });
});
