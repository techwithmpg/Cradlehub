import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getMyStaffRecord } from "@/app/(dashboard)/staff-portal/actions";
import { getPureAttendanceSnapshot, type StaffAttendanceData } from "@/lib/staff-portal/attendance";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";

export type UtilityRoomTurnoverItem = {
  taskId: string;
  resourceId: string;
  roomName: string;
  resourceType: string | null;
  serviceName: string;
  status: "open" | "in_progress" | "completed";
  completedAt: string | null;
  startedAt: string | null;
  createdAt: string;
  assignedToStaffId: string | null;
  customerName?: null;
};

export type UtilityWorkspaceRuntime = {
  staff: {
    id: string;
    full_name: string;
    nickname: string | null;
    avatar_url: string | null;
    branch_id: string | null;
    system_role: string | null;
    staff_type: string | null;
  };
  attendanceData: StaffAttendanceData | null;
  turnoverItems: UtilityRoomTurnoverItem[];
  recentCompletedItems: UtilityRoomTurnoverItem[];
  queueError: string | null;
  historyError: string | null;
};

export async function getUtilityStaffIdentity(): Promise<UtilityWorkspaceRuntime["staff"] | null> {
  const me = await getMyStaffRecord();
  if (!me) return null;
  if (resolveStaffPwaOperationalGroup(me.system_role, me.staff_type) !== "utility") {
    return null;
  }
  return {
    id: me.id,
    full_name: me.full_name,
    nickname: me.nickname,
    avatar_url: me.avatar_url ?? null,
    branch_id: me.branch_id,
    system_role: me.system_role,
    staff_type: me.staff_type,
  };
}

export async function getUtilityWorkspaceRuntime({
  includeAttendance = false,
}: { includeAttendance?: boolean } = {}): Promise<UtilityWorkspaceRuntime | null> {
  const me = await getMyStaffRecord();
  if (!me) return null;
  if (resolveStaffPwaOperationalGroup(me.system_role, me.staff_type) !== "utility") {
    return null;
  }
  const staff: UtilityWorkspaceRuntime["staff"] = {
    id: me.id,
    full_name: me.full_name,
    nickname: me.nickname,
    avatar_url: me.avatar_url ?? null,
    branch_id: me.branch_id,
    system_role: me.system_role,
    staff_type: me.staff_type,
  };

  if (!staff.branch_id) {
    return {
      staff,
      attendanceData: null,
      turnoverItems: [],
      recentCompletedItems: [],
      queueError: "Utility branch is not assigned.",
      historyError: "Utility branch is not assigned.",
    };
  }

  const admin = createAdminClient();

  const taskColumns =
    "id, branch_id, workspace_scope, task_type, entity_type, entity_id, status, assigned_to_staff_id, metadata, created_at, completed_at";
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // Both reads are branch-scoped. Completed tasks are bounded and only used for recent history.
  const [attendanceData, activeResult, completedResult] = await Promise.all([
    includeAttendance && staff.branch_id ? getPureAttendanceSnapshot(30, me).catch(() => null) : Promise.resolve(null),
    admin
      .from("workflow_tasks")
      .select(taskColumns)
      .eq("workspace_scope", "utility")
      .eq("task_type", "room_turnover")
      .eq("entity_type", "branch_resource")
      .eq("branch_id", staff.branch_id)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: true }),
    admin
      .from("workflow_tasks")
      .select(taskColumns)
      .eq("workspace_scope", "utility")
      .eq("task_type", "room_turnover")
      .eq("entity_type", "branch_resource")
      .eq("branch_id", staff.branch_id)
      .eq("status", "completed")
      .gte("completed_at", recentCutoff)
      .order("completed_at", { ascending: false })
      .limit(30),
  ]);

  const tasks = activeResult.error
    ? []
    : (activeResult.data ?? []).filter(
        (task) => task.status === "open" || task.status === "in_progress"
      );
  const completedTasks = completedResult.error
    ? []
    : (completedResult.data ?? []).filter((task) => task.status === "completed");

  // Load branch resources for room names/types
  const resourceIds = [...new Set([...tasks, ...completedTasks].map((t) => t.entity_id))];
  const { data: resources } = resourceIds.length
    ? await admin
        .from("branch_resources")
        .select("id, name, type")
        .eq("branch_id", staff.branch_id)
        .in("id", resourceIds)
    : { data: [] };

  const resourceMap = new Map((resources ?? []).map((r) => [r.id, r]));

  const toItem = (task: (typeof tasks)[number]): UtilityRoomTurnoverItem => {
    const resource = resourceMap.get(task.entity_id);
    const meta =
      task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
        ? (task.metadata as Record<string, unknown>)
        : {};

    const serviceName =
      typeof meta.service_name === "string" && meta.service_name.trim()
        ? meta.service_name.trim()
        : "Completed service";

    const completedAt = typeof meta.completed_at === "string" ? meta.completed_at : null;

    const startedAt = typeof meta.started_at === "string" ? meta.started_at : null;

    return {
      taskId: task.id,
      resourceId: task.entity_id,
      roomName:
        resource?.name ?? (typeof meta.room_name === "string" ? meta.room_name : "Assigned room"),
      resourceType:
        resource?.type ?? (typeof meta.resource_type === "string" ? meta.resource_type : null),
      serviceName,
      status: task.status as UtilityRoomTurnoverItem["status"],
      completedAt: task.completed_at ?? completedAt,
      startedAt,
      createdAt: task.created_at,
      assignedToStaffId: task.assigned_to_staff_id,
      customerName: null,
    };
  };

  return {
    staff,
    attendanceData,
    turnoverItems: tasks.map(toItem),
    recentCompletedItems: completedTasks.map(toItem),
    queueError: activeResult.error?.message ?? null,
    historyError: completedResult.error?.message ?? null,
  };
}
