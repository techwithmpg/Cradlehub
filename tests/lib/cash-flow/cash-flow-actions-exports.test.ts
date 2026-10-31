import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import * as cashFlowActions from "@/lib/cash-flow/cash-flow-actions";

describe("Cash Flow Actions 'use server' Export Boundary Contract", () => {
  it("only exports async functions from the 'use server' boundary", () => {
    const exportsList = Object.entries(cashFlowActions);
    expect(exportsList.length).toBeGreaterThan(0);

    for (const [key, value] of exportsList) {
      expect(
        typeof value,
        `Export '${key}' from 'use server' module cash-flow-actions must be a function, found ${typeof value}`
      ).toBe("function");
    }
  });

  it("does not export Zod schemas or non-function objects at runtime", () => {
    expect("VerifyPaymentTransactionInputSchema" in cashFlowActions).toBe(false);
  });

  it("exports verifyPaymentTransactionAction as an executable function", () => {
    expect(typeof cashFlowActions.verifyPaymentTransactionAction).toBe("function");
  });
});
