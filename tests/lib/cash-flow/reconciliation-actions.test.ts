import { describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockExpected, mockFrontDeskContext } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockExpected: vi.fn(),
  mockFrontDeskContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/dev-bypass", () => ({ isDevAuthBypassEnabled: () => false }));
vi.mock("@/lib/cash-flow/reconciliation-expected", () => ({ getPostedReconciliationExpected: mockExpected }));
vi.mock("@/lib/queries/crm-context", () => ({ getFrontDeskContext: mockFrontDeskContext }));
vi.mock("@/lib/notifications/create", () => ({ createNotification: vi.fn(), resolveNotificationsForEntity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { approveReconciliationAction, getReconciliationsAction, upsertReconciliationAction } from "@/app/(dashboard)/crm/reconciliation/actions";

const branchId = "11111111-1111-4111-8111-111111111111";

function mockClient(role: string, status: string, staffBranchId: string | null = branchId) {
  const update = vi.fn();
  mockFrontDeskContext.mockResolvedValue({ userId: "user", role, branchId });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        update: (value: unknown) => { update(value); return query; },
        maybeSingle: async () => ({
          data: table === "staff"
            ? { id: "staff", branch_id: staffBranchId, system_role: role }
            : { id: "reconciliation", status },
          error: null,
        }),
      };
      return query;
    },
  };
  mockCreateClient.mockResolvedValue(client);
  mockExpected.mockResolvedValue({ cash: 100, gcash: 0, maya: 0, card: 0, other: 0 });
  return { update };
}

describe("reconciliation finalization boundary", () => {
  it("uses the selected Owner branch when the Owner staff row has no branch", async () => {
    const { update } = mockClient("owner", "draft", null);
    const result = await upsertReconciliationAction({
      branchId, date: "2026-10-01", actualCash: 100, status: "draft",
    });
    expect(result).toMatchObject({ ok: true });
    expect(update).toHaveBeenCalledOnce();
  });

  it("rejects a save request for a branch other than the server selected branch", async () => {
    const { update } = mockClient("owner", "draft", null);
    const result = await upsertReconciliationAction({
      branchId: "22222222-2222-4222-8222-222222222222",
      date: "2026-10-01", actualCash: 100, status: "draft",
    });
    expect(result).toMatchObject({ ok: false, error: "Selected branch changed. Refresh before saving reconciliation." });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a history request for a branch other than the server selected branch", async () => {
    mockClient("owner", "draft", null);
    const result = await getReconciliationsAction("22222222-2222-4222-8222-222222222222");
    expect(result).toMatchObject({ ok: false, data: [] });
  });

  it("does not let a direct save request reopen an approved reconciliation", async () => {
    const { update } = mockClient("crm", "approved");
    const result = await upsertReconciliationAction({
      branchId, date: "2026-10-01", actualCash: 100, status: "draft",
    });
    expect(result).toMatchObject({ ok: false, error: "Approved reconciliations cannot be edited." });
    expect(update).not.toHaveBeenCalled();
  });

  it("does not let CRM directly approve a reconciliation", async () => {
    const { update } = mockClient("crm", "submitted");
    const result = await approveReconciliationAction("reconciliation");
    expect(result).toMatchObject({ ok: false, error: "Only an owner or manager can approve reconciliation." });
    expect(update).not.toHaveBeenCalled();
  });
});
