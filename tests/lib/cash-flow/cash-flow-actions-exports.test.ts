import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import * as cashFlowActions from "@/lib/cash-flow/cash-flow-actions";

describe("cash-flow-actions Next.js Server Components Export Boundary", () => {
  it("exports ONLY functions and zero runtime objects", () => {
    const exportsList = Object.entries(cashFlowActions);
    expect(exportsList.length).toBeGreaterThan(0);

    for (const [key, value] of exportsList) {
      expect(
        typeof value,
        `Expected export '${key}' in 'use server' module to be a function, but found '${typeof value}'`
      ).toBe("function");
    }
  });

  it("does not export VerifyPaymentTransactionInputSchema or GetPrintableReceiptInputSchema as a runtime object", () => {
    expect("VerifyPaymentTransactionInputSchema" in cashFlowActions).toBe(false);
    expect("GetPrintableReceiptInputSchema" in cashFlowActions).toBe(false);
  });

  it("exports verifyPaymentTransactionAction and getPrintableReceiptAction as functions", () => {
    expect(typeof cashFlowActions.verifyPaymentTransactionAction).toBe("function");
    expect(typeof cashFlowActions.getPrintableReceiptAction).toBe("function");
  });
});
