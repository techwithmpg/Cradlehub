import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actionsPath = resolve(
  process.cwd(),
  "src/lib/cash-flow/cash-flow-actions.ts"
);

describe("PERF-8 retained CRM Cash Flow mutation contract", () => {
  it("does not directly revalidate /crm/cash-flow after retained reconciliation owns the self refresh", () => {
    const source = readFileSync(actionsPath, "utf8");
    expect(source).not.toContain(
      "revalidatePath('/crm/cash-flow')"
    );
    expect(source).not.toContain(
      'revalidatePath("/crm/cash-flow")'
    );
  });

  it("preserves downstream financial and booking revalidation paths", () => {
    const source = readFileSync(actionsPath, "utf8");

    expect(source).toContain(
      "revalidateOperationalBookingSurfaces(result.data.branchId)"
    );
    expect(source).toContain(
      "revalidateOperationalBookingSurfaces(result.booking.branch_id)"
    );
    expect(source).toContain(
      "revalidatePath('/crm/reconciliation')"
    );
    expect(source).toContain(
      "revalidatePath('/owner/cash-flow')"
    );
  });

  it("preserves atomic financial RPC ownership", () => {
    const source = readFileSync(actionsPath, "utf8");

    for (const rpc of [
      "post_expense_atomic",
      "post_tip_atomic",
      "post_misc_income_atomic",
      "post_cash_adjustment_atomic",
      "post_transfer_atomic",
      "open_cash_session_atomic",
      "close_cash_session_atomic",
      "handover_cash_session_atomic",
    ]) {
      expect(source).toContain(rpc);
    }
  });
});
