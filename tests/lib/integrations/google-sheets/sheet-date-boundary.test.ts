import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseSheetRows } from "@/lib/integrations/google-sheets/sheet-parser";
import { summarizeSheetProjection } from "@/lib/integrations/google-sheets/sheet-diagnostics";

const HEADER = ["", "TIME", "ATTENDANT", "CLIENT", "HRS.", "SERVICE", "PER SERVICE RATE"];
const VISIT = ["", "10:00", "STAFF_REDACTED", "CUSTOMER_REDACTED", "1", "SERVICE_REDACTED", "500"];
const CONTINUATION = ["", "", "", "", "", "SECOND_SERVICE_REDACTED", "200"];
const DAY = (name: string) => [name, "", "STAFF_REDACTED", "", "", "OPENING CSR"];
const DATE = (value: string) => [value, "", "STAFF_REDACTED", "", "", "CLOSING CSR"];

function parse(rows: string[][], sheetName = "OCT.2-8, 2026") {
  return parseSheetRows({ spreadsheetId: "synthetic", sheetName, rows });
}

describe("real-workbook weekday and adjacent date structure", () => {
  it("dates heading duties, following visits, and a continuation from the adjacent date", () => {
    const result = parse([HEADER, DAY("FRIDAY"), DATE("October 2, 2026"), VISIT, CONTINUATION]);
    expect(result.duties.map((duty) => duty.businessDate)).toEqual(["2026-10-02", "2026-10-02"]);
    expect(result.visits).toHaveLength(1);
    expect(result.visits[0]).toMatchObject({
      businessDate: "2026-10-02",
      confidence: "recognized",
    });
    expect(result.visits[0]?.services).toHaveLength(2);
    expect([result.visits[0]?.source.startRow, result.visits[0]?.source.endRow]).toEqual([4, 5]);
  });

  it("resets context at the next day and never joins a continuation across it", () => {
    const result = parse([
      HEADER,
      DAY("FRIDAY"),
      DATE("October 2, 2026"),
      VISIT,
      DAY("SATURDAY"),
      DATE("October 3, 2026"),
      CONTINUATION,
      VISIT,
    ]);
    expect(result.visits.map((visit) => visit.businessDate)).toEqual(["2026-10-02", "2026-10-03"]);
    expect(result.visits[0]?.services).toHaveLength(1);
    expect(result.visits[1]?.source.startRow).toBe(8);
    expect(summarizeSheetProjection(result).reviewReasonCounts.ORPHAN_CONTINUATION).toBe(1);
  });

  it("accepts the yearless and irregularly spaced formatted dates observed in the prior tab", () => {
    const result = parse(
      [
        HEADER,
        DAY("FRIDAY"),
        DATE("September 25"),
        VISIT,
        HEADER,
        DAY("THURSDAY"),
        DATE("October 1 ,2026"),
        VISIT,
      ],
      "SEPT 25-OCT 1, 2026"
    );
    expect(result.visits.map((visit) => visit.businessDate)).toEqual(["2026-09-25", "2026-10-01"]);
  });

  it("rejects stale merged-summary dates and an out-of-week operational date", () => {
    const result = parse([
      ["August 28, 2026", "", "SUMMARY"],
      HEADER,
      DAY("THURSDAY"),
      ["September 3, 2026"],
      VISIT,
    ]);
    const summary = summarizeSheetProjection(result);
    expect(result.visits[0]?.businessDate).toBeNull();
    expect(summary.staleSummaryDateRejectedCount).toBe(2);
    expect(summary.outOfWeekDateCount).toBe(1);
    expect(summary.reviewReasonCounts.MISSING_BUSINESS_DATE).toBeGreaterThan(0);
  });

  it("leaves missing or malformed adjacent dates in Needs Review", () => {
    const missing = summarizeSheetProjection(parse([HEADER, DAY("SUNDAY"), [], VISIT]));
    const malformed = summarizeSheetProjection(
      parse([HEADER, DAY("FRIDAY"), ["October 99, 2026"], VISIT])
    );
    expect(missing.visitsMissingBusinessDate).toBe(1);
    expect(missing.dateBoundaryAmbiguousCount).toBeGreaterThan(0);
    expect(malformed.visitsMissingBusinessDate).toBe(1);
    expect(malformed.dateBoundaryAmbiguousCount).toBeGreaterThan(0);
  });

  it("rejects an in-week date when the weekday label disagrees", () => {
    const summary = summarizeSheetProjection(
      parse([HEADER, DAY("MONDAY"), DATE("October 6, 2026"), VISIT])
    );
    expect(summary.visitsMissingBusinessDate).toBe(1);
    expect(summary.dateBoundaryAmbiguousCount).toBeGreaterThan(0);
  });

  it("does not grant date authority to an unpaired in-week report label", () => {
    const summary = summarizeSheetProjection(parse([HEADER, ["October 2, 2026"], VISIT]));
    expect(summary.visitsMissingBusinessDate).toBe(1);
    expect(summary.dateBoundaryAmbiguousCount).toBe(1);
  });
});
