import { describe, expect, it } from "vitest";
import { resolveWorkspaceModule } from "@/components/features/dashboard/workspace-retention-policy";

describe("PERF-7 CRM Staff retention policy", () => {
  it("registers /crm/staff as one high-cost retained module", () => {
    const descriptor = resolveWorkspaceModule(
      "crm",
      "/crm/staff",
      "tab=management&status=active"
    );

    expect(descriptor).toEqual({
      workspace: "crm",
      moduleId: "crm-staff",
      normalizedRoute: "/crm/staff",
      stableSearchState: "tab=management",
      staleTimeMs: 60_000,
      cost: "high",
    });
  });

  it("does not match unrelated Staff child or Owner routes", () => {
    expect(
      resolveWorkspaceModule("crm", "/crm/staff/new", "")
    ).toBeNull();
    expect(
      resolveWorkspaceModule("owner", "/owner/staff", "")
    ).toBeNull();
  });
});
