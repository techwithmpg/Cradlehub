"use server";
import { revalidatePath } from "next/cache";
import { respondToAttendanceIssueAction } from "@/lib/notifications/queries";
import { loadStaffNotices } from "./notices-runtime";

export async function markStaffNoticeRead(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { db, staff, current } = await loadStaffNotices();
    const notice = current.find(row => row.id === id);
    if (!notice) return { ok: false, error: "Notice is no longer available." };
    if (notice.status === "read") return { ok: true };
    let query = db.from("workspace_notifications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", notice.id).eq("branch_id", staff.branch_id).eq("status", "unread")
      .eq("target_workspace", notice.target_workspace).is("resolved_at", null);
    query = notice.recipient_staff_id ? query.eq("recipient_staff_id", notice.recipient_staff_id) : query.is("recipient_staff_id", null);
    query = notice.target_role ? query.eq("target_role", notice.target_role) : query.is("target_role", null);
    const { data, error } = await query.select("id").maybeSingle();
    if (error || !data) return { ok: false, error: "Notice changed. Refresh and try again." };
    revalidatePath("/staff/notices");
    revalidatePath("/staff/utility/notices");
    return { ok: true };
  } catch { return { ok: false, error: "Notice update unavailable." }; }
}

export async function respondToStaffAttendanceNotice(id: string, response: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { staff, current } = await loadStaffNotices();
    const notice = current.find(row => row.id === id && row.type === "attendance_issue_question" &&
      row.requires_action && row.recipient_staff_id === staff.id);
    if (!notice) return { ok: false, error: "Attendance question is no longer available." };
    const result = await respondToAttendanceIssueAction({ notificationId: notice.id, response });
    if (!result.ok) return { ok: false, error: result.message };
    revalidatePath("/staff/notices");
    revalidatePath("/staff/utility/notices");
    return { ok: true };
  } catch { return { ok: false, error: "Attendance response could not be confirmed." }; }
}
