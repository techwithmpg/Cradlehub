/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingsDesktopList } from "@/components/features/bookings/bookings-desktop-list";
import {
  SheetBookingReferenceCard,
  SheetBookingReferenceDetail,
} from "@/components/features/bookings/sheet-booking-reference-row";
import type { SheetBookingReference } from "@/lib/integrations/google-sheets/sheet-native-types";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

afterEach(() => cleanup());

const reference: SheetBookingReference = {
  kind: "sheet_booking_reference",
  sourceType: "MASTER_SHEET",
  readOnly: true,
  canonicalLink: "UNLINKED",
  branchId: "main-id",
  branchLabel: "Main Branch",
  branchDecisionStatus: "PROVISIONAL",
  businessDate: "2026-10-04",
  timeText: "9:30 AM",
  sortMinute: 570,
  customerDisplay: "Sample Customer",
  attendantDisplay: "Sample Staff",
  services: [{ name: "Massage", hours: 1 }],
  possibleMatch: "POSSIBLE_MATCH",
  reviewWarnings: [],
  observedAt: "2026-10-04T00:00:00.000Z",
  source: {
    sheetName: "OCT.2-8, 2026",
    startRow: 42,
    endRow: 43,
    sourceKey: "sheet-source",
    contentFingerprint: "hash",
  },
};
const booking: WorkspaceBookingRow = {
  id: "canonical-id",
  branch_id: "main-id",
  booking_date: "2026-10-04",
  start_time: "10:00:00",
  type: "online",
  status: "confirmed",
  payment_method: "cash",
  payment_status: "paid",
  amount_paid: 500,
  customers: { full_name: "Canonical Customer" },
  services: { name: "Massage" },
};

describe("native booking reference presentation", () => {
  it("keeps a distinct read-only row without calling canonical selection", () => {
    const selectBooking = vi.fn();
    const selectSheet = vi.fn();
    render(
      <BookingsDesktopList
        bookings={[booking]}
        sheetReferences={[reference]}
        selectedId={null}
        onSelect={selectBooking}
        onSelectSheet={selectSheet}
      />
    );
    const rows = screen.getAllByRole("row");
    expect(rows[1]?.textContent).toContain("Canonical Customer");
    expect(rows[2]?.textContent).toContain("Sample Customer");
    const sheetRow = screen.getByRole("row", { name: /Read only Master Sheet reference/i });
    expect(sheetRow.textContent).toContain("Master Sheet");
    expect(sheetRow.textContent).toContain("Read only");
    fireEvent.keyDown(sheetRow, { key: "Enter" });
    expect(selectSheet).toHaveBeenCalledWith(reference);
    expect(selectBooking).not.toHaveBeenCalled();
  });

  it("labels unknown time and exposes source detail without mutation controls", () => {
    const unknown = { ...reference, timeText: "unparseable", sortMinute: null };
    render(
      <BookingsDesktopList
        bookings={[]}
        sheetReferences={[unknown]}
        selectedId={null}
        onSelect={vi.fn()}
        onSelectSheet={vi.fn()}
      />
    );
    expect(screen.getByText(/Time unknown · Master Sheet references/)).toBeTruthy();
    cleanup();
    render(
      <>
        <SheetBookingReferenceCard reference={reference} />
        <SheetBookingReferenceDetail reference={reference} onClose={vi.fn()} />
      </>
    );
    expect(screen.getByText(/This Sheet reference may describe the same visit/)).toBeTruthy();
    expect(screen.queryByText(/Record payment|Cancel booking|Assign therapist/i)).toBeNull();
    expect(screen.getAllByText(/Read only/i).length).toBeGreaterThan(0);
  });
});
