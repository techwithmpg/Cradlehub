import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  projectSheetRead,
  projectSheetTab,
} from "@/lib/integrations/google-sheets/sheet-review-projection";
import { filterSheetReviewRecords } from "@/lib/integrations/google-sheets/sheet-review-filter";
import type { SheetProjection, SheetSource } from "@/lib/integrations/google-sheets/sheet-types";

const source = (row: number): SheetSource => ({
  spreadsheetId: "fixture",
  sheetName: "CURRENT",
  startRow: row,
  endRow: row,
  sourceKey: `fixture:CURRENT:${row}`,
  contentFingerprint: `fingerprint-${row}`,
});
const blankAmount = { raw: "", amount: null, marker: null };
const projection: SheetProjection = {
  spreadsheetId: "fixture",
  sheetName: "CURRENT",
  businessTimezone: "Asia/Manila",
  sourceRowCount: 3,
  classifiedRows: [{ sourceRow: 3, classification: "FINANCIAL_NOTE", rawCells: ["secret note"] }],
  visits: [
    {
      sourceType: "MASTER_SHEET",
      readOnly: true,
      source: source(1),
      businessDate: "2026-10-02",
      timeRaw: "10:00",
      customerRawName: "Sample Customer",
      locationRawValue: "Sample location",
      attendantRawNames: "Sample Staff",
      services: [
        {
          sourceRow: 1,
          rawName: "Massage",
          hours: { raw: "1", amount: 1, marker: null },
          quotedRate: blankAmount,
        },
      ],
      paymentEvidence: [
        {
          cash: { raw: "500", amount: 500, marker: null },
          gcash: { raw: "GV", amount: null, marker: "GV" },
          bankQr: blankAmount,
          cardTerminal: blankAmount,
        },
      ],
      fuel: [],
      commission: [],
      confidence: "needs_review",
      ambiguities: [],
    },
  ],
  duties: [
    {
      sourceType: "MASTER_SHEET",
      readOnly: true,
      source: source(2),
      businessDate: "2026-10-02",
      staffRawName: "Sample Staff",
      dutyRawValue: "Opening",
      confidence: "recognized",
      ambiguities: [],
    },
  ],
  needsReview: [
    {
      source: source(3),
      businessDate: "2026-10-02",
      rawCells: ["secret note"],
      reason: "Unassigned financial note",
    },
  ],
};

describe("owner Master Sheet review projection", () => {
  it("keeps references external, unlinked, read only, and branch unknown", () => {
    const tab = projectSheetTab(projection);
    expect([tab.visits.length, tab.duties.length, tab.review.length]).toEqual([1, 1, 2]);
    for (const record of [...tab.visits, ...tab.duties, ...tab.review]) {
      expect(record).toMatchObject({
        sourceType: "MASTER_SHEET",
        readOnly: true,
        branchState: "BRANCH_UNKNOWN",
        canonicalLink: "UNLINKED",
      });
      expect(record.source).toMatchObject({
        sheetName: "CURRENT",
        contentFingerprint: expect.any(String),
        sourceKey: expect.any(String),
      });
      expect(record).not.toHaveProperty("customerId");
      expect(record).not.toHaveProperty("paymentId");
      expect(record).not.toHaveProperty("branchId");
      expect(record).not.toHaveProperty("actions");
      expect(record).not.toHaveProperty("ledgerEntry");
      expect(record).not.toHaveProperty("canonicalPayment");
    }
    expect(tab.visits[0]?.financialEvidence).toEqual([
      { channel: "Cash", amount: 500, ambiguous: false },
      { channel: "GCash", amount: null, ambiguous: true },
    ]);
    expect(tab.visits[0]?.reviewReasons).toContain("AMBIGUOUS_PAYMENT_MARKER");
    expect(
      tab.review.find((record) => record.classification === "FINANCIAL_NOTE")?.reviewReasons
    ).toEqual(["UNASSIGNED_FINANCIAL_NOTE"]);
    expect(JSON.stringify(tab)).not.toContain("secret note");
    expect(JSON.stringify(tab)).not.toContain('"GV"');
  });

  it("distinguishes an unavailable read from an available empty week", () => {
    expect(
      projectSheetRead(
        { status: "unavailable", reason: "SHEETS_UNAVAILABLE" },
        "2026-10-04T00:00:00.000Z"
      )
    ).toEqual({ status: "unavailable", observedAt: "2026-10-04T00:00:00.000Z" });
    const empty = { ...projection, visits: [], duties: [], needsReview: [], classifiedRows: [] };
    expect(
      projectSheetRead(
        { status: "available", current: empty, previous: empty },
        "2026-10-04T00:00:00.000Z"
      )
    ).toMatchObject({ status: "available", current: { visits: [], duties: [], review: [] } });
  });

  it("filters only display references by type, date, reason, and text", () => {
    const tab = projectSheetTab(projection);
    const records = [...tab.visits, ...tab.duties, ...tab.review];
    const base = { type: "all" as const, date: "", reason: "all" as const, query: "" };
    expect(filterSheetReviewRecords(records, { ...base, type: "visit", query: "massage" })).toEqual(
      [tab.visits[0]]
    );
    expect(filterSheetReviewRecords(records, { ...base, date: "2026-10-03" })).toEqual([]);
    expect(
      filterSheetReviewRecords(records, { ...base, reason: "UNASSIGNED_FINANCIAL_NOTE" })
    ).toEqual([tab.review[1]]);
    expect(filterSheetReviewRecords(records, { ...base, reason: "BRANCH_UNKNOWN" })).toHaveLength(
      4
    );
    expect(filterSheetReviewRecords(records, { ...base, query: "secret note" })).toEqual([]);
  });
});
