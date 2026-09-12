import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  bookingId: string | null;
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
  queueError: string | null;
};

export async function getUtilityWorkspaceRuntime(
  date?: string
): Promise<UtilityWorkspaceRuntime | null> {
  void date;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select(
      "id, full_name, nickname, avatar_url, branch_id, system_role, staff_type"
    )
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError || !staff) {
    return null;
  }

  if (
    resolveStaffPwaOperationalGroup(
      staff.system_role,
      staff.staff_type
    ) !== "utility"
  ) {
    return null;
  }

  const attendanceData =
    await getPureAttendanceSnapshot(30).catch(() => null);

  if (!staff.branch_id) {
    return {
      staff,
      attendanceData,
      turnoverItems: [],
      queueError: null,
    };
  }

  const admin = createAdminClient();

  // Authoritatively load open and in_progress turnover tasks for the staff's branch
  const { data: tasks, error: tasksError } = await admin
    .from("workflow_tasks")
    .select(
      "id, branch_id, workspace_scope, task_type, entity_type, entity_id, status, metadata, created_at, updated_at, completed_at"
    )
    .eq("workspace_scope", "utility")
    .eq("task_type", "room_turnover")
    .eq("entity_type", "branch_resource")
    .eq("branch_id", staff.branch_id)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: true });

  if (tasksError) {
    return {
      staff,
      attendanceData,
      turnoverItems: [],
      queueError: tasksError.message,
    };
  }

  if (!tasks || tasks.length === 0) {
    return {
      staff,
      attendanceData,
      turnoverItems: [],
      queueError: null,
    };
  }

  // Load branch resources for room names/types
  const resourceIds = [...new Set(tasks.map((t) => t.entity_id))];
  const { data: resources } = await admin
    .from("branch_resources")
    .select("id, name, type")
    .eq("branch_id", staff.branch_id)
    .in("id", resourceIds);

  const resourceMap = new Map((resources ?? []).map((r) => [r.id, r]));

  const turnoverItems: UtilityRoomTurnoverItem[] = tasks.map((task) => {
    const resource = resourceMap.get(task.entity_id);
    const meta =
      task.metadata &&
      typeof task.metadata === "object" &&
      !Array.isArray(task.metadata)
        ? (task.metadata as Record<string, unknown>)
        : {};

    const serviceName =
      typeof meta.service_name === "string" && meta.service_name.trim()
        ? meta.service_name.trim()
        : "Completed service";

    const completedAt =
      typeof meta.completed_at === "string" ? meta.completed_at : null;

    const startedAt =
      typeof meta.started_at === "string" ? meta.started_at : null;

    const bookingId =
      typeof meta.booking_id === "string" ? meta.booking_id : null;

    return {
      taskId: task.id,
      resourceId: task.entity_id,
      roomName:
        resource?.name ??
        (typeof meta.room_name === "string" ? meta.room_name : "Assigned room"),
      resourceType:
        resource?.type ??
        (typeof meta.resource_type === "string" ? meta.resource_type : null),
      serviceName,
      status: task.status as "open" | "in_progress",
      completedAt,
      startedAt,
      createdAt: task.created_at,
      bookingId,
      customerName: null,
    };
  });

  return {
    staff,
    attendanceData,
    turnoverItems,
    queueError: null,
  };
}