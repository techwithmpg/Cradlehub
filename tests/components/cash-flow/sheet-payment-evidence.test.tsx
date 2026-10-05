/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SheetNativeReferencesState } from "@/lib/integrations/google-sheets/sheet-native-types";

const mocks = vi.hoisted(() => ({ useReferences: vi.fn() }));
vi.mock("@/components/features/crm/master-sheet/use-sheet-native-references", () => ({
  useSheetNativeReferences: mocks.useReferences,
}));

import { SheetPaymentEvidence } from "@/components/features/cash-flow/sheet-payment-evidence";

afterEach(() => cleanup());

const available: SheetNativeReferencesState = {
  status: "available",
  observedAt: "2026-10-04T00:00:00.000Z",
  branchLabel: "Main Branch",
  bookings: [],
  payments: [
    {
      kind: "sheet_transaction_reference",
      evidenceKey: "source:0",
      timeText: null,
      sortMinute: null,
      sourceType: "MASTER_SHEET",
      readOnly: true,
      canonicalLink: "UNLINKED",
      branchId: "main-id",
      branchLabel: "Main Branch",
      branchDecisionStatus: "PROVISIONAL",
      businessDate: "2026-10-04",
      observedAt: "2026-10-04T00:00:00.000Z",
      reviewWarnings: [],
      source: {
        sheetName: "OCT.2-8, 2026",
        startRow: 42,
        endRow: 43,
        sourceKey: "source",
        contentFingerprint: "hash",
      },
      customerDisplay: "Sample Customer",
      channel: "GCash",
      amount: null,
      ambiguous: true,
    },
  ],
};

describe("Sheet evidence in Cash Flow", () => {
  it("labels evidence and ambiguity without a payment action or ledger effect", () => {
    mocks.useReferences.mockReturnValue({ state: available, isLoading: false });
    render(<SheetPaymentEvidence businessDate="2026-10-04" />);
    expect(screen.getAllByText(/Master Sheet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Read only/i)).toBeTruthy();
    expect(screen.getAllByText(/not a recorded CradleHub payment/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ambiguous marker/i)).toBeTruthy();
    expect(screen.getByText("Amount unknown")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /record|refund|reconcile/i })).toBeNull();
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "Cash" } });
    expect(screen.getByText(/No Master Sheet payment evidence/)).toBeTruthy();
  });

  it("keeps unavailable distinct from available empty", () => {
    mocks.useReferences.mockReturnValue({
      state: { status: "unavailable", observedAt: "now" },
      isLoading: false,
    });
    render(<SheetPaymentEvidence businessDate="2026-10-04" />);
    expect(screen.getByText(/temporarily unavailable/)).toBeTruthy();
    cleanup();
    mocks.useReferences.mockReturnValue({
      state: {
        status: "available_empty",
        observedAt: "now",
        branchLabel: "Main Branch",
        bookings: [],
        payments: [],
      },
      isLoading: false,
    });
    render(<SheetPaymentEvidence businessDate="2026-10-04" />);
    expect(screen.getByText(/No Master Sheet payment evidence/)).toBeTruthy();
  });
});
