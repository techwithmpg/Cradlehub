"use server";

import { createClient } from "@/lib/supabase/server";
import type { WorkspaceNotification } from "./types";
import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateNotification } from "./workflow-notifications-store";

export async function respondToAttendanceIssueAction(input: { notificationId: string; response: string }): Promise<{ ok: boolean; message: string }> {
  const response = input.response.trim();
  if (!response || response.length > 1000) return { ok: false, message: "Enter a response up to 1,000 characters." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Please sign in again." };
  const notification = await supabase.from("workspace_notifications").select("id, branch_id, recipient_staff_id, entity_id, type").eq("id", input.notificationId).eq("type", "attendance_issue_question").eq("requires_action", true).maybeSingle();
  if (notification.error || !notification.data?.entity_id || !notification.data.recipient_staff_id || !notification.data.branch_id) return { ok: false, message: "This Attendance question is no longer available." };
  const admin = createAdminClient();
  const staff = await admin.from("staff").select("id").eq("id", notification.data.recipient_staff_id).eq("auth_user_id", auth.user.id).maybeSingle();
  if (!staff.data) return { ok: false, message: "This question is assigned to another staff member." };
  const issue = await admin.from("attendance_exceptions").select("id, staff_id, branch_id").eq("id", notification.data.entity_id).eq("staff_id", staff.data.id).eq("branch_id", notification.data.branch_id).eq("status", "open").maybeSingle();
  if (!issue.data) return { ok: false, message: "This Attendance issue is no longer open." };
  const messages = admin.from("attendance_issue_messages" as never) as unknown as { insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
  const inserted = await messages.insert({ exception_id: issue.data.id, branch_id: issue.data.branch_id, staff_id: staff.data.id, sender_staff_id: staff.data.id, sender_workspace: "staff", message: response, response_choices: [] });
  if (inserted.error) return { ok: false, message: "Your response could not be saved." };
  await admin.from("attendance_exceptions").update({ resolution_status: "waiting_for_crm", staff_response_required: false }).eq("id", issue.data.id);
  await admin.from("workspace_notifications").update({ status: "resolved", resolved_at: new Date().toISOString(), requires_action: false }).eq("id", notification.data.id);
  await createOrUpdateNotification({ branchId: issue.data.branch_id, targetWorkspace: "crm", type: "attendance_issue_response", title: "Staff responded to an Attendance issue", body: response, entityType: "attendance_exception", entityId: issue.data.id, actionHref: "/crm/attendance?tab=exceptions", priority: "high", requiresAction: true, dedupeKey: `attendance-response:${issue.data.id}` });
  return { ok: true, message: "Response sent to CRM." };
}

const PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  high:     3,
  normal:   2,
  low:      1,
};

export async function getWorkspaceNotificationsAction(
  limit = 30
): Promise<WorkspaceNotification[]> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("*")
    .in("status", ["unread", "read", "resolved"])
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logError("notification.query_failed", { action: "getWorkspaceNotifications", error });
    return [];
  }
  return (data ?? []) as WorkspaceNotification[];
}

export async function getActionRequiredNotificationsAction(
  limit = 10
): Promise<WorkspaceNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("*")
    .eq("requires_action", true)
    .in("status", ["unread", "read"])
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, limit));
  if (error) {
    logError("notification.query_failed", { action: "getActionRequired", error });
    return [];
  }
  return ((data ?? []) as WorkspaceNotification[])
    .sort((a, b) => {
      const priorityDiff =
        (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}

export async function getRecentNotificationsAction(
  limit = 20
): Promise<WorkspaceNotification[]> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("*")
    .in("status", ["unread", "read", "resolved"])
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logError("notification.query_failed", { action: "getRecentNotifications", error });
    return [];
  }
  return (data ?? []) as WorkspaceNotification[];
}

export async function getUnreadCountAction(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("workspace_notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread");
  if (error) return 0;
  return count ?? 0;
}

export async function getNotificationPopoverAction(
  limit = 8
): Promise<WorkspaceNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("*")
    .eq("status", "unread")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logError("notification.query_failed", { action: "getNotificationPopover", error });
    return [];
  }
  return (data ?? []) as WorkspaceNotification[];
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("workspace_notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "unread");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("workspace_notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("status", "unread");
}

export async function dismissNotificationAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("workspace_notifications")
    .update({ status: "dismissed" })
    .eq("id", id);
}

export async function resolveNotificationAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("workspace_notifications")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
}

// ── Sound trigger: IDs of unread booking notifications requiring action ─────────
// Used by BookingNotificationSound to detect new arrivals without fetching full rows.
export async function getUnreadBookingNotificationIdsAction(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("id")
    .eq("status", "unread")
    .eq("requires_action", true)
    .eq("entity_type", "booking")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((r) => r.id);
}

// ── Owner reads: still use the signed-in client so RLS protects direct calls. ──

export async function getOwnerAllNotificationsAction(
  limit = 50
): Promise<WorkspaceNotification[]> {
  return getWorkspaceNotificationsAction(limit);
}

export async function getOwnerActionRequiredAction(
  limit = 10
): Promise<WorkspaceNotification[]> {
  return getActionRequiredNotificationsAction(limit);
}
