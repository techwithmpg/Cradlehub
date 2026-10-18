import { describe, expect, it } from "vitest";
import { resolveWorkspaceModule } from "@/components/features/dashboard/workspace-retention-policy";
import { isRetainedWorkspaceEnabled } from "@/lib/config/mvp-flags";

describe("PERF-9A Owner Overview retention policy", () => {
  it("registers Owner Overview as an all-branches retained module with no URL restoration state", () => {
    const descriptor = resolveWorkspaceModule(
      "owner",
      "/owner",
      "branch=should-not-stick&date=2026-10-18"
    );

    expect(descriptor).toEqual({
      workspace: "owner",
      moduleId: "owner-overview",
      normalizedRoute: "/owner",
      stableSearchState: "",
      staleTimeMs: 45_000,
      cost: "medium",
    });
  });

  it("does not match Owner child routes", () => {
    expect(
      resolveWorkspaceModule("owner", "/owner/bookings", "")?.moduleId
    ).toBe("owner-bookings");
    expect(
      resolveWorkspaceModule("owner", "/owner/staff", "")
    ).toBeNull();
  });

  it("keeps Owner retention disabled under the CRM-only rollout", () => {
    expect(
      isRetainedWorkspaceEnabled("owner", {
        NEXT_PUBLIC_RETAINED_WORKSPACES: "crm",
      })
    ).toBe(false);
  });
});
