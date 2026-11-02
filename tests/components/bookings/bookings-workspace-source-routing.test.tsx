// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/bookings",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/features/bookings/bookings-table", () => ({ BookingsTable: () => null }));
vi.mock("@/components/features/bookings/bookings-desktop-workspace", () => ({
  BookingsDesktopWorkspace: () => <div>Compact canonical workspace</div>,
}));
vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  OpenAdministrativeBookingButton: () => null,
}));
import { BookingsWorkspace } from "@/components/features/bookings/bookings-workspace";
import type { SheetBookingReference } from "@/lib/integrations/google-sheets/sheet-native-types";
afterEach(cleanup);
const reference: SheetBookingReference = {
  kind: "sheet_booking_reference",
  sourceType: "MASTER_SHEET",
  readOnly: true,
  canonicalLink: "UNLINKED",
  branchId: "main",
  branchLabel: "Main",
  branchDecisionStatus: "PROVISIONAL",
  businessDate: "2026-11-02",
  timeText: "9:30 AM",
  sortMinute: 570,
  customerDisplay: "Synthetic Sheet Guest",
  attendantDisplay: "Preview Staff",
  services: [{ name: "Massage", hours: 1 }],
  possibleMatch: "POSSIBLE_MATCH",
  reviewWarnings: [],
  observedAt: "2026-11-02T00:00:00Z",
  source: {
    sheetName: "PREVIEW",
    startRow: 1,
    endRow: 2,
    sourceKey: "preview-sheet",
    contentFingerprint: "hash",
  },
};
describe("Bookings reference source routing", () => {
  it.each(["master_sheet", "all"] as const)(
    "keeps read-only references reachable for %s",
    (referenceSource) => {
      render(
        <BookingsWorkspace
          workspaceContext="crm"
          viewerRole="crm"
          date="2026-11-02"
          bookings={[]}
          referenceSource={referenceSource}
          sheetState={{
            status: "available",
            observedAt: reference.observedAt,
            branchLabel: "Main",
            bookings: [reference],
            payments: [],
          }}
        />
      );
      expect(screen.getByRole("region", { name: "Master Sheet booking references" })).toBeTruthy();
      expect(
        screen.getByRole("region", { name: "Master Sheet booking references" }).textContent
      ).toContain("Synthetic Sheet Guest");
      expect(screen.queryByText("Compact canonical workspace")).toBeNull();
    }
  );
  it("uses the compact workspace for canonical bookings", () => {
    render(
      <BookingsWorkspace
        workspaceContext="crm"
        viewerRole="crm"
        date="2026-11-02"
        bookings={[]}
        referenceSource="cradlehub"
      />
    );
    expect(screen.getByText("Compact canonical workspace")).toBeTruthy();
  });
});
