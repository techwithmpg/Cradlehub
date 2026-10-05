import { describe, expect, it } from "vitest";
import { sortBookingsRecentFirst, sortSheetReferencesRecentFirst } from "./booking-recency";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import type { SheetBookingReference } from "@/lib/integrations/google-sheets/sheet-native-types";

function booking(id: string, date: string, time: string, created: string): WorkspaceBookingRow {
  return { id, booking_date: date, start_time: time, created_at: created } as WorkspaceBookingRow;
}

function sheet(id: string, date: string, sortMinute: number | null): SheetBookingReference {
  return { businessDate: date, sortMinute, source: { sourceKey: id } } as SheetBookingReference;
}

describe("booking presentation recency", () => {
  it("orders canonical service time descending, then creation and stable id", () => {
    const rows = [
      booking("old", "2026-10-04", "20:00", "2026-10-01T12:00:00Z"),
      booking("morning", "2026-10-05", "08:00", "2026-10-02T12:00:00Z"),
      booking("a", "2026-10-05", "20:00", "2026-10-03T12:00:00Z"),
      booking("b", "2026-10-05", "20:00", "2026-10-03T12:00:00Z"),
      booking("newer", "2026-10-05", "20:00", "2026-10-04T12:00:00Z"),
    ];
    expect(sortBookingsRecentFirst(rows).map((row) => row.id)).toEqual([
      "newer",
      "a",
      "b",
      "morning",
      "old",
    ]);
    expect(rows[0]?.id).toBe("old");
  });

  it("orders normalized Sheet times without altering external references", () => {
    const rows = [
      sheet("late-b", "2026-10-05", 1200),
      sheet("early", "2026-10-05", 480),
      sheet("late-a", "2026-10-05", 1200),
      sheet("unknown", "2026-10-05", null),
    ];
    expect(sortSheetReferencesRecentFirst(rows).map((row) => row.source.sourceKey)).toEqual([
      "late-a",
      "late-b",
      "early",
      "unknown",
    ]);
    expect(rows[0]?.source.sourceKey).toBe("late-b");
  });
});
