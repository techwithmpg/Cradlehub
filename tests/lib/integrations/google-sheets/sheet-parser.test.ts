import { describe, expect, it } from "vitest";
import { parseSheetAmount, parseSheetRows } from "@/lib/integrations/google-sheets/sheet-parser";
import { makeSheetSource } from "@/lib/integrations/google-sheets/sheet-source-identity";
import {
  businessDateInManila,
  parseWeeklyTab,
  selectCurrentAndPreviousTabs,
} from "@/lib/integrations/google-sheets/sheet-week";

const HEADER = [
  "TIME", "ATTENDANT", "CLIENT", "HRS.", "SERVICE", "PER SERVICE RATE",
  "FUEL", "CASH", "GCASH", "BANK TRANSFER/QR", "CARD/TERMINAL",
  "COMMISSION", "LOCATION",
];
const VISIT = ["10:00", "ROSE", "CLIENT A", "1", "SWEDISH", "500", "", "500", "", "", "", "", "AYALA NP"];
const CONTINUATION = ["", "", "", "", "VENTOSA", "200"];
const INPUT = { spreadsheetId: "sheet-1", sheetName: "OCT.2-8, 2026" };

function parse(...operationalRows: string[][]) {
  return parseSheetRows({
    ...INPUT,
    rows: [["MARCH 28-APR 3, 2026"], HEADER, ["OCT 2, 2026"], ...operationalRows],
  });
}

