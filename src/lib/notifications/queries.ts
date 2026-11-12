"use server";

import { createClient } from "@/lib/supabase/server";
import type { NotificationBellSnapshot, WorkspaceNotification } from "./types";
import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateNotification } from "./workflow-notifications-store";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { staffNotificationWorkspace } from "@/lib/staff-pwa/notice-policy";
import { canonicalizeSystemRole } from "@/constants/staff";

type ViewerNotificationScope = {
  targetWorkspace: "owner" | "crm" | "staff" | "driver" | "utility";
  staffId: string | null;
  branchId: string | null;
  systemRole: string;
};

async function resolveViewerNotificationScope(
  ownerOnly = false
): Promise<ViewerNotificationScope | null> {
  const ctx = await getLayoutStaffContext();
  if (!ctx?.me) return null;
  const role = ctx.me.system_role;
  const canonicalRole = canonicalizeSystemRole(role);
  if (ownerOnly || canonicalRole === "owner") {
    return {
      targetWorkspace: "owner",
      staffId: ctx.me.id,
      branchId: ctx.me.branch_id,
      systemRole: "owner",
    };
  }
  if (canonicalRole === "manager" || canonicalRole === "crm") {
    return {
      targetWorkspace: "crm",
      staffId: ctx.me.id,
      branchId: ctx.me.branch_id,
      systemRole: canonicalRole,
    };
  }
  const mappedWorkspace = staffNotificationWorkspace({
    system_role: role,
    staff_type: ctx.me.staff_type,
  });
  return {
    targetWorkspace: (mappedWorkspace as ViewerNotificationScope["targetWorkspace"]) || "staff",
    staffId: ctx.me.id,
    branchId: ctx.me.branch_id,
    systemRole: canonicalRole,
  };
}

function filterNotificationsForViewer(
  rows: WorkspaceNotification[],
  scope: ViewerNotificationScope | null
): WorkspaceNotification[] {
  if (!scope) return rows;
  return rows.filter((row) => {
    if (row.target_workspace !== scope.targetWorkspace) return false;
    if (scope.targetWorkspace !== "owner" && scope.branchId && row.branch_id && row.branch_id !== scope.branchId) {
      return false;
    }
    // Personal roles (therapist/staff, driver, utility): only show notifications addressed to them (or branch-wide driver/utility broadcasts)
    if (scope.targetWorkspace === "staff") {
      if (row.recipient_staff_id && scope.staffId && row.recipient_staff_id !== scope.staffId) {
        return false;
      }
      if (!row.recipient_staff_id && scope.staffId) {
        return false;
      }
    } else if (scope.targetWorkspace === "driver" || scope.targetWorkspace === "utility") {
      if (row.recipient_staff_id && scope.staffId && row.recipient_staff_id !== scope.staffId) {
        return false;
      }
    }
    return true;
  });
}

export async function respondToAttendanceIssueAction(input: {
  notificationId: string;
  response: string;
}): Promise<{ ok: boolean; message: string }> {
  const response = input.response.trim();
  if (!response || response.length > 1000)
    return { ok: false, message: "Enter a response up to 1,000 characters." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Please sign in again." };
  const notification = await supabase
    .from("workspace_notifications")
    .select("id, branch_id, recipient_staff_id, entity_id, type")
    .eq("id", input.notificationId)
    .eq("type", "attendance_issue_question")
    .eq("requires_action", true)
    .maybeSingle();
  if (
    notification.error ||
    !notification.data?.entity_id ||
    !notification.data.recipient_staff_id ||
    !notification.data.branch_id
  )
    return { ok: false, message: "This Attendance question is no longer available." };
  const admin = createAdminClient();
  const staff = await admin
    .from("staff")
    .select("id")
    .eq("id", notification.data.recipient_staff_id)
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (!staff.data)
    return { ok: false, message: "This question is assigned to another staff member." };
  const issue = await admin
    .from("attendance_exceptions")
    .select("id, staff_id, branch_id")
    .eq("id", notification.data.entity_id)
    .eq("staff_id", staff.data.id)
    .eq("branch_id", notification.data.branch_id)
    .eq("status", "open")
    .maybeSingle();
  if (!issue.data) return { ok: false, message: "This Attendance issue is no longer open." };
  const messages = admin.from("attendance_issue_messages" as never) as unknown as {
    insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  const inserted = await messages.insert({
    exception_id: issue.data.id,
    branch_id: issue.data.branch_id,
    staff_id: staff.data.id,
    sender_staff_id: staff.data.id,
    sender_workspace: "staff",
    message: response,
    response_choices: [],
  });
  if (inserted.error) return { ok: false, message: "Your response could not be saved." };
  await admin
    .from("attendance_exceptions")
    .update({ resolution_status: "waiting_for_crm", staff_response_required: false })
    .eq("id", issue.data.id);
  await admin
    .from("workspace_notifications")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), requires_action: false })
    .eq("id", notification.data.id);
  await createOrUpdateNotification({
    branchId: issue.data.branch_id,
    targetWorkspace: "crm",
    type: "attendance_issue_response",
    title: "Staff responded to an Attendance issue",
    body: response,
    entityType: "attendance_exception",
    entityId: issue.data.id,
    actionHref: "/crm/attendance?tab=exceptions",
    priority: "high",
    requiresAction: true,
    dedupeKey: `attendance-response:${issue.data.id}`,
  });
  return { ok: true, message: "Response sent to CRM." };
}

const PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export async function getWorkspaceNotificationsAction(
  limit = 30
): Promise<WorkspaceNotification[]> {
  const [supabase, scope] = await Promise.all([
    createClient(),
    resolveViewerNotificationScope(false),
  ]);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("workspace_notifications")
    .select("*")
    .in("status", ["unread", "read", "resolved"])
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  if (scope) {
    query = query.eq("target_workspace", scope.targetWorkspace);
    if (scope.targetWorkspace === "staff" && scope.staffId) {
      query = query.eq("recipient_staff_id", scope.staffId);
    }
  }

  const { data, error } = await query;
  if (error) {
    logError("notification.query_failed", { action: "getWorkspaceNotifications", error });
    return [];
  }
  return filterNotificationsForViewer((data ?? []) as WorkspaceNotification[], scope).slice(0, limit);
}

export async function getActionRequiredNotificationsAction(
  limit = 10
): Promise<WorkspaceNotification[]> {
  const [supabase, scope] = await Promise.all([
    createClient(),
    resolveViewerNotificationScope(false),
  ]);
  let query = supabase
    .from("workspace_notifications")
    .select("*")
    .eq("requires_action", true)
    .in("status", ["unread", "read"])
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, limit));

  if (scope) {
    query = query.eq("target_workspace", scope.targetWorkspace);
    if (scope.targetWorkspace === "staff" && scope.staffId) {
      query = query.eq("recipient_staff_id", scope.staffId);
    }
  }

  const { data, error } = await query;
  if (error) {
    logError("notification.query_failed", { action: "getActionRequired", error });
    return [];
  }
  return filterNotificationsForViewer((data ?? []) as WorkspaceNotification[], scope)
    .sort((a, b) => {
      const priorityDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}

export async function getRecentNotificationsAction(limit = 20): Promise<WorkspaceNotification[]> {
  return getWorkspaceNotificationsAction(limit);
}

export async function getUnreadCountAction(): Promise<number> {
  const snapshot = await getNotificationBellSnapshot(20, false);
  return snapshot.unreadCount;
}

export async function getNotificationBellSnapshot(
  limit = 20,
  ownerOnly = false
): Promise<NotificationBellSnapshot> {
  const [supabase, scope] = await Promise.all([
    createClient(),
    resolveViewerNotificationScope(ownerOnly),
  ]);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const targetWs = ownerOnly ? "owner" : (scope?.targetWorkspace ?? "crm");

  let itemsQuery = supabase
    .from("workspace_notifications")
    .select("*")
    .eq("target_workspace", targetWs)
    .in("status", ["unread", "read"])
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(safeLimit * 2);

  let countQuery = supabase
    .from("workspace_notifications")
    .select("id", { count: "exact", head: true })
    .eq("target_workspace", targetWs)
    .eq("status", "unread");

  if (targetWs === "staff" && scope?.staffId) {
    itemsQuery = itemsQuery.eq("recipient_staff_id", scope.staffId);
    countQuery = countQuery.eq("recipient_staff_id", scope.staffId);
  }

  const [itemsResult, countResult] = await Promise.all([itemsQuery, countQuery]);
  if (itemsResult.error || countResult.error) {
    logError("notification.query_failed", {
      action: "getNotificationBellSnapshot",
      error: itemsResult.error ?? countResult.error,
    });
    return { items: [], unreadCount: 0 };
  }

  const filteredItems = filterNotificationsForViewer(
    (itemsResult.data ?? []) as WorkspaceNotification[],
    scope
  ).slice(0, safeLimit);

  return {
    items: filteredItems,
    unreadCount: countResult.count ?? filteredItems.filter((i) => i.status === "unread").length,
  };
}

export async function getNotificationPopoverAction(limit = 8): Promise<WorkspaceNotification[]> {
  const snapshot = await getNotificationBellSnapshot(limit, false);
  return snapshot.items.filter((item) => item.status === "unread").slice(0, limit);
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("workspace_notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "unread");
}

export async function markAllNotificationsReadAction(ownerOnly = false): Promise<void> {
  const [supabase, scope] = await Promise.all([
    createClient(),
    resolveViewerNotificationScope(ownerOnly),
  ]);
  const targetWs = ownerOnly ? "owner" : (scope?.targetWorkspace ?? "crm");

  // Mark unread notifications in this role's workspace as read so the badge clears immediately,
  // while preserving requires_action = true so items stay in Action Required until resolved!
  let query = supabase
    .from("workspace_notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("status", "unread")
    .eq("target_workspace", targetWs);

  if (targetWs === "staff" && scope?.staffId) {
    query = query.eq("recipient_staff_id", scope.staffId);
  }

  const { error } = await query;
  if (error) throw new Error("Could not mark notifications as read.");
}

export async function dismissNotificationAction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_notifications")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("requires_action", false)
    .in("status", ["unread", "read"]);
  if (error) throw new Error("Notification could not be dismissed.");
}

export async function resolveNotificationAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("workspace_notifications")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
}

export async function getUnreadBookingNotificationIdsAction(): Promise<string[]> {
  const [supabase, scope] = await Promise.all([
    createClient(),
    resolveViewerNotificationScope(false),
  ]);
  const targetWs = scope?.targetWorkspace ?? "crm";
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("id")
    .eq("target_workspace", targetWs)
    .eq("status", "unread")
    .eq("requires_action", true)
    .eq("entity_type", "booking")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((r) => r.id);
}

export async function getOwnerAllNotificationsAction(limit = 50): Promise<WorkspaceNotification[]> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("*")
    .eq("target_workspace", "owner")
    .in("status", ["unread", "read", "resolved"])
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as WorkspaceNotification[];
}

export async function getOwnerActionRequiredAction(limit = 10): Promise<WorkspaceNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("*")
    .eq("target_workspace", "owner")
    .eq("requires_action", true)
    .in("status", ["unread", "read"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as WorkspaceNotification[];
}

