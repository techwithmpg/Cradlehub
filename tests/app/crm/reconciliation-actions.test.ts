import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getDailyPaymentSummary: vi.fn(),
  createNotification: vi.fn(),
  resolveNotificationsForEntity: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => false,
  getDevBypassLayoutStaff: vi.fn(),
}));
vi.mock("@/lib/queries/bookings", () => ({
  getDailyPaymentSummary: mocks.getDailyPaymentSummary,
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: mocks.createNotification,
  resolveNotificationsForEntity: mocks.resolveNotificationsForEntity,
}));
vi.mock("@/lib/notifications/notification-targets", () => ({
  getNotificationTargetPath: () => "/manager/reconciliation",
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { upsertReconciliationAction } from "@/app/(dashboard)/crm/reconciliation/actions";

const BRANCH_ID = "20a30d2a-2899-48c8-b643-c12ce26715f1";
const STAFF_ID = "3e7a6a0a-6cf1-4621-97ce-f7a63fde00f2";
const AUTH_USER_ID = "ac927cb1-8687-4da6-a4ac-9c3d58f42d80";

type QueryResult = { data: unknown; error: unknown };

function queryBuilder(options: { maybeSingle?: QueryResult; single?: QueryResult } = {}) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "neq", "not", "order", "limit", "select"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.upsert = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => options.maybeSingle ?? { data: null, error: null });
  builder.single = vi.fn(async () => options.single ?? { data: null, error: null });
  return builder;
}

describe("Fix A: Day Close / Reconciliation fail-closed validation", () => {
  let upsertMock: ReturnType<typeof vi.fn>;
  let reconTableMock: ReturnType<typeof queryBuilder>;

  beforeEach(() => {
    vi.clearAllMocks();

    const staffQuery = queryBuilder({
      maybeSingle: {
        data: { id: STAFF_ID, branch_id: BRANCH_ID, system_role: "crm" },
        error: null,
      },
    });

    reconTableMock = queryBuilder({
      single: { data: { id: "recon-123" }, error: null },
    });
    upsertMock = reconTableMock.upsert as ReturnType<typeof vi.fn>;

    const client = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: AUTH_USER_ID } } })) },
      from: vi.fn((table: string) => {
        if (table === "staff") return staffQuery;
        if (table === "daily_cash_reconciliations") return reconTableMock;
        return queryBuilder();
      }),
    };

    mocks.createClient.mockResolvedValue(client);
    mocks.createNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed when getDailyPaymentSummary throws an error and does not persist reconciliation", async () => {
    mocks.getDailyPaymentSummary.mockRejectedValue(new Error("Database connection lost"));

    const result = await upsertReconciliationAction({
      branchId: BRANCH_ID,
      date: "2026-09-26",
      actualCash: 500,
      actualGcash: 1000,
      actualMaya: 0,
      actualCard: 0,
      actualOther: 0,
      status: "draft",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain(
      "Failed to calculate expected payment summary: Database connection lost"
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("fails closed when getDailyPaymentSummary returns null and does not persist reconciliation", async () => {
    mocks.getDailyPaymentSummary.mockResolvedValue(null);

    const result = await upsertReconciliationAction({
      branchId: BRANCH_ID,
      date: "2026-09-26",
      actualCash: 500,
      actualGcash: 1000,
      actualMaya: 0,
      actualCard: 0,
      actualOther: 0,
      status: "draft",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Expected payment summary is unavailable. Day close aborted.");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("persists reconciliation and succeeds when getDailyPaymentSummary succeeds", async () => {
    mocks.getDailyPaymentSummary.mockResolvedValue({
      date: "2026-09-26",
      total_expected: 3000,
      total_collected: 3000,
      total_unpaid: 0,
      paid_count: 2,
      unpaid_count: 0,
      total_count: 2,
      by_method: {
        cash: 1000,
        gcash: 1500,
        maya: 500,
        card: 0,
        pay_on_site: 0,
        other: 0,
      },
    });

    const result = await upsertReconciliationAction({
      branchId: BRANCH_ID,
      date: "2026-09-26",
      actualCash: 1000,
      actualGcash: 1500,
      actualMaya: 500,
      actualCard: 0,
      actualOther: 0,
      status: "submitted",
    });

    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: BRANCH_ID,
        reconciliation_date: "2026-09-26",
        recorded_by: STAFF_ID,
        expected_cash: 1000,
        expected_gcash: 1500,
        expected_maya: 500,
        expected_card: 0,
        expected_other: 0,
        actual_cash: 1000,
        actual_gcash: 1500,
        actual_maya: 500,
        status: "submitted",
      }),
      { onConflict: "branch_id,reconciliation_date" }
    );
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/crm/reconciliation");
  });
});
