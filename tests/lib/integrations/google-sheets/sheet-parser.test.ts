import { describe, expect, it } from "vitest";
import {
  parseMoney,
  parseWeeklySheet,
  type SheetCell,
} from "@/lib/integrations/google-sheets/sheet-parser";

function makeRow(overrides: Partial<Record<number, SheetCell>>): SheetCell[] {
  const row: SheetCell[] = Array.from({ length: 13 }, () => "");

  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }

  return row;
}

describe("Google Sheets weekly parser", () => {
  it("parses formatted peso amounts without changing their value", () => {
    expect(parseMoney("₱1,000.00")).toBe(1000);
    expect(parseMoney("₱500.00")).toBe(500);
    expect(parseMoney("---")).toBeNull();
    expect(parseMoney("GCASH")).toBeNull();
  });

  it("uses daily block dates instead of stale summary text", () => {
    const values: SheetCell[][] = [
      makeRow({ 2: "MARCH 28-APR 3, 2026" }),

      makeRow({
        1: "TIME",
        2: "ATTENDANT",
        3: "CLIENT",
        4: "HRS.",
        5: "SERVICE",
        6: "PER SERVICE RATE",
        7: "FUEL",
        8: "CASH",
        9: "GCASH",
        10: "BANK TRANSFER/QR",
        11: "CARD/TERMINAL",
        12: "COMMISSION",
      }),

      makeRow({
        0: "FRIDAY",
        2: "NIKKI",
        5: "OPENING-CLOSING CSR",
      }),

      makeRow({
        0: "September 18, 2026",
        2: "MARY JOY",
        5: "MID SHIFT",
      }),

      makeRow({
        1: "10:00 AM",
        2: "ROSE",
        3: "TEST CLIENT",
        4: "1",
        5: "SWEDISH",
        6: "₱500.00",
        8: "₱300.00",
        9: "₱200.00",
      }),
    ];

    const parsed = parseWeeklySheet(values);

    expect(parsed.headerRows).toEqual([2]);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0]?.businessDate).toBe("2026-09-18");

    const service = parsed.rows.find((row) => row.rowType === "service_candidate");

    expect(service?.businessDate).toBe("2026-09-18");
    expect(service?.service).toBe("SWEDISH");
    expect(service?.rate).toBe(500);
  });

  it("classifies staff duty rows separately from services", () => {
    const values: SheetCell[][] = [
      makeRow({
        1: "TIME",
        2: "ATTENDANT",
        5: "SERVICE",
      }),

      makeRow({
        0: "September 18, 2026",
        2: "NIKKI",
        5: "OPENING CSR",
      }),

      makeRow({
        2: "DIANA",
        5: "MID SHIFT",
      }),

      makeRow({
        2: "JOYME",
        5: "BOOK-KEEPER",
      }),
    ];

    const parsed = parseWeeklySheet(values);

    expect(parsed.countsByType.staff_duty).toBe(3);
    expect(parsed.countsByType.service_candidate).toBe(0);
  });

  it("preserves split payment components instead of collapsing them", () => {
    const values: SheetCell[][] = [
      makeRow({
        1: "TIME",
        2: "ATTENDANT",
        3: "CLIENT",
        5: "SERVICE",
        8: "CASH",
        9: "GCASH",
        10: "BANK TRANSFER/QR",
        11: "CARD/TERMINAL",
      }),

      makeRow({
        0: "September 18, 2026",
      }),

      makeRow({
        1: "11:00 AM",
        2: "ROSE",
        3: "TEST CLIENT",
        5: "SWEDISH",
        6: "₱500.00",
        8: "₱300.00",
        9: "₱200.00",
      }),
    ];

    const parsed = parseWeeklySheet(values);
    const service = parsed.rows.find((row) => row.rowType === "service_candidate");

    expect(service?.hasSplitPayment).toBe(true);

    expect(service?.payments.find((payment) => payment.method === "cash")?.amount).toBe(300);

    expect(service?.payments.find((payment) => payment.method === "gcash")?.amount).toBe(200);
  });

  it("does not guess non-numeric payment markers", () => {
    const values: SheetCell[][] = [
      makeRow({
        1: "TIME",
        2: "ATTENDANT",
        3: "CLIENT",
        5: "SERVICE",
        9: "GCASH",
      }),

      makeRow({
        0: "September 18, 2026",
      }),

      makeRow({
        1: "1:00 PM",
        2: "ROSE",
        3: "TEST CLIENT",
        5: "SWEDISH",
        9: "GCASH",
      }),
    ];

    const parsed = parseWeeklySheet(values);
    const service = parsed.rows.find((row) => row.rowType === "service_candidate");

    expect(service?.payments.find((payment) => payment.method === "gcash")?.amount).toBeNull();

    expect(service?.payments.find((payment) => payment.method === "gcash")?.marker).toBe("GCASH");

    expect(service?.issues).toContain("PAYMENT_MARKER_REQUIRES_REVIEW");
  });

  it("flags service continuation rows instead of inventing missing identity", () => {
    const values: SheetCell[][] = [
      makeRow({
        1: "TIME",
        2: "ATTENDANT",
        3: "CLIENT",
        5: "SERVICE",
      }),

      makeRow({
        0: "September 18, 2026",
      }),

      makeRow({
        5: "MOXA VENTOSA",
        6: "₱700.00",
      }),
    ];

    const parsed = parseWeeklySheet(values);
    const continuation = parsed.rows.find((row) => row.service === "MOXA VENTOSA");

    expect(continuation?.rowType).toBe("service_candidate");

    expect(continuation?.issues).toContain("MISSING_OR_CONTINUATION_TIME");

    expect(continuation?.issues).toContain("MISSING_OR_CONTINUATION_ATTENDANT");

    expect(continuation?.issues).toContain("MISSING_OR_CONTINUATION_CLIENT");
  });
});
