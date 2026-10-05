// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MasterSheetReview } from "@/components/features/crm/master-sheet/master-sheet-review";
import type {
  SheetReviewState,
  SheetDutyReference,
  SheetReviewReference,
  SheetVisitReference,
} from "@/lib/integrations/google-sheets/sheet-review-projection";

afterEach(cleanup);

const visit: SheetVisitReference = {
  sourceType: "MASTER_SHEET",
  readOnly: true,
  branchState: "BRANCH_UNKNOWN",
  canonicalLink: "UNLINKED",
  source: {
    sheetName: "CURRENT",
    startRow: 7,
    endRow: 7,
    sourceKey: "source-7",
    contentFingerprint: "fingerprint",
  },
  businessDate: "2026-10-02",
  reviewReasons: ["AMBIGUOUS_PAYMENT_MARKER"],
  kind: "visit",
  time: "10:00",
  customerDisplay: "<img src=x onerror=alert(1)>",
  staffDisplay: "Sample Staff",
  services: [{ name: "Massage", hours: 1 }],
  locationEvidence: "Sample location",
  financialEvidence: [{ channel: "GCash", amount: null, ambiguous: true }],
};
const state: SheetReviewState = {
  status: "available",
  observedAt: "2026-10-04T00:00:00.000Z",
  current: { sheetName: "CURRENT", visits: [visit], duties: [], review: [] },
  previous: { sheetName: "PREVIOUS", visits: [], duties: [], review: [] },
};

describe("Master Sheet Review display", () => {
  it("marks visits, duties, and review entries as external read-only records", () => {
    const duty: SheetDutyReference = {
      sourceType: "MASTER_SHEET",
      readOnly: true,
      branchState: "BRANCH_UNKNOWN",
      canonicalLink: "UNLINKED",
      source: { ...visit.source, sourceKey: "duty-8", startRow: 8, endRow: 8 },
      businessDate: "2026-10-02",
      reviewReasons: [],
      kind: "duty",
      staffDisplay: "Sample Staff",
      dutyLabel: "Opening",
    };
    const review: SheetReviewReference = {
      sourceType: "MASTER_SHEET",
      readOnly: true,
      branchState: "BRANCH_UNKNOWN",
      canonicalLink: "UNLINKED",
      source: { ...visit.source, sourceKey: "review-9", startRow: 9, endRow: 9 },
      businessDate: null,
      reviewReasons: ["UNASSIGNED_FINANCIAL_NOTE"],
      kind: "review",
      classification: "FINANCIAL_NOTE",
    };
    render(
      <MasterSheetReview
        state={{
          ...state,
          current: { ...state.current, duties: [duty], review: [review] },
        }}
      />
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(within(card).getByText("Master Sheet")).toBeTruthy();
      expect(within(card).getByText("Read only")).toBeTruthy();
      expect(within(card).getByText("Branch: Unknown")).toBeTruthy();
      expect(within(card).queryByRole("button")).toBeNull();
      expect(within(card).queryByRole("link")).toBeNull();
    }
  });

  it("shows provenance, branch unknown, read-only payment evidence, and escaped Sheet text", () => {
    const { container } = render(<MasterSheetReview state={state} />);
    expect(screen.getByText("Branch: Unknown")).toBeTruthy();
    expect(screen.getByText("Master Sheet")).toBeTruthy();
    expect(screen.getByText("Read only")).toBeTruthy();
    expect(screen.getByText(/Sheet evidence only/)).toBeTruthy();
    expect(screen.getByText(/CURRENT · Row 7 · Observed/)).toBeTruthy();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /save|edit|import|link|create|record payment/i })
    ).toBeNull();
  });

  it("switches weeks and distinguishes an available empty week", () => {
    render(<MasterSheetReview state={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByText(/This week is available but has no Sheet visits/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous week" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Current week" }));
    expect(screen.getByText("Branch: Unknown")).toBeTruthy();
  });

  it("searches and filters references locally", () => {
    render(<MasterSheetReview state={state} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "not present" } });
    expect(screen.getByText("No Sheet references match these filters.")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "massage" } });
    expect(screen.getByText("Branch: Unknown")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "duty" } });
    expect(screen.getByText("No Sheet references match these filters.")).toBeTruthy();
  });

  it("shows a separate unavailable state", () => {
    render(
      <MasterSheetReview
        state={{ status: "unavailable", observedAt: "2026-10-04T00:00:00.000Z" }}
      />
    );
    expect(screen.getByText("Master Sheet temporarily unavailable")).toBeTruthy();
    expect(
      screen.queryByText("This week is available but has no Sheet visits, duties, or review items.")
    ).toBeNull();
  });
});
