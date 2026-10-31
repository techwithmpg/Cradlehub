import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));

const mockAuthGetUser = vi.fn();
const mockStaffSelect = vi.fn();
const mockTxSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockAuthGetUser,
    },
    from: (table: string) => {
      if (table === "staff") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockStaffSelect,
            }),
          }),
        };
      }
      if (table === "financial_transactions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockTxSelect,
            }),
          }),
        };
      }
      return {
        select: vi.fn(),
      };
    },
  })),
}));

import { verifyPaymentTransactionAction } from "@/lib/cash-flow/cash-flow-actions";

describe("verifyPaymentTransactionAction - Transaction Identity Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default authorized staff session
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-crm-1" } },
      error: null,
    });

    mockStaffSelect.mockResolvedValue({
      data: {
        id: "staff-crm-1",
        branch_id: "branch-main-1",
        system_role: "crm",
        is_active: true,
      },
      error: null,
    });
  });

  it("returns AUTH_REQUIRED when caller has no authenticated session", async () => {
    mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_REQUIRED");
    }
  });

  it("returns PAYMENT_ROLE_UNAUTHORIZED when staff has no financial verification role", async () => {
    mockStaffSelect.mockResolvedValueOnce({
      data: {
        id: "staff-therapist-1",
        branch_id: "branch-main-1",
        system_role: "therapist",
        is_active: true,
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_ROLE_UNAUTHORIZED");
    }
  });

  it("returns BRANCH_UNAUTHORIZED when staff belongs to a different branch than requested", async () => {
    mockStaffSelect.mockResolvedValueOnce({
      data: {
        id: "staff-crm-1",
        branch_id: "branch-sm-branch",
        system_role: "crm",
        is_active: true,
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BRANCH_UNAUTHORIZED");
    }
  });

  it("returns status: not_found when idempotency key is not found in financial_transactions", async () => {
    mockTxSelect.mockResolvedValueOnce({ data: null, error: null });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-nonexistent",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("not_found");
    }
  });

  it("rejects when transaction belongs to a different branch (TRANSACTION_BRANCH_MISMATCH)", async () => {
    mockTxSelect.mockResolvedValueOnce({
      data: {
        id: "tx-diff-branch",
        branch_id: "branch-sm-branch",
        source_id: "order-123",
        source_type: "booking_order",
        transaction_type: "customer_payment",
        status: "posted",
        business_date: "2026-10-31",
        occurred_at: new Date().toISOString(),
        financial_account_movements: [{ id: "m1", financial_account_id: "acc1", amount: 1000, payment_method: "cash", external_reference: null }],
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TRANSACTION_BRANCH_MISMATCH");
    }
  });

  it("rejects when transaction belongs to a different order (TRANSACTION_SOURCE_MISMATCH)", async () => {
    mockTxSelect.mockResolvedValueOnce({
      data: {
        id: "tx-wrong-order",
        branch_id: "branch-main-1",
        source_id: "order-DIFFERENT-999",
        source_type: "booking_order",
        transaction_type: "customer_payment",
        status: "posted",
        business_date: "2026-10-31",
        occurred_at: new Date().toISOString(),
        financial_account_movements: [{ id: "m1", financial_account_id: "acc1", amount: 1000, payment_method: "cash", external_reference: null }],
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TRANSACTION_SOURCE_MISMATCH");
    }
  });

  it("rejects when transaction source type differs (TRANSACTION_SOURCE_TYPE_MISMATCH)", async () => {
    mockTxSelect.mockResolvedValueOnce({
      data: {
        id: "tx-wrong-type",
        branch_id: "branch-main-1",
        source_id: "order-123",
        source_type: "legacy_booking", // Mismatch: expected booking_order
        transaction_type: "customer_payment",
        status: "posted",
        business_date: "2026-10-31",
        occurred_at: new Date().toISOString(),
        financial_account_movements: [{ id: "m1", financial_account_id: "acc1", amount: 1000, payment_method: "cash", external_reference: null }],
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
      sourceType: "booking_order",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TRANSACTION_SOURCE_TYPE_MISMATCH");
    }
  });

  it("rejects when transaction is not a customer payment (INVALID_TRANSACTION_TYPE)", async () => {
    mockTxSelect.mockResolvedValueOnce({
      data: {
        id: "tx-internal-transfer",
        branch_id: "branch-main-1",
        source_id: "order-123",
        source_type: "booking_order",
        transaction_type: "internal_transfer", // Invalid
        status: "posted",
        business_date: "2026-10-31",
        occurred_at: new Date().toISOString(),
        financial_account_movements: [{ id: "m1", financial_account_id: "acc1", amount: 1000, payment_method: "cash", external_reference: null }],
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_TRANSACTION_TYPE");
    }
  });

  it("rejects when transaction status is not posted (TRANSACTION_NOT_POSTED)", async () => {
    mockTxSelect.mockResolvedValueOnce({
      data: {
        id: "tx-voided",
        branch_id: "branch-main-1",
        source_id: "order-123",
        source_type: "booking_order",
        transaction_type: "customer_payment",
        status: "voided", // Not posted
        business_date: "2026-10-31",
        occurred_at: new Date().toISOString(),
        financial_account_movements: [{ id: "m1", financial_account_id: "acc1", amount: 1000, payment_method: "cash", external_reference: null }],
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TRANSACTION_NOT_POSTED");
    }
  });

  it("rejects when transaction has no movements (NO_MOVEMENTS_FOUND)", async () => {
    mockTxSelect.mockResolvedValueOnce({
      data: {
        id: "tx-no-movements",
        branch_id: "branch-main-1",
        source_id: "order-123",
        source_type: "booking_order",
        transaction_type: "customer_payment",
        status: "posted",
        business_date: "2026-10-31",
        occurred_at: new Date().toISOString(),
        financial_account_movements: [], // Empty
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NO_MOVEMENTS_FOUND");
    }
  });

  it("confirms and returns committed transaction when identity and movements match", async () => {
    mockTxSelect.mockResolvedValueOnce({
      data: {
        id: "tx-valid-committed",
        branch_id: "branch-main-1",
        source_id: "order-123",
        source_type: "booking_order",
        transaction_type: "customer_payment",
        status: "posted",
        business_date: "2026-10-31",
        occurred_at: "2026-10-31T10:30:00.000Z",
        external_reference: "REF-100",
        notes: "Front desk payment",
        financial_account_movements: [
          {
            id: "m-1",
            financial_account_id: "acc-drawer-1",
            amount: 750,
            payment_method: "cash",
            external_reference: null,
          },
          {
            id: "m-2",
            financial_account_id: "acc-gcash-1",
            amount: 250,
            payment_method: "gcash",
            external_reference: "GCASH-9988",
          },
        ],
      },
      error: null,
    });

    const result = await verifyPaymentTransactionAction({
      idempotencyKey: "key-123",
      branchId: "branch-main-1",
      sourceId: "order-123",
      sourceType: "booking_order",
      expectedAmount: 1000,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.status === "committed") {
      expect(result.transaction.id).toBe("tx-valid-committed");
      expect(result.transaction.branchId).toBe("branch-main-1");
      expect(result.transaction.sourceId).toBe("order-123");
      expect(result.transaction.status).toBe("posted");
      expect(result.transaction.transactionType).toBe("customer_payment");
      expect(result.transaction.movements.length).toBe(2);
      expect(result.transaction.movements[0]?.amount).toBe(750);
      expect(result.transaction.movements[1]?.amount).toBe(250);
    }
  });
});

