import { isCrmPendingBookingStatus, isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";
import { canonicalizeSystemRole } from "@/constants/staff-roles";
import { canManageBookings } from "@/lib/auth/crm-permissions";
import type { WorkflowTask } from "@/lib/notifications/types";

export type StaffWorkItem = {
  id: string; source: "bookings" | "workflow_tasks" | "attendance_exceptions"; entityId: string;
  title: string; detail: string; href: string | null;
};
export type StaffWorkResult = { items: StaffWorkItem[]; errors: string[] };
export type WorkBooking = {
  id: string; branch_id: string; booking_date: string; start_time: string;
  status: string; payment_status: string | null; booking_progress_status: string | null;
  delivery_type: string | null;
  staff_id?: string | null; driver_id?: string | null; metadata?: unknown;
};

export function bookingWorkItems(rows: WorkBooking[], branchId: string, role: string, today?: string): StaffWorkItem[] {
  if (!canManageBookings(role)) return [];
  return rows.filter(row => row.branch_id === branchId && !isBookingClosedForCrm(row.status))
    .flatMap(row => {
      if (today && row.booking_date !== today && !isCrmPendingBookingStatus(row.status)) return [];
      const meta = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
      const dispatch = meta.dispatch && typeof meta.dispatch === "object" ? meta.dispatch as Record<string, unknown> : {};
      const reasons = [
        isCrmPendingBookingStatus(row.status) ? "Booking awaiting review" : null,
        ["unpaid", "pending", "pending_payment", "partial"].includes(row.payment_status ?? "") ? "Payment attention" : null,
        row.status !== "completed" && row.staff_id === null ? "Provider assignment required" : null,
        row.status !== "completed" && row.delivery_type === "home_service" && row.driver_id === null ? "Driver assignment required" : null,
        row.status !== "completed" && row.delivery_type === "home_service" && dispatch.needs_location_review === true ? "Home Service location review" : null,
        row.delivery_type !== "home_service" && row.status === "confirmed" &&
          (!row.booking_progress_status || row.booking_progress_status === "not_started") ? "Arrival / check-in pending" : null,
      ].filter(Boolean);
      return reasons.length ? [{
        id: row.id, source: "bookings" as const, entityId: row.id, title: reasons.join(" · "),
        detail: `${row.booking_date} · ${row.start_time} · ${row.status}`,
        href: `/crm/bookings?bookingId=${encodeURIComponent(row.id)}`,
      }] : [];
    });
}

export function workflowWorkItems(rows: WorkflowTask[], staff: { id: string; branch_id: string; system_role: string }): StaffWorkItem[] {
  const crm = canManageBookings(staff.system_role);
  return rows.filter(row => row.branch_id === staff.branch_id && ["open", "in_progress"].includes(row.status) &&
    (row.assigned_to_staff_id === staff.id || (crm && !row.assigned_to_staff_id && row.workspace_scope === "crm")) &&
    (!row.assigned_to_role || canonicalizeSystemRole(row.assigned_to_role) === canonicalizeSystemRole(staff.system_role)))
    .map(row => ({
      id: row.id, source: "workflow_tasks", entityId: row.entity_id,
      title: row.title, detail: [row.body, row.status, row.due_at ? `Due ${row.due_at}` : null].filter(Boolean).join(" · "),
      // Unsupported task actions remain explicitly read-only.
      href: crm && row.entity_type === "booking" ? `/crm/bookings?bookingId=${encodeURIComponent(row.entity_id)}` : null,
    }));
}
