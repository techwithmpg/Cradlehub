import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/queries/owner-overview-workspace", () => ({
  loadOwnerOverviewWorkspaceData: mocks.loadWorkspace,
}));

import OwnerOverviewPage from "@/app/(dashboard)/owner/page";
import { OwnerDashboardAccessError } from "@/lib/queries/owner-dashboard";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PERF-9A Owner Overview page", () => {
  it("passes the authoritative server payload into the retained Owner Overview wrapper", async () => {
    const payload = {
      data: { ownerName: "Owner", today: "2026-10-18" },
      attendanceScanFeed: { selectedDate: "2026-10-18" },
    };
    mocks.loadWorkspace.mockResolvedValue(payload);

    const page = await OwnerOverviewPage();
    const workspace = page.props.children;

    expect(mocks.loadWorkspace).toHaveBeenCalledTimes(1);
    expect(workspace.props.initialPayload).toBe(payload);
  });

  it("preserves the existing Owner access redirect contract", async () => {
    mocks.loadWorkspace.mockRejectedValue(
      new OwnerDashboardAccessError(
        "/select-workspace",
        "Owner workspace access is required."
      )
    );

    await expect(OwnerOverviewPage()).rejects.toThrow(
      "REDIRECT:/select-workspace"
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/select-workspace");
  });

  it("lets unexpected loader errors reach the route error boundary", async () => {
    mocks.loadWorkspace.mockRejectedValue(
      new Error("Unexpected dashboard failure")
    );

    await expect(OwnerOverviewPage()).rejects.toThrow(
      "Unexpected dashboard failure"
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
