import { canonicalizeSystemRole } from "@/constants/staff-roles";
import { canManageBookings } from "@/lib/auth/crm-permissions";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import type { WorkspaceNotification } from "@/lib/notifications/types";

export type NoticeStaff = { id: string; branch_id: string; system_role: string; staff_type?: string | null };

export function staffNotificationWorkspace(staff: Pick<NoticeStaff, "system_role" | "staff_type">) {
  const group = resolveStaffPwaOperationalGroup(staff.system_role, staff.staff_type);
  if (group === "crm_general") return canManageBookings(staff.system_role) ? "crm" : "staff";
  return group === "provider" ? "staff" : group;
}

export function isCurrentNotice(notice: WorkspaceNotification, now = Date.now()) {
  if (!["unread", "read"].includes(notice.status) || notice.resolved_at) return false;
  const created = Date.parse(notice.created_at);
  if (!Number.isFinite(created) || created < now - 30 * 86400000) return false;
  const metadata = notice.metadata && typeof notice.metadata === "object" && !Array.isArray(notice.metadata) ? notice.metadata : {};
  const expires = typeof metadata.expires_at === "string" ? Date.parse(metadata.expires_at) : null;
  return expires === null || (Number.isFinite(expires) && expires > now);
}

export function noticeMatchesStaff(notice: WorkspaceNotification, staff: NoticeStaff, now = Date.now()) {
  if (!isCurrentNotice(notice, now) || notice.branch_id !== staff.branch_id) return false;
  const workspace = staffNotificationWorkspace(staff);
  if (!workspace || notice.target_workspace !== workspace) return false;
  if (notice.recipient_staff_id && notice.recipient_staff_id !== staff.id) return false;
  if (workspace !== "crm" && notice.recipient_staff_id !== staff.id) return false;
  return !notice.target_role || canonicalizeSystemRole(notice.target_role) === canonicalizeSystemRole(staff.system_role);
}

export function staffNoticeHref(notice: Pick<WorkspaceNotification, "type" | "entity_type" | "entity_id">, workspace: string): string {
  if (notice.type.startsWith("attendance_")) return "/staff/attendance";
  if (workspace === "driver" && notice.entity_type === "booking" && notice.entity_id) return `/staff/driver/trips/${encodeURIComponent(notice.entity_id)}`;
  if (workspace === "driver") return "/staff/driver";
  if (workspace === "utility") return "/staff/utility/work";
  if (workspace === "crm") return notice.entity_type === "booking" && notice.entity_id
    ? `/crm/bookings?bookingId=${encodeURIComponent(notice.entity_id)}` : "/staff/work";
  return notice.entity_type === "booking" ? "/staff/progress" : "/staff/notices";
}

export function safeAttendanceNoticeCopy(notice: Pick<WorkspaceNotification, "type" | "title" | "body">) {
  return ["attendance_clock_out_reminder", "attendance_closing_escalation"].includes(notice.type)
    ? { title: "Attendance needs review", body: "Review your current attendance and work. Clock-out eligibility is checked by the server; this notice does not end your shift." }
    : { title: notice.title, body: notice.body };
}
