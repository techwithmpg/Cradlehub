"use server";

import { createClient } from "@/lib/supabase/server";
import type { WorkspaceNotification } from "./types";
import { logError } from "@/lib/logger";

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
