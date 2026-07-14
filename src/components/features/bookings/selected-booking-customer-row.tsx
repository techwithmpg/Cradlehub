import Link from "next/link";
import { UserRound } from "lucide-react";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { SelectedBookingOverviewRow, overviewActionClass } from "./selected-booking-overview-row";
import { firstBookingRelation } from "@/lib/bookings/booking-display";

export function SelectedBookingCustomerRow({ booking }: { booking: WorkspaceBookingRow }) {
  const customer = firstBookingRelation(booking.customers);
  const contact = [customer?.phone, customer?.email].filter(Boolean).join(" · ") || "No contact details loaded";
  return (
    <SelectedBookingOverviewRow
      icon={<UserRound className="size-4" />}
      label="Customer"
      summary={contact}
      action={customer?.id ? <Link href={`/crm/${customer.id}`} className={overviewActionClass}>View profile</Link> : undefined}
    />
  );
}
