import { beforeEach, describe, expect, it, vi } from "vitest";

const { access, allowed, branches, cashFlowData, businessDate, redirect } = vi.hoisted(() => ({
  access: vi.fn(),
  allowed: vi.fn(),
  branches: vi.fn(),
  cashFlowData: vi.fn(),
  businessDate: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/get-user-workspace-access", () => ({ getCurrentUserWorkspaceAccess: access }));
vi.mock("@/lib/auth/workspace-access", () => ({
  hasWorkspaceAccess: allowed,
  getWorkspaceSwitchDestination: () => "/select-workspace",
}));
vi.mock("@/lib/queries/branches", () => ({ getAllBranches: branches }));
vi.mock("@/lib/cash-flow/cash-flow-queries", () => ({ getCashFlowData: cashFlowData }));
vi.mock("@/lib/engine/slot-time", () => ({ getBranchBusinessDate: businessDate }));

import OwnerCashFlowPage from "@/app/(dashboard)/owner/cash-flow/page";
import { CashFlowRequiredDataError } from "@/lib/cash-flow/cash-flow-errors";

describe("Owner Cash Flow route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.mockResolvedValue({ workspaces: [{ key: "owner" }] });
    allowed.mockReturnValue(true);
    branches.mockResolvedValue([
      { id: "branch-1", name: "Main Spa" },
      { id: "branch-2", name: "Second Spa" },
    ]);
    cashFlowData.mockResolvedValue({ branchId: "branch-2" });
    businessDate.mockReturnValue("2026-10-01");
  });

  it("loads the selected owner branch and reuses the Cash Flow workspace", async () => {
    const page = await OwnerCashFlowPage({ searchParams: Promise.resolve({
      branchId: "branch-2", date: "2026-09-30", tab: "ledger", entry: "expense",
    }) });
    const workspace = page.props.children[1];

    expect(cashFlowData).toHaveBeenCalledWith(
      "branch-2", "Second Spa", "2026-09-30", expect.objectContaining({ tab: "ledger" })
    );
    expect(workspace.props.initialTab).toBe("ledger");
    expect(workspace.props.initialEntryMode).toBe("expense");
    expect(workspace.props.reconciliationHref).toBeNull();
  });

  it("rejects an unlisted branch selection and uses an active branch", async () => {
    await OwnerCashFlowPage({ searchParams: Promise.resolve({ branchId: "other-branch" }) });
    expect(cashFlowData).toHaveBeenCalledWith(
      "branch-1", "Main Spa", "2026-10-01", expect.any(Object)
    );
  });

  it("does not query financial data without owner access", async () => {
    allowed.mockReturnValue(false);
    await expect(OwnerCashFlowPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow("redirect:/select-workspace");
    expect(cashFlowData).not.toHaveBeenCalled();
  });

  it("does not query financial data when no branch exists", async () => {
    branches.mockResolvedValue([]);
    const page = await OwnerCashFlowPage({ searchParams: Promise.resolve({}) });
    expect(page.type).toBe("section");
    expect(cashFlowData).not.toHaveBeenCalled();
  });

  it("keeps branch selection available when required financial data cannot load", async () => {
    cashFlowData.mockRejectedValue(new CashFlowRequiredDataError("financial_accounts"));
    const page = await OwnerCashFlowPage({ searchParams: Promise.resolve({}) });
    expect(page.props.children[0].type).toBe("form");
    expect(page.props.children[1].props.role).toBe("alert");
  });
});
