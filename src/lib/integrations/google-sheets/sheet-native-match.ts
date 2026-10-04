import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import type { SheetBookingReference } from "./sheet-native-types";

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function normalized(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalMinute(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

/** Advisory only: no canonical ID is placed on the Sheet reference. */
export function withPossibleMatch(
  references: readonly SheetBookingReference[],
  canonicalBookings: readonly WorkspaceBookingRow[]
): SheetBookingReference[] {
  return references.map((reference) => {
    const name = normalized(reference.customerDisplay);
    const services = reference.services.map((service) => normalized(service.name)).filter(Boolean);
    if (!name || reference.sortMinute === null || services.length === 0) return reference;
    const candidates = canonicalBookings.filter((booking) => {
      if (
        booking.branch_id !== reference.branchId ||
        booking.booking_date !== reference.businessDate
      )
        return false;
      if (normalized(first(booking.customers)?.full_name) !== name) return false;
      if (canonicalMinute(booking.start_time) !== reference.sortMinute) return false;
      return services.includes(normalized(first(booking.services)?.name));
    });
    return {
      ...reference,
      possibleMatch:
        candidates.length === 1 ? "POSSIBLE_MATCH" : candidates.length > 1 ? "NEEDS_REVIEW" : null,
    };
  });
}

export function filterSheetBookings(
  references: readonly SheetBookingReference[],
  search?: string
): SheetBookingReference[] {
  const term = normalized(search);
  if (!term) return [...references];
  return references.filter((reference) =>
    [
      reference.customerDisplay,
      reference.attendantDisplay,
      ...reference.services.map((service) => service.name),
    ].some((value) => normalized(value).includes(term))
  );
}
