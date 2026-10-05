import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseSheetRows } from "@/lib/integrations/google-sheets/sheet-parser";
import {
  readCradleMasterSheetDiagnostics,
  readSheetDiagnostics,
  summarizeSheetProjection,
} from "@/lib/integrations/google-sheets/sheet-diagnostics";
import type { SheetReader } from "@/lib/integrations/google-sheets/sheet-reader";

const HEADER = [
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
  "LOCATION",
];

// Synthetic names and numbers preserve the supplied workbook's heterogeneous row structure.
const current = parseSheetRows({
  spreadsheetId: "fixture-sheet",
  sheetName: "OCT.2-8, 2026",
  rows: [
    ["MARCH 28-APR 3, 2026"],
    HEADER,
    ["AUGUST 31, 2026"],
    ["FRIDAY"],
    ["OCT 2, 2026"],
    [
      "10:00",
      "SYNTHETIC STAFF A",
      "SYNTHETIC CLIENT A",
      "1",
      "SWEDISH",
      "500",
      "",
      "GV",
      "",
      "",
      "",
      "",
      "AYALA NP",
    ],
    ["", "", "", "", "VENTOSA", "200"],
    ["", "SYNTHETIC STAFF B", "", "", "OPENING-CLOSING CSR"],
    ["", "", "", "", "FOOT", "300"],
    ["", "", "", "", "", "", "", "", "GCASH"],
    ["11:00", "", "SYNTHETIC CLIENT B", "1", "FOOT", "300", "", "", "", "", "", "", "LA COSTA"],
    ["UNREADABLE NOTE"],
    [],
  ],
});

const previous = parseSheetRows({
  spreadsheetId: "fixture-sheet",
  sheetName: "SEPT 25-OCT 1, 2026",
  rows: [
    HEADER,
    ["FRIDAY"],
    ["SEPT 25, 2026"],
    ["", "SYNTHETIC STAFF C", "", "", "BOOK-KEEPER"],
    ["", "", "", "", "CLOSING CSR"],
  ],
});

describe("Master Sheet Stage 1B diagnostic projection", () => {
  it("counts row classes and visit/duty/review outcomes without including blank rows as classes", () => {
    const summary = summarizeSheetProjection(current);
    expect(summary.sourceRowCount).toBe(13);
    expect(summary.classificationCounts).toEqual({
      HEADER: 1,
      SUMMARY: 2,
      STAFF_DUTY: 1,
      SERVICE: 3,
      FINANCIAL_NOTE: 1,
      INFORMATIONAL: 2,
      UNKNOWN_NEEDS_REVIEW: 2,
    });
    expect(summary).toMatchObject({
      visitCount: 2,
      recognizedVisits: 0,
      dutyCount: 1,
      recognizedDuties: 1,
      needsReviewCount: 6,
      multiServiceVisits: 1,
      serviceLineCount: 3,
      visitsMissingBusinessDate: 0,
      visitsMissingCustomer: 0,
      visitsMissingAttendant: 1,
      visitsWithAmbiguousPaymentMarkers: 1,
      orphanContinuations: 1,
      unassignedFinancialNotes: 1,
    });
  });

  it("keeps review records useful by row reference without copying customer or marker text", () => {
    const entries = summarizeSheetProjection(current).reviewEntries;
    expect(entries.map((entry) => entry.classification)).toEqual([
      "UNKNOWN_NEEDS_REVIEW",
      "SERVICE",
      "UNKNOWN_NEEDS_REVIEW",
      "FINANCIAL_NOTE",
      "SERVICE",
      "UNKNOWN_NEEDS_REVIEW",
    ]);
    expect(entries[0]?.reasons).toContain("OUT_OF_WEEK_DATE");
    expect(entries[1]).toMatchObject({
      source: { sheetName: "OCT.2-8, 2026", startRow: 6, endRow: 7 },
      serviceLineCount: 2,
      ambiguousPaymentColumns: ["cash"],
      reasons: ["AMBIGUOUS_PAYMENT_MARKER"],
    });
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain("SYNTHETIC CLIENT");
    expect(serialized).not.toContain("SYNTHETIC STAFF");
    expect(serialized).not.toContain("GV");
    expect(serialized).not.toContain("UNREADABLE NOTE");
  });

  it("retains Needs Review duties separately from service lines", () => {
    const summary = summarizeSheetProjection(previous);
    expect(summary.visitCount).toBe(0);
    expect(summary.dutyCount).toBe(2);
    expect(summary.recognizedDuties).toBe(1);
    expect(summary.reviewEntries[0]).toMatchObject({
      classification: "STAFF_DUTY",
      reasons: ["MISSING_STAFF"],
    });
  });

  it("runs as an in-process read-only harness and returns aggregates only", async () => {
    const reader: SheetReader = {
      readCurrentAndPrevious: vi.fn(async () => ({
        status: "available" as const,
        current,
        previous,
      })),
    };
    const result = await readSheetDiagnostics(reader, "2026-10-03");
    expect(reader.readCurrentAndPrevious).toHaveBeenCalledWith("2026-10-03");
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.current.sheetName).toBe("OCT.2-8, 2026");
      expect(result.previous.sheetName).toBe("SEPT 25-OCT 1, 2026");
      expect(JSON.stringify(result)).not.toContain("SYNTHETIC CLIENT");
    }
  });

  it("propagates controlled reader unavailability without a fake projection", async () => {
    const reader: SheetReader = {
      readCurrentAndPrevious: async () => ({
        status: "unavailable",
        reason: "AUTH_NOT_CONFIGURED",
      }),
    };
    await expect(readSheetDiagnostics(reader)).resolves.toEqual({
      status: "unavailable",
      reason: "AUTH_NOT_CONFIGURED",
    });
  });

  it("requires an approved token provider for the live-read entry point", async () => {
    await expect(readCradleMasterSheetDiagnostics()).resolves.toEqual({
      status: "unavailable",
      reason: "AUTH_NOT_CONFIGURED",
    });
  });

  it("disables the diagnostic harness in production before calling the reader", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const reader: SheetReader = { readCurrentAndPrevious: vi.fn() };
      await expect(readSheetDiagnostics(reader)).resolves.toEqual({
        status: "unavailable",
        reason: "DIAGNOSTICS_DISABLED",
      });
      expect(reader.readCurrentAndPrevious).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
