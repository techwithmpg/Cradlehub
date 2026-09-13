import { describe, expect, it } from "vitest";
import { bookingWorkItems, workflowWorkItems, type WorkBooking } from "@/lib/staff-pwa/work-model";
import { noticeMatchesStaff, staffNoticeHref, staffNotificationWorkspace, safeAttendanceNoticeCopy } from "@/lib/staff-pwa/notice-policy";
import type { WorkspaceNotification, WorkflowTask } from "@/lib/notifications/types";
const now = Date.parse("2026-09-13T04:00:00Z");
const booking: WorkBooking = { id: "booking", branch_id: "branch", booking_date: "2026-09-13", start_time: "10:00", status: "confirmed", delivery_type: "in_spa", payment_status: "paid", booking_progress_status: "not_started" };
const staff = { id: "staff", branch_id: "branch", system_role: "crm" };
const notice = { id: "n", branch_id: "branch", target_workspace: "crm", target_role: null, recipient_staff_id: null, status: "unread", resolved_at: null, type: "booking_assigned", entity_type: "booking", entity_id: "booking", created_at: "2026-09-13T02:00:00Z", metadata: {} } as WorkspaceNotification;

describe("CRM Work authority", () => {
  it("uses existing ID and supported operational route for onsite arrival", () => {
    expect(bookingWorkItems([booking], "branch", "crm")).toEqual([expect.objectContaining({ source: "bookings", entityId: "booking", title: "Arrival / check-in pending", href: "/crm/bookings?bookingId=booking" })]);
  });
  it("does not infer onsite arrival for online Home Service", () => {
    expect(bookingWorkItems([{ ...booking, delivery_type: "home_service" }], "branch", "crm")).toEqual([]);
  });
  it.each(["staff", "driver", "utility", "service_staff"])("does not give %s CRM booking capability", role => {
    expect(bookingWorkItems([booking], "branch", role)).toEqual([]);
  });
  it("excludes other branches and concluded records", () => {
    expect(bookingWorkItems([{ ...booking, branch_id: "other" }, { ...booking, status: "completed" }], "branch", "crm")).toEqual([]);
  });
  it("reads own assigned general work without inventing an action", () => {
    const task = { id: "task", branch_id: "branch", assigned_to_staff_id: "staff", status: "open", workspace_scope: "staff", assigned_to_role: null, entity_id: "entity", entity_type: "custom", title: "Review", action_href: "/owner" } as WorkflowTask;
    expect(workflowWorkItems([task], { ...staff, system_role: "staff" })).toEqual([expect.objectContaining({ source: "workflow_tasks", entityId: "entity", href: null })]);
    expect(workflowWorkItems([{ ...task, assigned_to_staff_id: "other" }], staff)).toEqual([]);
    expect(workflowWorkItems([{ ...task, status: "completed" }], staff)).toEqual([]);
  });
});
describe("Cross-role notice authority", () => {
  it.each([
    ["service_staff", "therapist", "staff"], ["staff", "driver", "driver"],
    ["staff", "utility", "utility"], ["csr", "csr", "crm"], ["front_desk", "csr", "staff"], ["staff", null, "staff"],
  ])("maps %s/%s to %s", (system_role, staff_type, workspace) => {
    expect(staffNotificationWorkspace({ system_role: system_role!, staff_type })).toBe(workspace);
  });
  it("allows current branch CRM notices but rejects wrong staff, role and branch", () => {
    expect(noticeMatchesStaff(notice, staff, now)).toBe(true);
    for (const change of [{ branch_id: "other" }, { recipient_staff_id: "other" }, { target_role: "owner" }]) {
      expect(noticeMatchesStaff({ ...notice, ...change }, staff, now)).toBe(false);
    }
  });
  it.each(["driver", "utility", "staff"])("requires explicit recipient for %s", workspace => {
    const recipient = { ...staff, system_role: workspace };
    expect(noticeMatchesStaff({ ...notice, target_workspace: workspace }, recipient, now)).toBe(false);
    expect(noticeMatchesStaff({ ...notice, target_workspace: workspace, recipient_staff_id: "staff" }, recipient, now)).toBe(true);
  });
  it("excludes resolved, dismissed, expired and old notices", () => {
    for (const change of [{ status: "resolved" }, { status: "dismissed" }, { resolved_at: "2026-09-13T03:00:00Z" }, { created_at: "2025-01-01" }, { metadata: { expires_at: "2026-09-13T01:00:00Z" } }]) {
      expect(noticeMatchesStaff({ ...notice, ...change }, staff, now)).toBe(false);
    }
  });
  it("routes Driver and Provider updates to canonical scoped work", () => {
    expect(staffNoticeHref(notice, "driver")).toBe("/staff/driver/trips/booking");
    expect(staffNoticeHref(notice, "staff")).toBe("/staff/progress");
    expect(staffNoticeHref({ ...notice, type: "attendance_clock_out_reminder" }, "driver")).toBe("/staff/attendance");
  });
  it("never tells staff to clock out from stale notification copy", () => {
    expect(safeAttendanceNoticeCopy({ type: "attendance_clock_out_reminder", title: "Clock out now", body: "End shift" })).toMatchObject({ title: "Attendance needs review", body: expect.stringContaining("checked by the server") });
  });
});
