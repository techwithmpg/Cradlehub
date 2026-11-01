import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import { firstBookingRelation } from "./booking-display";
import { getBookingListIssueLabel } from "@/components/features/bookings/booking-list-row";
import { groupBookingsByOrder, matchesBookingGroupSearch } from "./group-bookings-by-order";
import { getStaffAdminName } from "@/lib/staff/display-name";

/**
 * Reads a verified booking price from metadata.
 * Returns null if the price is missing or not a finite non-negative number,
 * preventing unverified or missing price data from falsely producing a zero total.
 */
export function getVerifiedBookingPrice(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  if (!metadata) return null;
  const raw =
    metadata.price_paid !== undefined && metadata.price_paid !== null
      ? metadata.price_paid
      : metadata.price;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw >= 0 ? raw : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const num = Number(raw.trim());
    return Number.isFinite(num) && num >= 0 ? num : null;
  }
  return null;
}

/**
 * Determines whether a payment is authoritatively and fully settled.
 *
 * Rules:
 * - Payment status must be explicitly "paid". Unpaid, partial, or pending statuses are never settled.
 * - Any positive outstanding due balance means payment is incomplete or evidence is conflicting.
 * - Missing or unverified price data (total === null) cannot be treated as settled;
 *   unsettled bookings with missing price are kept visible for review.
 * - Legitimate free/zero-price services (total === 0) are preserved when authoritative
 *   settlement evidence (status === "paid") supports them.
 * - Unpaid bookings with zero derived balance (e.g. total 0, status unpaid) are NOT settled.
 */
export function isPaymentFullySettled(payment: {
  total: number | null;
  paid: number | null;
  due: number | null;
  status: string | null;
}): boolean {
  if (payment.status !== "paid") {
    return false;
  }
  if (payment.due !== null && payment.due > 0) {
    return false;
  }
  if (payment.total === null) {
    return false;
  }
  if (payment.total === 0) {
    return true;
  }
  if (payment.paid !== null && payment.paid >= payment.total) {
    return true;
  }
  if (payment.due !== null && payment.due <= 0) {
    return true;
  }
  return false;
}

export function groupCrmBookings(rows: readonly WorkspaceBookingRow[], groupOrders = true) {
  return groupBookingsByOrder(
    rows,
    {
      organizerName: (line) => firstBookingRelation(line.customers)?.full_name ?? "Customer",
      payment: (line) => {
        if (line.order_id) {
          // When order_id exists, authoritative order financial evidence is required.
          // Do not classify an order as fully paid using legacy line-level payment status,
          // amount, or price when authoritative order-financial evidence is absent.
          const total =
            line.order_total_amount != null && Number.isFinite(Number(line.order_total_amount))
              ? Number(line.order_total_amount)
              : null;
          const paid =
            line.order_amount_paid != null && Number.isFinite(Number(line.order_amount_paid))
              ? Number(line.order_amount_paid)
              : null;
          const due =
            total === null || paid === null
              ? null
              : Math.max(0, total - paid);
          const status = line.order_payment_status ?? null;

          return {
            total,
            paid,
            due,
            status,
          };
        }

        // Legacy booking behavior where order_id is absent:
        const linePriceRaw = (line as Record<string, unknown>).price;
        const linePrice =
          linePriceRaw != null && Number.isFinite(Number(linePriceRaw)) && Number(linePriceRaw) >= 0
            ? Number(linePriceRaw)
            : null;
        const total = getVerifiedBookingPrice(line.metadata) ?? linePrice;
        const paid =
          line.amount_paid != null && Number.isFinite(Number(line.amount_paid))
            ? Number(line.amount_paid)
            : 0;
        const due =
          total === null || paid === null
            ? null
            : Math.max(0, total - paid);
        const status = line.payment_status ?? null;

        return {
          total,
          paid,
          due,
          status,
        };
      },
      attention: (line) =>
        getBookingListIssueLabel(
          line.order_id && line.order_payment_status
            ? { ...line, payment_status: line.order_payment_status }
            : line
        )
          ?.replace(/^Needs /, "")
          .split(", ") ?? [],
    },
    { groupOrders }
  ).map((group) => ({
    ...group,
    attentionSummary: group.attentionSummary.map((issue) =>
      issue.replace(/^\d+ payment review$/, "payment review")
    ),
  }));
}

export type CrmBookingGroup = ReturnType<typeof groupCrmBookings>[number];

export function matchesCrmBookingGroupSearch(group: CrmBookingGroup, search: string) {
  return matchesBookingGroupSearch(group, search, (line) => {
    const customer = firstBookingRelation(line.customers);
    const staff = firstBookingRelation(line.staff);
    return [
      customer?.phone,
      firstBookingRelation(line.services)?.name,
      staff ? getStaffAdminName(staff) : null,
      firstBookingRelation(line.branch_resources)?.name,
    ];
  });
}
