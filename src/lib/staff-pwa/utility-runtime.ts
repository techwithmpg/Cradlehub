import "server-only";

import { createClient } from "@/lib/supabase/server";
import { attachBranchResources } from "@/lib/queries/booking-resources";
import { getMyAttendanceData } from "@/lib/staff-portal/attendance";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";

export type UtilityRoomTurnoverItem = {
  bookingId: string;
  resourceId: string;
  roomName: string;
  resourceType: string | null;
  serviceName: string;
  completedAt: string | null;
  startTime: string | null;
  customerName: string | null;
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
  attendanceData: Awaited<ReturnType<typeof getMyAttendanceData>> | null;
  turnoverItems: UtilityRoomTurnoverItem[];
  queueError: string | null;
};

function firstRelation<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getUtilityWorkspaceRuntime(
  date: string
): Promise<UtilityWorkspaceRuntime | null> {
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
    await getMyAttendanceData(30).catch(() => null);

  const queue = await supabase
    .from("bookings")
    .select(`
      id,
      booking_date,
      start_time,
      completed_at,
      session_completed_at,
      resource_id,
      type,
      status,
      booking_progress_status,
      services (
        id,
        name
      ),
      customers (
        id,
        full_name
      )
    `)
    .eq("branch_id", staff.branch_id)
    .eq("booking_date", date)
    .neq("status", "cancelled")
    .not("resource_id", "is", null)
    .order("start_time");

  if (queue.error) {
    return {
      staff,
      attendanceData,
      turnoverItems: [],
      queueError: queue.error.message,
    };
  }

  const completedRows = (queue.data ?? []).filter((row) => {
    const serviceFinished =
      row.booking_progress_status === "completed" ||
      row.status === "completed" ||
      Boolean(row.completed_at) ||
      Boolean(row.session_completed_at);

    const onsite =
      row.type !== "home_service";

    return serviceFinished && onsite && Boolean(row.resource_id);
  });

  let withResources;

  try {
    withResources = await attachBranchResources(
      supabase,
      completedRows
    );
  } catch (error) {
    return {
      staff,
      attendanceData,
      turnoverItems: [],
      queueError:
        error instanceof Error
          ? error.message
          : "Room information could not be loaded.",
    };
  }

  const turnoverItems: UtilityRoomTurnoverItem[] =
    withResources
      .filter(
        (row) =>
          Boolean(row.resource_id) &&
          Boolean(row.branch_resources)
      )
      .map((row) => {
        const service =
          firstRelation(row.services);

        const customer =
          firstRelation(row.customers);

        return {
          bookingId: row.id,
          resourceId: row.resource_id!,
          roomName:
            row.branch_resources?.name ??
            "Assigned room",
          resourceType:
            row.branch_resources?.type ?? null,
          serviceName:
            service?.name ?? "Completed service",
          completedAt:
            row.session_completed_at ??
            row.completed_at ??
            null,
          startTime:
            row.start_time ?? null,
          customerName:
            customer?.full_name ?? null,
        };
      });

  return {
    staff,
    attendanceData,
    turnoverItems,
    queueError: null,
  };
}