describe("Master Sheet Stage 1A parser", () => {
  it("recognizes the operational header", () => {
    expect(parse(VISIT).classifiedRows[1]?.classification).toBe("HEADER");
  });

  it("ignores stale summary dates as visit authority", () => {
    const result = parse(VISIT);
    expect(result.classifiedRows[0]?.classification).toBe("SUMMARY");
    expect(result.visits[0]?.businessDate).toBe("2026-10-02");
  });

  it("ignores stale daily-summary dates outside the selected weekly tab", () => {
    const result = parseSheetRows({
      ...INPUT,
      rows: [HEADER, ["AUGUST 30, 2026"], ["OCT 2, 2026"], VISIT,
        ["SEPTEMBER 1, 2026"], ["11:00", "ROSE", "CLIENT B", "1", "FOOT", "300"]],
    });
    expect(result.classifiedRows[1]?.classification).toBe("SUMMARY");
    expect(result.classifiedRows[4]?.classification).toBe("SUMMARY");
    expect(result.visits.map((visit) => visit.businessDate)).toEqual(["2026-10-02", null]);
    expect(result.visits[1]?.confidence).toBe("needs_review");
  });

  it("uses an explicit operational business date in Asia/Manila", () => {
    const result = parse(VISIT);
    expect(result.businessTimezone).toBe("Asia/Manila");
    expect(result.classifiedRows[2]?.classification).toBe("INFORMATIONAL");
    expect(businessDateInManila(new Date("2026-10-02T17:00:00Z"))).toBe("2026-10-03");
  });

  it("separates staff duties from customer visits", () => {
    const result = parse(["", "ROSE", "", "", "OPENING CSR"], VISIT);
    expect(result.duties).toHaveLength(1);
    expect(result.duties[0]).toMatchObject({ staffRawName: "ROSE", dutyRawValue: "OPENING CSR" });
    expect(result.visits).toHaveLength(1);
    expect(result.classifiedRows[3]?.classification).toBe("STAFF_DUTY");
  });

  it("normalizes one service visit without creating a canonical booking", () => {
    const result = parse(VISIT);
    expect(result.visits).toHaveLength(1);
    expect(result.visits[0]).toMatchObject({ sourceType: "MASTER_SHEET", readOnly: true, confidence: "recognized" });
    expect(result.visits[0]?.services).toHaveLength(1);
  });

  it("groups multi-service continuation rows into one visit", () => {
    const result = parse(VISIT, CONTINUATION, ["", "", "", "", "FOOT", "300"]);
    expect(result.visits).toHaveLength(1);
    expect(result.visits[0]?.services.map((service) => service.rawName)).toEqual(["SWEDISH", "VENTOSA", "FOOT"]);
  });

  it("preserves visit span and each service source row", () => {
    const visit = parse(VISIT, CONTINUATION).visits[0]!;
    expect([visit.source.startRow, visit.source.endRow]).toEqual([4, 5]);
    expect(visit.services.map((service) => service.sourceRow)).toEqual([4, 5]);
  });

  it("parses unambiguous CASH amounts", () => {
    expect(parse(VISIT).visits[0]?.paymentEvidence[0]?.cash).toMatchObject({ raw: "500", amount: 500, marker: null });
  });

  it("parses unambiguous GCASH amounts", () => {
    const row = [...VISIT]; row[7] = ""; row[8] = "1,200.50";
    expect(parse(row).visits[0]?.paymentEvidence[0]?.gcash.amount).toBe(1200.5);
  });

  it("preserves mixed payment evidence by column", () => {
    const row = [...VISIT]; row[8] = "200"; row[9] = "100"; row[10] = "50";
    expect(parse(row).visits[0]?.paymentEvidence[0]).toMatchObject({
      cash: { amount: 500 }, gcash: { amount: 200 }, bankQr: { amount: 100 }, cardTerminal: { amount: 50 },
    });
  });

  it("preserves literal payment markers instead of guessing an amount", () => {
    const row = [...VISIT]; row[7] = "CASH";
    const visit = parse(row).visits[0]!;
    expect(visit.paymentEvidence[0]?.cash).toMatchObject({ amount: null, marker: "CASH" });
    expect(visit.confidence).toBe("needs_review");
  });

  it("marks GV as ambiguous", () => {
    const row = [...VISIT]; row[7] = "GV";
    expect(parse(row).visits[0]).toMatchObject({ confidence: "needs_review" });
    expect(parseSheetAmount("GV")).toEqual({ raw: "GV", amount: null, marker: "GV" });
  });

  it("marks SENIOR as ambiguous", () => {
    const row = [...VISIT]; row[8] = "SENIOR";
    expect(parse(row).visits[0]?.ambiguities.join(" ")).toContain("SENIOR");
  });

  it("preserves an R-prefix convention", () => {
    const row = [...VISIT]; row[7] = "R 500";
    expect(parse(row).visits[0]?.paymentEvidence[0]?.cash).toMatchObject({ raw: "R 500", amount: null });
    expect(parse(row).visits[0]?.confidence).toBe("needs_review");
  });

  it("preserves an -IH convention", () => {
    const row = [...VISIT]; row[10] = "-IH";
    expect(parse(row).visits[0]?.paymentEvidence[0]?.cardTerminal.marker).toBe("-IH");
    expect(parse(row).visits[0]?.confidence).toBe("needs_review");
  });

  it("treats dash and blank as no numeric amount without inventing one", () => {
    expect(parseSheetAmount("-")).toEqual({ raw: "-", amount: null, marker: "-" });
    expect(parseSheetAmount("")).toEqual({ raw: "", amount: null, marker: null });
    const row = [...VISIT]; row[7] = "-";
    expect(parse(row).visits[0]?.confidence).toBe("recognized");
  });

  it("preserves a Home Service-like location without creating a Home Service entity", () => {
    expect(parse(VISIT).visits[0]?.locationRawValue).toBe("AYALA NP");
    expect(Object.keys(parse(VISIT).visits[0]!)).not.toContain("homeServiceBooking");
  });

  it("sends a malformed service row to Needs Review", () => {
    const result = parse(["", "", "", "", "VENTOSA", "200"]);
    expect(result.visits).toHaveLength(0);
    expect(result.needsReview[0]?.reason).toBe("Orphan service continuation");
  });

  it("does not silently discard meaningful unknown operational rows", () => {
    const result = parse(["mystery operational note"]);
    expect(result.classifiedRows.at(-1)?.classification).toBe("UNKNOWN_NEEDS_REVIEW");
    expect(result.needsReview[0]?.rawCells).toEqual(["mystery operational note"]);
  });

  it("keeps source identity stable for the same row span", () => {
    const first = makeSheetSource("sheet-1", "OCT.2-8, 2026", 4, 5, [VISIT, CONTINUATION]);
    const second = makeSheetSource("sheet-1", "OCT.2-8, 2026", 4, 5, [VISIT, CONTINUATION]);
    expect(first.sourceKey).toBe(second.sourceKey);
  });

  it("changes only the fingerprint when source content changes", () => {
    const first = makeSheetSource("sheet-1", "OCT.2-8, 2026", 4, 4, [VISIT]);
    const changed = [...VISIT]; changed[5] = "550";
    const second = makeSheetSource("sheet-1", "OCT.2-8, 2026", 4, 4, [changed]);
    expect(second.sourceKey).toBe(first.sourceKey);
    expect(second.contentFingerprint).not.toBe(first.contentFingerprint);
  });

  it("selects current and prior weekly tabs without guessing ambiguous names", () => {
    const names = ["OCT.2-8, 2026", "SEPT 25-OCT 1, 2026", "MARCH 28-APR 3, 2026"];
    expect(selectCurrentAndPreviousTabs(names, "2026-10-03")).toMatchObject({
      status: "selected", current: { name: names[0] }, previous: { name: names[1] },
    });
    expect(selectCurrentAndPreviousTabs([...names, "OCT 2-8, 2026"], "2026-10-03").status).toBe("ambiguous");
    expect(parseWeeklyTab("OCT.2-8, 2026")?.startDate).toBe("2026-10-02");
  });

  it("does not join a service across a blank boundary", () => {
    const result = parse(VISIT, [], CONTINUATION);
    expect(result.visits[0]?.services).toHaveLength(1);
    expect(result.needsReview[0]?.reason).toBe("Orphan service continuation");
  });

  it("does not mistake a service name containing TOTAL for a summary", () => {
    const row = [...VISIT]; row[4] = "TOTAL BODY MASSAGE";
    expect(parse(row).visits[0]?.services[0]?.rawName).toBe("TOTAL BODY MASSAGE");
  });

  it("flags a continuation with a conflicting location", () => {
    const row = [...CONTINUATION]; row[12] = "LA COSTA";
    const result = parse(VISIT, row);
    expect(result.visits[0]?.services).toHaveLength(1);
    expect(result.needsReview[0]?.reason).toBe("Conflicting continuation location");
  });

  it("keeps unassigned financial notes separate from visits", () => {
    const result = parse(VISIT, ["", "", "", "", "", "", "", "", "GCASH"]);
    expect(result.classifiedRows.at(-1)?.classification).toBe("FINANCIAL_NOTE");
    expect(result.needsReview[0]?.reason).toBe("Unassigned financial note");
    expect(result.visits).toHaveLength(1);
  });
});
