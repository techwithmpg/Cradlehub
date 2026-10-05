import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  resolveWorkbookSource,
  resolveConfiguredWorkbookSources,
  type WorkbookSourceConfiguration,
} from "@/lib/integrations/google-sheets/workbook-source-map";
import { CRADLE_MAINSHEETS_SPREADSHEET_ID } from "@/lib/integrations/google-sheets/sheet-reader";
import {
  projectNativeReferences,
  sheetTimeMinute,
} from "@/lib/integrations/google-sheets/sheet-native-projection";
import {
  filterSheetBookings,
  withPossibleMatch,
} from "@/lib/integrations/google-sheets/sheet-native-match";
import type { SheetProjection } from "@/lib/integrations/google-sheets/sheet-types";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

const workbookId = CRADLE_MAINSHEETS_SPREADSHEET_ID;
const branches = [
  { id: "main-id", name: "Cradle Spa — Main Branch" },
  { id: "sm-id", name: "Cradle Spa - SM Branch" },
];
const mapping = resolveWorkbookSource(workbookId, branches)!;
const blankAmount = { raw: "", amount: null, marker: null };
const current: SheetProjection = {
  spreadsheetId: workbookId,
  sheetName: "OCT.2-8, 2026",
  businessTimezone: "Asia/Manila",
  sourceRowCount: 1,
  classifiedRows: [],
  visits: [
    {
      sourceType: "MASTER_SHEET",
      readOnly: true,
      source: {
        spreadsheetId: workbookId,
        sheetName: "OCT.2-8, 2026",
        startRow: 42,
        endRow: 43,
        sourceKey: "sheet-source",
        contentFingerprint: "content-hash",
      },
      businessDate: "2026-10-04",
      timeRaw: "9:30 AM",
      customerRawName: " Sample Customer ",
      attendantRawNames: "Sample Staff",
      locationRawValue: "untrusted location",
      services: [
        {
          sourceRow: 42,
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
  duties: [],
  needsReview: [],
};
const previous: SheetProjection = { ...current, sheetName: "SEPT 25-OCT 1, 2026", visits: [] };

describe("provisional workbook mapping", () => {
  it("resolves only the configured workbook to one active Main Branch", () => {
    expect(
      resolveWorkbookSource(workbookId, [{ id: "live-main", name: "Main Spa" }])?.branchId
    ).toBe("live-main");
    expect(
      resolveWorkbookSource(workbookId, [
        { id: "live-main", name: "Cradle Wellness living Main Spa" },
      ])?.branchId
    ).toBe("live-main");
    expect(mapping).toEqual({
      workbookId,
      workbookLabel: "CRADLE MAINSHEETS",
      branchId: "main-id",
      label: "Main Branch",
      enabled: true,
      decisionStatus: "PROVISIONAL",
    });
    expect(resolveWorkbookSource("unknown", branches)).toBeNull();
    expect(
      resolveWorkbookSource(
        workbookId,
        branches.filter((branch) => branch.id !== "main-id")
      )
    ).toBeNull();
    expect(
      resolveWorkbookSource(workbookId, [...branches, { id: "duplicate", name: "Main Branch" }])
    ).toBeNull();
  });

  it("fails closed for disabled configuration and can change mapping without changing parser data", () => {
    const config: WorkbookSourceConfiguration = {
      workbookId,
      branchLabel: "Main Branch",
      enabled: false,
      decisionStatus: "PROVISIONAL",
    };
    expect(resolveWorkbookSource(workbookId, branches, [config])).toBeNull();
    const replacement = resolveWorkbookSource(workbookId, [
      { id: "replacement", name: "Main Branch" },
    ]);
    expect(replacement?.branchId).toBe("replacement");
    expect(current.visits[0]?.source.spreadsheetId).toBe(workbookId);
    expect(current.visits[0]).not.toHaveProperty("branchId");
  });

  it("can map a later SM workbook through source configuration alone", () => {
    const smConfig: WorkbookSourceConfiguration = {
      workbookId: "sm-workbook",
      branchLabel: "SM Branch",
      enabled: true,
      decisionStatus: "PROVISIONAL",
    };
    const resolved = resolveWorkbookSource("sm-workbook", branches, [smConfig]);
    expect(resolved?.branchId).toBe("sm-id");
    expect(resolved?.decisionStatus).toBe("PROVISIONAL");
    expect(resolveWorkbookSource(workbookId, branches, [smConfig])).toBeNull();
    const allSources = resolveConfiguredWorkbookSources(branches, [
      {
        workbookId,
        workbookLabel: "CRADLE MAINSHEETS",
        branchLabel: "Main Branch",
        enabled: true,
        decisionStatus: "PROVISIONAL",
      },
      smConfig,
    ]);
    expect(allSources.map((source) => source.branchId)).toEqual(["main-id", "sm-id"]);
  });
});

describe("native read-only Sheet DTOs", () => {
  it("keeps booking and payment evidence external, minimized, and separate", () => {
    const result = projectNativeReferences(
      { status: "available", current, previous },
      mapping,
      "2026-10-04",
      "2026-10-04T00:00:00.000Z"
    );
    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("Expected reference data");
    expect(result.bookings).toHaveLength(1);
    expect(result.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "Cash", amount: 500, ambiguous: false }),
        expect.objectContaining({ channel: "GCash", amount: null, ambiguous: true }),
      ])
    );
    expect(result.bookings[0]).toMatchObject({
      sourceType: "MASTER_SHEET",
      readOnly: true,
      canonicalLink: "UNLINKED",
      branchId: "main-id",
      branchDecisionStatus: "PROVISIONAL",
      sortMinute: 570,
    });
    for (const record of [...result.bookings, ...result.payments]) {
      for (const field of [
        "id",
        "bookingId",
        "customerId",
        "staffId",
        "status",
        "paymentStatus",
        "actions",
      ])
        expect(record).not.toHaveProperty(field);
    }
    expect(JSON.stringify(result)).not.toContain("untrusted location");
    expect(JSON.stringify(result)).not.toContain("GV");
    expect(JSON.stringify(result)).not.toContain(workbookId);
  });

  it("distinguishes empty and mismatched-workbook reads", () => {
    expect(
      projectNativeReferences(
        { status: "available", current, previous },
        mapping,
        "2026-10-05",
        "now"
      ).status
    ).toBe("available_empty");
    expect(
      projectNativeReferences(
        { status: "available", current: { ...current, spreadsheetId: "different" }, previous },
        mapping,
        "2026-10-04",
        "now"
      ).status
    ).toBe("unavailable");
    expect(sheetTimeMinute("invalid")).toBeNull();
    expect(sheetTimeMinute("13:30")).toBe(810);
    expect(sheetTimeMinute("12:00 AM")).toBe(0);
  });

  it("advises only a unique conservative match and keeps both records", () => {
    const result = projectNativeReferences(
      { status: "available", current, previous },
      mapping,
      "2026-10-04",
      "now"
    );
    if (result.status !== "available") throw new Error("Expected references");
    const canonical: WorkspaceBookingRow = {
      id: "canonical-id",
      branch_id: "main-id",
      booking_date: "2026-10-04",
      start_time: "09:30:00",
      type: "online",
      status: "confirmed",
      payment_method: "cash",
      payment_status: "paid",
      amount_paid: 500,
      customers: { full_name: "Sample Customer" },
      services: { name: "Massage" },
    };
    expect(withPossibleMatch(result.bookings, [canonical])[0]?.possibleMatch).toBe(
      "POSSIBLE_MATCH"
    );
    expect(
      withPossibleMatch(result.bookings, [canonical, { ...canonical, id: "second" }])[0]
        ?.possibleMatch
    ).toBe("NEEDS_REVIEW");
    expect(
      withPossibleMatch(result.bookings, [{ ...canonical, branch_id: "sm-id" }])[0]?.possibleMatch
    ).toBeNull();
    expect(
      withPossibleMatch(result.bookings, [{ ...canonical, start_time: "10:00:00" }])[0]
        ?.possibleMatch
    ).toBeNull();
    expect(filterSheetBookings(result.bookings, "massage")).toHaveLength(1);
  });
});
