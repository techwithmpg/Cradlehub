"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceNotification } from "./types";

// ── Read helpers (RLS enforced via user client) ────────────────────────────

export async function getWorkspaceNotificationsAction(
  limit = 30
): Promise<WorkspaceNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_notifications")
    .select("*")
    .in("status", ["unread", "read"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[notifications] getWorkspaceNotifications", error.message);
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
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[notifications] getActionRequired", error.message);
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

// ── Mutation helpers ───────────────────────────────────────────────────────

export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("workspace_notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id)
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

// ── Admin-level read (for owner overview — sees all workspaces) ────────────

export async function getOwnerAllNotificationsAction(
  limit = 50
): Promise<WorkspaceNotification[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_notifications")
    .select("*")
    .in("status", ["unread", "read"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[notifications] getOwnerAll", error.message);
    return [];
  }
  return (data ?? []) as WorkspaceNotification[];
}

export async function getOwnerActionRequiredAction(
  limit = 10
): Promise<WorkspaceNotification[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_notifications")
    .select("*")
    .eq("requires_action", true)
    .in("status", ["unread", "read"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as WorkspaceNotification[];
}
