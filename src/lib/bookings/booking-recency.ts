import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import type { SheetBookingReference } from "@/lib/integrations/google-sheets/sheet-native-types";

function minuteOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function sortBookingsRecentFirst(bookings: WorkspaceBookingRow[]): WorkspaceBookingRow[] {
  return [...bookings].sort((a, b) => {
    const date = b.booking_date.localeCompare(a.booking_date);
    if (date) return date;
    const time = (minuteOf(b.start_time) ?? -1) - (minuteOf(a.start_time) ?? -1);
    if (time) return time;
    const created = (b.created_at ?? "").localeCompare(a.created_at ?? "");
    return created || a.id.localeCompare(b.id);
  });
}

export function sortSheetReferencesRecentFirst(
  references: SheetBookingReference[]
): SheetBookingReference[] {
  return [...references].sort(
    (a, b) =>
      b.businessDate.localeCompare(a.businessDate) ||
      (b.sortMinute ?? -1) - (a.sortMinute ?? -1) ||
      a.source.sourceKey.localeCompare(b.source.sourceKey)
  );
}
