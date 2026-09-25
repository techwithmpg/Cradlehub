import { describe, expect, it } from "vitest";
import {
  parseWeeklySheet,
  type ParsedPaymentComponent,
  type PaymentMethod,
  type SheetCell,
} from "@/lib/integrations/google-sheets/sheet-parser";

function makeRow(values: Partial<Record<number, SheetCell>>): SheetCell[] {
  const row: SheetCell[] = Array.from({ length: 13 }, () => "");

  for (const [column, value] of Object.entries(values)) {
    row[Number(column)] = value;
  }

  return row;
}

function paymentByMethod(
  payments: ParsedPaymentComponent[],
  method: PaymentMethod
): ParsedPaymentComponent {
  const payment = payments.find((component) => component.method === method);

  if (!payment) {
    throw new Error(`Missing payment component for method: ${method}`);
  }

  return payment;
}

describe("Google Sheets aggregate summary rows", () => {
  it("preserves tender evidence without classifying totals as transactions", () => {
    const parsed = parseWeeklySheet([
      makeRow({
        0: "TOTAL NO.OF HOURS",
        4: "60",
        8: "₱27,210.00",
        9: "₱5,540.00",
        10: "₱2,100.00",
        11: "₱0.00",
      }),

      makeRow({
        0: "NET PROFIT:",
        8: "₱22,900.00",
        9: "₱5,540.00",
        10: "₱2,100.00",
        11: "₱0.00",
      }),
    ]);

    const summaries = parsed.rows.filter((row) => row.rowType === "aggregate_summary");

    expect(summaries).toHaveLength(2);
    expect(parsed.countsByType.aggregate_summary).toBe(2);

    const totalRow = summaries[0];

    if (!totalRow) {
      throw new Error("Expected TOTAL NO.OF HOURS summary row");
    }

    expect(totalRow.hasSplitPayment).toBe(true);
    expect(summaries[1]?.hasSplitPayment).toBe(true);

    expect(paymentByMethod(totalRow.payments, "cash").amount).toBe(27210);

    expect(paymentByMethod(totalRow.payments, "gcash").amount).toBe(5540);

    expect(paymentByMethod(totalRow.payments, "bank_qr").amount).toBe(2100);

    expect(paymentByMethod(totalRow.payments, "card_terminal").amount).toBe(0);

    // Classification, not loss of raw payment evidence,
    // prevents aggregate totals becoming transactions.
    expect(summaries.every((row) => row.rowType === "aggregate_summary")).toBe(true);
  });
});
