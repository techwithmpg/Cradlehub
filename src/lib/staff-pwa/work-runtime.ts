import "server-only";
import { CRM_OPERATIONAL_BOOKING_STATUSES } from "@/lib/bookings/crm-booking-status";
import { getStaffPwaContext } from "./staff-context";
import { getProviderBusinessDate } from "./provider-date";
import { canManageBookings } from "@/lib/auth/crm-permissions";
import { bookingWorkItems, workflowWorkItems, type StaffWorkResult } from "./work-model";

export async function getStaffWork(): Promise<StaffWorkResult> {
  try {
    const { db, staff, group } = await getStaffPwaContext();
    if (group !== "crm_general") throw new Error("Work access denied.");
    const date = await getProviderBusinessDate(staff.branch_id);
    const end = new Date(date + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() + 14);
    const crm = canManageBookings(staff.system_role);
    let tasks = db.from("workflow_tasks").select("*").eq("branch_id", staff.branch_id)
      .in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(50);
    tasks = crm ? tasks.eq("workspace_scope", "crm").or(`assigned_to_staff_id.is.null,assigned_to_staff_id.eq.${staff.id}`)
      : tasks.eq("assigned_to_staff_id", staff.id);
    const [bookingResult, taskResult, exceptionResult] = await Promise.allSettled([
      crm ? db.from("bookings")
        .select("id, branch_id, booking_date, start_time, status, payment_status, booking_progress_status, delivery_type, staff_id, driver_id, metadata")
        .eq("branch_id", staff.branch_id).gte("booking_date", date).lte("booking_date", end.toISOString().slice(0, 10))
        .in("status", [...CRM_OPERATIONAL_BOOKING_STATUSES, "completed"]).order("booking_date").order("start_time").limit(100)
        : Promise.resolve({ data: [], error: null }),
      tasks,
      crm ? db.from("attendance_exceptions").select("id, branch_id, message, status, detected_at")
        .eq("branch_id", staff.branch_id).eq("status", "open").eq("is_test", false)
        .eq("resolution_owner", "crm").order("detected_at", { ascending: false }).limit(30)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const items: StaffWorkResult["items"] = [];
    const errors: string[] = [];
    if (bookingResult.status === "rejected" || bookingResult.value.error) errors.push("Booking attention unavailable.");
    else items.push(...bookingWorkItems(bookingResult.value.data ?? [], staff.branch_id, staff.system_role, date));
    if (taskResult.status === "rejected" || taskResult.value.error) errors.push("Workflow attention unavailable.");
    else items.push(...workflowWorkItems(taskResult.value.data ?? [], staff));
    if (exceptionResult.status === "rejected" || exceptionResult.value.error) errors.push("Attendance support unavailable.");
    else items.push(...(exceptionResult.value.data ?? []).filter(row => row.branch_id === staff.branch_id && row.status === "open").map(row => ({
      id: row.id, source: "attendance_exceptions" as const, entityId: row.id, title: "Attendance support",
      detail: row.message, href: "/crm/attendance?tab=exceptions",
    })));
    return { items, errors };
  } catch (error) {
    return { items: [], errors: [error instanceof Error ? error.message : "Work unavailable."] };
  }
}
