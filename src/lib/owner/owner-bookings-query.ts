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

/**
 * Normalizes booking metadata into a Record<string, unknown> or null.
 * Preserves legitimate legacy Home Service metadata properties (type, delivery_type, address, etc.).
 */
export function normalizeBookingMetadata(
  metadata: unknown
): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function toWorkspaceBookingRow<
  T extends {
    id: string;
    booking_date: string;
    start_time: string;
    type: string;
    status: string;
    payment_method?: unknown;
    payment_status?: unknown;
    amount_paid?: unknown;
    metadata?: unknown;
  },
>(row: T): WorkspaceBookingRow {
  const paymentMethod =
    typeof row.payment_method === "string" ? row.payment_method : "pay_on_site";
  const paymentStatus =
    typeof row.payment_status === "string" ? row.payment_status : "unpaid";
  const amountPaid =
    typeof row.amount_paid === "number" && Number.isFinite(row.amount_paid)
      ? row.amount_paid
      : 0;

  return {
    ...row,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    amount_paid: amountPaid,
    metadata: normalizeBookingMetadata(row.metadata),
  };
}

export type OwnerBookingsResultInput =
  | { error: string }
  | {
      bookings: readonly (Omit<WorkspaceBookingRow, "metadata"> & {
        metadata?: unknown;
      })[];
    };

export function ownerBookingsInitialRead(
  result: OwnerBookingsResultInput
): OwnerBookingsInitialRead {
  if ("error" in result) {
    return { status: "error", message: result.error };
  }
  return {
    status: "ready",
    bookings: result.bookings.map(toWorkspaceBookingRow),
  };
}

export function isOwnerBookingsBranchParamInvalid(
  search: Pick<URLSearchParams, "getAll">
): boolean {
  // Runtime scope treats duplicate branch selectors as unavailable. Do not
  // convert the first value into a different (valid) request during refresh.
  return search.getAll("branch").length > 1;
}
