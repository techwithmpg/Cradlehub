import "server-only";
import { getStaffPwaContext } from "./staff-context";
import { noticeMatchesStaff, staffNotificationWorkspace, staffNoticeHref, safeAttendanceNoticeCopy } from "./notice-policy";

export type StaffNotice = {
  id: string; title: string; body: string | null; status: string; createdAt: string; href: string; responseRequired: boolean;
};

export async function loadStaffNotices() {
  const { db, staff, group } = await getStaffPwaContext();
  const workspace = staffNotificationWorkspace(staff)!;
  let query = db.from("workspace_notifications").select("*").eq("branch_id", staff.branch_id)
    .eq("target_workspace", workspace).in("status", ["unread", "read"])
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .order("created_at", { ascending: false }).limit(100);
  query = workspace === "crm" ? query.or(`recipient_staff_id.is.null,recipient_staff_id.eq.${staff.id}`)
    : query.eq("recipient_staff_id", staff.id);
  const { data, error } = await query;
  if (error) throw new Error("Notices unavailable.");
  const scoped = (data ?? []).filter(notice => noticeMatchesStaff(notice, staff));
  const bookingIds = [...new Set(scoped.filter(row => row.entity_type === "booking" && row.entity_id).map(row => row.entity_id!))];
  const bookings = bookingIds.length ? await db.from("bookings")
    .select("id, branch_id, staff_id, driver_id, delivery_type, status, booking_progress_status")
    .eq("branch_id", staff.branch_id).in("id", bookingIds).limit(100) : { data: [], error: null };
  if (bookings.error) throw new Error("Current assignment notices unavailable.");
  const bookingMap = new Map((bookings.data ?? []).map(row => [row.id, row]));
  const attendanceIds = scoped.filter(row => row.entity_type === "attendance_record" && row.entity_id).map(row => row.entity_id!);
  const exceptionIds = scoped.filter(row => row.entity_type === "attendance_exception" && row.entity_id).map(row => row.entity_id!);
  const [attendance, exceptions] = await Promise.all([
    attendanceIds.length ? db.from("staff_shift_checkins").select("id, staff_id, checked_out_at")
      .eq("branch_id", staff.branch_id).in("id", attendanceIds).limit(100) : Promise.resolve({ data: [], error: null }),
    exceptionIds.length ? db.from("attendance_exceptions").select("id, staff_id, status")
      .eq("branch_id", staff.branch_id).in("id", exceptionIds).limit(100) : Promise.resolve({ data: [], error: null }),
  ]);
  if (attendance.error || exceptions.error) throw new Error("Attendance notices unavailable.");
  const attendanceMap = new Map((attendance.data ?? []).map(row => [row.id, row]));
  const exceptionMap = new Map((exceptions.data ?? []).map(row => [row.id, row]));
  const seen = new Set<string>();
  const current = scoped.filter(notice => {
    if (notice.entity_type === "attendance_record") {
      const row = attendanceMap.get(notice.entity_id ?? "");
      if (!row || (workspace !== "crm" && row.staff_id !== staff.id) || row.checked_out_at) return false;
    }
    if (notice.entity_type === "attendance_exception") {
      const row = exceptionMap.get(notice.entity_id ?? "");
      if (!row || (workspace !== "crm" && row.staff_id !== staff.id) || row.status !== "open") return false;
    }
    if (notice.entity_type === "booking") {
      const booking = bookingMap.get(notice.entity_id ?? "");
      if (!booking || booking.branch_id !== staff.branch_id) return false;
      if (group === "driver" && (booking.driver_id !== staff.id || booking.delivery_type !== "home_service")) return false;
      if (group === "provider" && booking.staff_id !== staff.id) return false;
      if (group === "utility" || (group === "crm_general" && workspace !== "crm")) return false;
      if (notice.requires_action && (["completed", "cancelled", "no_show"].includes(booking.status) || booking.booking_progress_status === "completed")) return false;
      if (["payment_pending", "payment_overdue"].includes(notice.type)) return false; // CRM Work reads current payment authority.
    }
    const key = notice.dedupe_key ?? notice.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { db, staff, current, items: current.map((notice): StaffNotice => ({
    id: notice.id, ...safeAttendanceNoticeCopy(notice), status: notice.status, createdAt: notice.created_at,
    href: staffNoticeHref(notice, workspace),
    responseRequired: notice.type === "attendance_issue_question" && notice.requires_action && notice.recipient_staff_id === staff.id,
  })) };
}

export async function getStaffNotices(): Promise<{ items: StaffNotice[]; error: string | null }> {
  try {
    const { items } = await loadStaffNotices();
    return { items, error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : "Notices unavailable." };
  }
}
