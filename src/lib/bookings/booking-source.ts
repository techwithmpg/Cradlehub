export type BookingReferenceSource = "cradlehub" | "master_sheet";

export function resolveBookingReferenceSource(raw: string | null): BookingReferenceSource {
  return raw === "master_sheet" ? "master_sheet" : "cradlehub";
}
