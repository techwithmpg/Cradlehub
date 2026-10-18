import { describe, expect, it } from "vitest";
import { resolveWorkspaceModule } from "@/components/features/dashboard/workspace-retention-policy";

describe("PERF-8 CRM Cash Flow retention policy", () => {
  it("registers /crm/cash-flow as a high-cost retained module", () => {
    const descriptor = resolveWorkspaceModule(
      "crm",
      "/crm/cash-flow",
      "date=2026-10-18&tab=ledger&entry=payment&handover=session-1"
    );

    expect(descriptor).toEqual({
      workspace: "crm",
      moduleId: "crm-cash-flow",
      normalizedRoute: "/crm/cash-flow",
      stableSearchState: "date=2026-10-18&tab=ledger",
      staleTimeMs: 10_000,
      cost: "high",
    });
  });

  it("does not retain transactional entry or handover parameters", () => {
    const descriptor = resolveWorkspaceModule(
      "crm",
      "/crm/cash-flow",
      "entry=expense&handover=session-1"
    );

    expect(descriptor?.stableSearchState).toBe("");
  });

  it("does not match Owner Cash Flow or CRM child routes", () => {
    expect(
      resolveWorkspaceModule("owner", "/owner/cash-flow", "")
    ).toBeNull();
    expect(
      resolveWorkspaceModule("crm", "/crm/cash-flow/history", "")
    ).toBeNull();
  });
});
