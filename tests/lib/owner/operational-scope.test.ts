import { describe, expect, it } from "vitest";
import { ownerOperationalScopeKey, ownerScopeSearch, resolveOwnerOperationalScope } from "@/lib/owner/operational-scope";
import { affectedWorkspaceModules } from "@/components/features/dashboard/workspace-domain-events";

const MAIN = "11111111-1111-4111-8111-111111111111";
const SM = "22222222-2222-4222-8222-222222222222";
const INACTIVE = "33333333-3333-4333-8333-333333333333";
const branches = [{ id: MAIN, name: "Main", sort_order: 2 }, { id: SM, name: "SM", sort_order: 1 }, { id: INACTIVE, name: "Closed", is_active: false }];
const resolve = (pathname: string, params: Record<string, string | string[] | undefined> = {}) => resolveOwnerOperationalScope({
  pathname, searchParams: ownerScopeSearch(params), authorizedBranches: branches, dispatchBranchId: SM,
});

describe("Owner route-aware operational scope", () => {
  it.each([MAIN, SM])("accepts the server-listed branch %s through Bookings' branch parameter", (id) => {
    expect(resolve("/owner/bookings", { branch: id })).toEqual({ kind: "branch", branchId: id });
  });
  it.each(["/owner/schedule", "/owner/attendance", "/owner/cash-flow", "/owner/spaces-rules", "/owner/reports"])("preserves branchId on %s", (route) => {
    expect(resolve(route, { branchId: SM })).toEqual({ kind: "branch", branchId: SM });
  });
  it.each([INACTIVE, "44444444-4444-4444-8444-444444444444"])("rejects inactive/unlisted optional scope %s without broadening to all", (id) => {
    expect(resolve("/owner/bookings", { branch: id })).toEqual({ kind: "unavailable" });
    expect(resolve("/owner/reports", { branchId: id })).toEqual({ kind: "unavailable" });
    expect(resolve("/owner/schedule", { branchId: id })).toEqual({ kind: "branch", branchId: MAIN });
    expect(resolve("/owner/attendance", { branchId: id })).toEqual({ kind: "branch", branchId: SM });
  });
  it("preserves different default orders and does not read the wrong route parameter", () => {
    expect(resolve("/owner/schedule", { branch: SM })).toEqual({ kind: "branch", branchId: MAIN });
    expect(resolve("/owner/attendance")).toEqual({ kind: "branch", branchId: SM });
    expect(resolve("/owner/bookings", { branchId: SM })).toEqual({ kind: "all-branches" });
  });
  it.each(["/owner", "/owner/bookings", "/owner/reports", "/owner/notifications"])("keeps %s explicitly aggregate", (route) => {
    expect(resolve(route)).toEqual({ kind: "all-branches" });
  });
  it("preserves Reports' explicit all sentinel and rejects ambiguous branch selections", () => {
    expect(resolve("/owner/reports", { branchId: "all" })).toEqual({ kind: "all-branches" });
    expect(resolve("/owner/bookings", { branch: [MAIN, SM] })).toEqual({ kind: "unavailable" });
  });
  it.each(["/owner/staff", "/owner/services", "/owner/branches", "/owner/marketing", "/owner/payroll", `/owner/branches/${MAIN}`, "/owner/staff/new"])("keeps %s global despite arbitrary branch parameters", (route) => {
    expect(resolve(route, { branch: SM, branchId: SM })).toEqual({ kind: "global" });
  });
  it("uses server-validated Front Desk identity for Dispatch, ignoring URL overrides", () => {
    expect(resolve("/owner/dispatch", { branchId: MAIN })).toEqual({ kind: "branch", branchId: SM });
    expect(resolveOwnerOperationalScope({ pathname: "/owner/dispatch", searchParams: new URLSearchParams(), authorizedBranches: branches, dispatchBranchId: INACTIVE })).toEqual({ kind: "unavailable" });
  });
  it("fails closed without active branches and separates branch/all/global keys", () => {
    expect(resolveOwnerOperationalScope({ pathname: "/owner/schedule", searchParams: new URLSearchParams(), authorizedBranches: [] })).toEqual({ kind: "unavailable" });
    const keys = [resolve("/owner/bookings", { branch: MAIN }), resolve("/owner/bookings", { branch: SM }), resolve("/owner/bookings"), resolve("/owner/services")].map(ownerOperationalScopeKey);
    expect(new Set(keys).size).toBe(4);
  });
});

describe("Owner semantic event scope", () => {
  const event = { name: "booking.status_changed" as const, branchId: MAIN, payload: {} };
  const modules = (path: string, params = {}) => affectedWorkspaceModules(event, { workspace: "owner", role: "owner", branchId: "unused",
    ownerEventScope: { scope: resolve(path, params), authorizedBranchIds: [MAIN, SM] } });
  it("isolates matching branches and also invalidates real aggregates", () => {
    expect(modules("/owner/bookings", { branch: SM })).toEqual([]);
    expect(modules("/owner/bookings", { branch: MAIN })).toContain("owner-bookings");
    expect(modules("/owner/bookings")).toContain("owner-bookings");
    expect(modules("/owner")).toContain("owner-overview");
  });
  it("rejects unlisted events even in aggregates", () => {
    expect(affectedWorkspaceModules({ ...event, branchId: INACTIVE }, { workspace: "owner", role: "owner", branchId: "unused",
      ownerEventScope: { scope: { kind: "all-branches" }, authorizedBranchIds: [MAIN, SM] } })).toEqual([]);
  });
});
