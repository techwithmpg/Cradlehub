import { describe, expect, it } from "vitest";
import {
  customerWorkspaceUrl,
  normalizeCustomerPage,
  normalizeCustomerSearch,
  normalizeCustomerTab,
} from "@/components/features/crm/customers/customer-workspace-data";

describe("PERF-6 CRM Customers URL state", () => {
  it("builds canonical shareable segment URLs without stale page or search state", () => {
    expect(customerWorkspaceUrl({ tab: "repeat", page: 1 })).toBe(
      "/crm/customers?tab=repeat"
    );
    expect(
      customerWorkspaceUrl({ tab: "all", page: 3, search: "Ana Cruz" })
    ).toBe("/crm/customers?tab=all&page=3&q=Ana+Cruz");
  });

  it("normalizes absent URL state to All / page 1 instead of an earlier server snapshot", () => {
    expect(normalizeCustomerTab(null)).toBe("all");
    expect(normalizeCustomerPage(null)).toBe(1);
    expect(normalizeCustomerSearch(null)).toBeUndefined();
  });

  it("rejects invalid tab/page values without inventing a new segment", () => {
    expect(normalizeCustomerTab("vip")).toBe("all");
    expect(normalizeCustomerPage("-4")).toBe(1);
    expect(normalizeCustomerPage("not-a-number")).toBe(1);
  });
});
