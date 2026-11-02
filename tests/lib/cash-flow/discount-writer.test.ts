import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { recordOrderPayment } from "@/lib/cash-flow/payment-writer";
import { PostOrderPaymentPayloadSchema } from "@/lib/cash-flow/financial-contract";
const payload = {
  orderId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "discount-adapter-test",
  payments: [
    {
      amount: 900,
      paymentMethod: "cash" as const,
      financialAccountId: "22222222-2222-4222-8222-222222222222",
    },
  ],
  discount: {
    quoteVersion: "server-version",
    selections: [
      {
        bookingId: "33333333-3333-4333-8333-333333333333",
        category: "vip" as const,
        attested: true as const,
      },
    ],
  },
};
afterEach(() => vi.unstubAllEnvs());
describe("discount writer boundary", () => {
  it("keeps production release gate off even with a forged client command", async () => {
    vi.stubEnv("CRADLEHUB_DISCOUNTS_ENABLED", "false");
    const rpc = vi.fn();
    expect(await recordOrderPayment({ rpc }, payload)).toMatchObject({
      ok: false,
      error: expect.stringContaining("DISCOUNT_RELEASE_PENDING"),
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends only selection and quote version to the atomic extension and returns committed receipt facts", async () => {
    vi.stubEnv("CRADLEHUB_DISCOUNTS_ENABLED", "true");
    const receipt = {
      items: [
        { description: "Service", amount: 1000 },
        { description: "VIP 10%", amount: -100 },
      ],
      subtotal: 1000,
      discountAmount: 100,
      alreadyPaid: 0,
    };
    const rpc = vi
      .fn()
      .mockResolvedValue({
        error: null,
        data: {
          success: true,
          transaction_id: "44444444-4444-4444-8444-444444444444",
          total_payable: 900,
          total_paid: 900,
          remaining_balance: 0,
          net_allocated: 900,
          movements: [],
          allocations: [],
          discount_receipt: receipt,
        },
      });
    const result = await recordOrderPayment({ rpc }, payload);
    expect(rpc).toHaveBeenCalledWith(
      "post_order_payment_with_discounts_atomic",
      expect.objectContaining({
        p_selections: payload.discount.selections,
        p_quote_version: "server-version",
        p_payments: [
          {
            amount: 900,
            payment_method: "cash",
            financial_account_id: payload.payments[0]!.financialAccountId,
            external_reference: null,
          },
        ],
      })
    );
    expect(result).toMatchObject({
      ok: true,
      data: { discountReceipt: receipt, totalPayable: 900 },
    });
  });
  it("rejects duplicate recipient categories and missing staff attestation", () => {
    expect(
      PostOrderPaymentPayloadSchema.safeParse({
        ...payload,
        discount: {
          ...payload.discount,
          selections: [...payload.discount.selections, ...payload.discount.selections],
        },
      }).success
    ).toBe(false);
    expect(
      PostOrderPaymentPayloadSchema.safeParse({
        ...payload,
        discount: {
          ...payload.discount,
          selections: [{ ...payload.discount.selections[0], attested: false }],
        },
      }).success
    ).toBe(false);
  });
});
