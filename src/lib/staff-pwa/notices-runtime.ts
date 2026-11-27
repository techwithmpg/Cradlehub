import "server-only";
import {
  getPermittedAssistanceDates,
  parseStageCAssistanceWindow,
  type StageCAssistanceRowCandidate,
} from "@/lib/staff/stage-c-authorization";
import { getStaffPwaContext } from "./staff-context";
import { noticeMatchesStaff, staffNotificationWorkspace, staffNoticeHref, safeAttendanceNoticeCopy } from "./notice-policy";

export type StaffNotice = {
  id: string; title: string; body: string | null; status: string; createdAt: string; href: string; responseRequired: boolean;
};

export async function loadStaffNotices() {
  const { db, staff, group } = await getStaffPwaContext();
  const workspace = staffNotificationWorkspace(staff)!;
  const allowedBranchIds = new Set<string>([staff.branch_id]);
  const allowedDatesByBranch = new Map<string, Set<string>>();
  if (group === "provider" && workspace === "staff") {
    const assistanceDb = db as unknown as {
      from: (table: "staff_assistance_assignments") => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              limit: (n: number) => Promise<{
                data: StageCAssistanceRowCandidate[] | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };
    const assistanceRes = await assistanceDb
      .from("staff_assistance_assignments")
      .select("id, staff_id, receiving_branch_id, assistance_date, start_at, end_at, status")
      .eq("staff_id", staff.id)
      .eq("status", "arrived_clocked_in")
      .limit(50);
    const nowMs = Date.now();
    if (!assistanceRes.error && Array.isArray(assistanceRes.data)) {
      for (const row of assistanceRes.data) {
        const window = parseStageCAssistanceWindow(row, {
          staffId: staff.id,
          allowedStatuses: ["arrived_clocked_in"],
        });
        if (!window) continue;
        if (nowMs < window.effectiveStartMs || nowMs > window.endMs) continue;

        allowedBranchIds.add(window.receivingBranchId);
        const dates = allowedDatesByBranch.get(window.receivingBranchId) ?? new Set<string>();
        for (const permittedDate of getPermittedAssistanceDates(window)) {
          dates.add(permittedDate);
        }
        allowedDatesByBranch.set(window.receivingBranchId, dates);
      }
    }
  }
  const branchIds = [...allowedBranchIds];
  let query = db.from("workspace_notifications").select("*")
    .eq("target_workspace", workspace).in("status", ["unread", "read"])
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .order("created_at", { ascending: false }).limit(100);
  query = branchIds.length === 1 ? query.eq("branch_id", branchIds[0]!) : query.in("branch_id", branchIds);
  query = workspace === "crm" ? query.or(`recipient_staff_id.is.null,recipient_staff_id.eq.${staff.id}`)
    : query.eq("recipient_staff_id", staff.id);
  const { data, error } = await query;
  if (error) throw new Error("Notices unavailable.");
  const scoped = (data ?? []).filter(notice => noticeMatchesStaff(notice, staff, Date.now(), { allowedBranchIds }));
  const bookingIds = [...new Set(scoped.filter(row => row.entity_type === "booking" && row.entity_id).map(row => row.entity_id!))];
  const bookings = bookingIds.length ? await (branchIds.length === 1
    ? db.from("bookings")
        .select("id, branch_id, booking_date, staff_id, driver_id, delivery_type, status, booking_progress_status")
        .eq("branch_id", branchIds[0]!).in("id", bookingIds).limit(100)
    : db.from("bookings")
        .select("id, branch_id, booking_date, staff_id, driver_id, delivery_type, status, booking_progress_status")
        .in("branch_id", branchIds).in("id", bookingIds).limit(100)) : { data: [], error: null };
  if (bookings.error) throw new Error("Current assignment notices unavailable.");
  const bookingMap = new Map((bookings.data ?? []).map(row => [row.id, row]));
  const attendanceIds = scoped.filter(row => row.entity_type === "attendance_record" && row.entity_id).map(row => row.entity_id!);
  const exceptionIds = scoped.filter(row => row.entity_type === "attendance_exception" && row.entity_id).map(row => row.entity_id!);
  const [attendance, exceptions] = await Promise.all([
    attendanceIds.length ? (branchIds.length === 1
      ? db.from("staff_shift_checkins").select("id, staff_id, checked_out_at")
          .eq("branch_id", branchIds[0]!).in("id", attendanceIds).limit(100)
      : db.from("staff_shift_checkins").select("id, staff_id, checked_out_at")
          .in("branch_id", branchIds).in("id", attendanceIds).limit(100)) : Promise.resolve({ data: [], error: null }),
    exceptionIds.length ? (branchIds.length === 1
      ? db.from("attendance_exceptions").select("id, staff_id, status")
          .eq("branch_id", branchIds[0]!).in("id", exceptionIds).limit(100)
      : db.from("attendance_exceptions").select("id, staff_id, status")
          .in("branch_id", branchIds).in("id", exceptionIds).limit(100)) : Promise.resolve({ data: [], error: null }),
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
      if (!booking || !allowedBranchIds.has(booking.branch_id)) return false;
      if (booking.branch_id !== staff.branch_id) {
        const dates = allowedDatesByBranch.get(booking.branch_id);
        if (!booking.booking_date || !dates || !dates.has(booking.booking_date)) return false;
      }
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
