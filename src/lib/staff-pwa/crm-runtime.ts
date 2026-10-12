import "server-only";

import { canManageBookings } from "@/lib/auth/crm-permissions";
import { CRM_OPERATIONAL_BOOKING_STATUSES } from "@/lib/bookings/crm-booking-status";
import { getProviderBusinessDate } from "./provider-date";
import { getStaffPwaContext } from "./staff-context";
import type { CrmMobileBooking } from "./crm-model";

const MAX_BOOKINGS = 120;

export type CrmMobileRuntime = {
  date: string;
  canViewBookings: boolean;
  bookings: CrmMobileBooking[];
  bookingError: string | null;
  truncated: boolean;
};

/** A bounded read-only view. Authorization and branch come from the active server session. */
export async function getCrmMobileRuntime(): Promise<CrmMobileRuntime> {
  const { db, staff, group } = await getStaffPwaContext();
  if (group !== "crm_general") throw new Error("CRM mobile access denied.");

  const date = await getProviderBusinessDate(staff.branch_id);
  const canViewBookings = canManageBookings(staff.system_role);
  if (!canViewBookings) {
    return { date, canViewBookings, bookings: [], bookingError: null, truncated: false };
  }

  const end = new Date(`${date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 14);
  const { data, error } = await db
    .from("bookings")
    .select(
      "id, branch_id, booking_date, start_time, status, booking_progress_status, delivery_type, customers(full_name), services(name)"
    )
    .eq("branch_id", staff.branch_id)
    .gte("booking_date", date)
    .lte("booking_date", end.toISOString().slice(0, 10))
    .in("status", [...CRM_OPERATIONAL_BOOKING_STATUSES, "completed"])
    .order("booking_date")
    .order("start_time")
    .limit(MAX_BOOKINGS + 1);

  if (error) {
    return {
      date,
      canViewBookings,
      bookings: [],
      bookingError: "Booking schedule could not be loaded. Refresh when your connection returns.",
      truncated: false,
    };
  }

  const scoped = (data ?? []).filter((row) => row.branch_id === staff.branch_id);
  return {
    date,
    canViewBookings,
    bookings: scoped.slice(0, MAX_BOOKINGS).map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      date: row.booking_date,
      time: row.start_time,
      status: row.status,
      progress: row.booking_progress_status,
      deliveryType: row.delivery_type,
      customerName: row.customers?.full_name?.trim() || "Customer",
      serviceName: row.services?.name?.trim() || "Service",
    })),
    bookingError: null,
    truncated: scoped.length > MAX_BOOKINGS,
  };
}
