import "server-only";

import { createNotificationOnce } from "@/lib/notifications/create";
import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called only after CRM has committed the canonical confirmation transition.
 * The confirmed booking and assigned driver are reloaded, never trusted from
 * a client-supplied driver ID or stale pre-confirmation booking snapshot.
 */
export async function notifyConfirmedHomeServiceDriver(
  bookingId: string,
  branchId: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: booking, error } = await admin
      .from("bookings")
      .select("id, branch_id, driver_id, status, delivery_type, type, booking_date, start_time")
      .eq("id", bookingId)
      .eq("branch_id", branchId)
      .maybeSingle();

    if (error || !booking) {
      logError("driver.confirmed_notice.booking_lookup_failed", { bookingId, branchId, error });
      return;
    }
    if (
      booking.status !== "confirmed" ||
      (booking.delivery_type !== "home_service" && booking.type !== "home_service") ||
      !booking.driver_id
    ) return;

    const { data: driver, error: driverError } = await admin
      .from("staff")
      .select("id, auth_user_id, branch_id, staff_type, system_role, is_active, archived_at, merged_into_staff_id")
      .eq("id", booking.driver_id)
      .eq("branch_id", booking.branch_id)
      .maybeSingle();

    if (
      driverError || !driver || !driver.is_active || !driver.auth_user_id ||
      driver.archived_at || driver.merged_into_staff_id ||
      (driver.staff_type !== "driver" && driver.system_role !== "driver")
    ) return;

    await createNotificationOnce({
      branchId: booking.branch_id,
      targetWorkspace: "driver",
      recipientStaffId: driver.id,
      type: "home_service_assigned",
      title: "Home Service booking confirmed",
      body: `Your assigned trip on ${booking.booking_date} at ${booking.start_time} is confirmed. Tap to view your route.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: `/staff/driver/map?bookingId=${booking.id}`,
      priority: "high",
      requiresAction: true,
      dedupeKey: `booking:${booking.id}:confirmed:driver:${driver.id}`,
    });
  } catch (error) {
    // Notification failures must never reverse a committed booking.
    logError("driver.confirmed_notice.failed", { bookingId, branchId, error });
  }
}
