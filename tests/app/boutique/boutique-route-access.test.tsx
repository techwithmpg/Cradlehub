import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ownerAccess: vi.fn(),
  frontDesk: vi.fn(),
  notFound: vi.fn(() => { throw new Error("B1_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/auth/get-user-workspace-access", () => ({
  getCurrentUserWorkspaceAccess: mocks.ownerAccess,
}));
vi.mock("@/lib/queries/crm-context", () => ({
  getFrontDeskContext: mocks.frontDesk,
}));
vi.mock("@/components/features/boutique/boutique-admin-preview", () => ({
  BoutiqueAdminPreview: () => <div>Preview UI</div>,
}));

import OwnerPage from "@/app/(dashboard)/owner/boutique/page";
import CrmPage from "@/app/(dashboard)/crm/boutique/page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CRADLEHUB_BOUTIQUE_B1_PREVIEW", "true");
});

describe("Boutique B1 server entrypoint denials", () => {
  it("rejects owner route unless authoritative workspace includes owner", async () => {
    mocks.ownerAccess.mockResolvedValue({ user: { id: "user" }, workspaces: [{ key: "crm" }] });
    await expect(OwnerPage()).rejects.toThrow("B1_NOT_FOUND");
    mocks.ownerAccess.mockResolvedValue({ user: { id: "user" }, workspaces: [{ key: "owner" }] });
    expect(await OwnerPage()).toBeTruthy();
  });

  it("rejects manager access despite generic CRM workspace membership", async () => {
    mocks.frontDesk.mockResolvedValue({ role: "manager", branchId: "branch-main", branchName: "Main Spa" });
    await expect(CrmPage()).rejects.toThrow("B1_NOT_FOUND");
  });

  it("rejects CRM without assigned branch, accepts branch-resolved CRM", async () => {
    mocks.frontDesk.mockResolvedValue({ role: "crm", branchId: "", branchName: "None" });
    await expect(CrmPage()).rejects.toThrow("B1_NOT_FOUND");
    mocks.frontDesk.mockResolvedValue({ role: "csr_staff", branchId: "branch-sm", branchName: "SM Branch" });
    const view = await CrmPage();
    expect(view.props.branchLabel).toBe("SM Branch");
    expect(view.props.workspace).toBe("crm");
  });

  it("keeps both routes gated off unless preview is explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_CRADLEHUB_BOUTIQUE_B1_PREVIEW", "false");
    await expect(OwnerPage()).rejects.toThrow("B1_NOT_FOUND");
    await expect(CrmPage()).rejects.toThrow("B1_NOT_FOUND");
    expect(mocks.frontDesk).not.toHaveBeenCalled();
    expect(mocks.ownerAccess).not.toHaveBeenCalled();
  });
});
