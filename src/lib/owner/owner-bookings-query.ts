import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

/** A query identity, not a grant. Server actions validate Owner access and branch visibility. */
export type OwnerBookingsQuery = Readonly<{
  date: string;
  branch?: string;
  status?: string;
  type?: string;
}>;

export type OwnerBookingsInitialRead =
  | { status: "ready"; bookings: WorkspaceBookingRow[] }
  | { status: "error"; message: string };

export function ownerBookingsRequestKey(query: OwnerBookingsQuery): string {
  return JSON.stringify([
    query.date,
    query.branch ?? "",
    query.status ?? "",
    query.type ?? "",
  ]);
}

export function ownerBookingsInitialRead(
  result: { error: string } | { bookings: WorkspaceBookingRow[] }
): OwnerBookingsInitialRead {
  return "error" in result
    ? { status: "error", message: result.error }
    : { status: "ready", bookings: result.bookings };
}

export function isOwnerBookingsBranchParamInvalid(
  search: Pick<URLSearchParams, "getAll">
): boolean {
  // Runtime scope treats duplicate branch selectors as unavailable. Do not
  // convert the first value into a different (valid) request during refresh.
  return search.getAll("branch").length > 1;
}
