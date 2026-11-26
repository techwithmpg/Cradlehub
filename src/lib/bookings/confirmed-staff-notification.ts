import "server-only";

import { createNotificationOnce } from "@/lib/notifications/create";
import { logError } from "@/lib/logger";
import { getActiveAssistanceAssignmentForStaffAtBranch } from "@/lib/staff/interbranch-assistance-eligibility";
import { createAdminClient } from "@/lib/supabase/admin";

type Relation<T> = T | T[] | null;

function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Notify the assigned therapist/provider after CRM confirms a booking.
 * Reloads the persisted booking and staff row from DB rather than trusting
 * client-supplied metadata.
 */
export async function notifyConfirmedAssignedStaff(
  bookingId: string,
  branchId: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: booking, error } = await admin
      .from("bookings")
      .select(
        `id, branch_id, staff_id, status, delivery_type, type, booking_date, start_time,
         customers(full_name), booking_attendees!attendee_id(display_name), services(name)`
      )
      .eq("id", bookingId)
      .eq("branch_id", branchId)
      .maybeSingle();

    if (error || !booking) {
      logError("staff.confirmed_notice.booking_lookup_failed", { bookingId, branchId, error });
      return;
    }

    if (booking.status !== "confirmed" || !booking.staff_id) return;

    const { data: staff, error: staffError } = await admin
      .from("staff")
      .select("id, auth_user_id, branch_id, is_active, archived_at, merged_into_staff_id")
      .eq("id", booking.staff_id)
      .maybeSingle();

    if (
      staffError ||
      !staff ||
      !staff.is_active ||
      !staff.auth_user_id ||
      staff.archived_at ||
      staff.merged_into_staff_id
    ) {
      return;
    }

    if (staff.branch_id !== booking.branch_id) {
      const assistance = await getActiveAssistanceAssignmentForStaffAtBranch({
        staffId: staff.id,
        branchId: booking.branch_id,
        date: booking.booking_date,
        statuses: ["arrived_clocked_in"],
        supabase: admin,
      }).catch(() => null);
      if (!assistance) {
        return;
      }
    }

    const isHomeService =
      booking.delivery_type === "home_service" || booking.type === "home_service";
    const recipientName =
      first(booking.booking_attendees as Relation<{ display_name: string | null }>)?.display_name?.trim() ||
      first(booking.customers as Relation<{ full_name: string | null }>)?.full_name?.trim() ||
      "Guest";
    const serviceName =
      first(booking.services as Relation<{ name: string | null }>)?.name?.trim() || "Service";

    await createNotificationOnce({
      branchId: booking.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: staff.id,
      type: isHomeService ? "home_service_assigned" : "booking_assigned",
      title: isHomeService
        ? `Home Service confirmed — ${recipientName}`
        : `New booking — ${recipientName}`,
      body: `${recipientName} has a confirmed ${isHomeService ? "Home Service " : ""}booking for ${serviceName} on ${booking.booking_date} at ${booking.start_time}.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: "/staff/progress",
      priority: isHomeService ? "high" : "normal",
      requiresAction: isHomeService,
      dedupeKey: `booking:${booking.id}:confirmed:staff:${staff.id}`,
    });
  } catch (error) {
    // Notification failures must never reverse a committed booking.
    logError("staff.confirmed_notice.failed", { bookingId, branchId, error });
  }
}
