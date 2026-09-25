import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildSheetProjectionSnapshot } from "@/lib/integrations/google-sheets/sheet-projection";

describe("Google Sheet CRM projection", () => {
  it("preserves raw evidence while projecting merge-normalized values", () => {
    const rawValues = [
      [
        "",
        "TIME",
        "ATTENDANT",
        "CLIENT",
        "HRS.",
        "SERVICE",
        "PER SERVICE RATE",
        "FUEL",
        "CASH",
        "GCASH",
        "BANK TRANSFER/QR",
        "CARD/TERMINAL",
        "COMMISSION",
      ],
      [
        "September 24, 2026",
        "9:00 AM",
        "ROSE",
        "CLIENT A",
        "1",
        "SWEDISH",
        1000,
        "",
        1000,
        "",
        "",
        "",
        100,
      ],
      ["", "", "", "", "1", "AROMATHERAPY", 500, "", 500, "", "", "", 50],
    ];

    const original = structuredClone(rawValues);

    const snapshot = buildSheetProjectionSnapshot({
      sheetName: "SEP 18-24,2026",

      rawValues,

      merges: [
        {
          startRow: 2,
          endRow: 3,
          startColumn: 2,
          endColumn: 2,
        },
        {
          startRow: 2,
          endRow: 3,
          startColumn: 3,
          endColumn: 3,
        },
        {
          startRow: 2,
          endRow: 3,
          startColumn: 4,
          endColumn: 4,
        },
      ],
    });

    expect(rawValues).toEqual(original);

    expect(snapshot.rawMeaningfulRowCount).toBe(snapshot.normalizedMeaningfulRowCount);

    expect(snapshot.rows).toHaveLength(snapshot.normalizedMeaningfulRowCount);

    const continuation = snapshot.rows.find((row) => row.sourceRow === 3);

    expect(continuation?.time).toBe("9:00 AM");

    expect(continuation?.attendant).toBe("ROSE");

    expect(continuation?.client).toBe("CLIENT A");

    expect(continuation?.rawValues[1]).toBe("");

    expect(continuation?.rawValues[2]).toBe("");

    expect(continuation?.rawValues[3]).toBe("");

    expect(continuation?.restoredColumns).toEqual([2, 3, 4]);

    expect(continuation?.disposition).toBe("match_candidate");

    expect(snapshot.businessDates).toContain("2026-09-24");
  });
});
