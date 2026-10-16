import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import { firstBookingRelation, readBookingPrice } from "./booking-display";
import { getBookingListIssueLabel } from "@/components/features/bookings/booking-list-row";
import { groupBookingsByOrder, matchesBookingGroupSearch } from "./group-bookings-by-order";
import { getStaffAdminName } from "@/lib/staff/display-name";

export function groupCrmBookings(rows: readonly WorkspaceBookingRow[], groupOrders = true) {
  return groupBookingsByOrder(
    rows,
    {
      organizerName: (line) => firstBookingRelation(line.customers)?.full_name ?? "Customer",
      payment: (line) => {
        const total = line.order_id
          ? (line.order_total_amount ?? null)
          : readBookingPrice(line.metadata);
        const paid = line.order_id
          ? (line.order_amount_paid ?? null)
          : Number(line.amount_paid ?? 0);
        return {
          total,
          paid,
          due: total === null || paid === null ? null : Math.max(0, total - paid),
          status: line.order_id ? (line.order_payment_status ?? null) : line.payment_status,
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
