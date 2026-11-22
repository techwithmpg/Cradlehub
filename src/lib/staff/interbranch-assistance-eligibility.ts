import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";
import type { AssistanceVisitType } from "@/lib/staff/interbranch-assistance-contract";

export type AssistanceAssignmentStatus =
  | "approved"
  | "home_clocked_out"
  | "arrived_clocked_in"
  | "completed"
  | "cancelled"
  | "expired"
  | "failed_arrival"
  | "exception";

export type AssistanceAssignmentRow = {
  id: string;
  request_id: string;
  staff_id: string;
  home_branch_id: string;
  receiving_branch_id: string;
  requested_role: string;
  visit_type: AssistanceVisitType;
  start_at: string;
  end_at: string;
  assistance_date: string;
  status: AssistanceAssignmentStatus;
  home_clocked_out_at: string | null;
  receiving_checkin_id: string | null;
  arrived_clocked_in_at: string | null;
  completed_at: string | null;
};

export type ActiveBorrowedStaffEntry = {
  assignment: AssistanceAssignmentRow;
  homeBranchName: string;
  receivingBranchName: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  schedule: ResolvedStaffSchedule;
  staff: {
    id: string;
    full_name: string;
    nickname: string | null;
    tier: string | null;
    staff_type: string | null;
    system_role: string;
    branch_id: string | null;
    is_active: boolean;
    is_head?: boolean | null;
    avatar_url?: string | null;
    archived_at: string | null;
    merged_into_staff_id: string | null;
    metadata: Record<string, unknown> | null;
    staff_services?: { service_id: string }[] | null;
  };
};

type UntypedDb = SupabaseClient;

const MANILA_TIMEZONE = "Asia/Manila";

export function isInterbranchAssistanceEnabled(): boolean {
  return process.env.CRADLEHUB_INTERBRANCH_ASSISTANCE_ENABLED === "true";
}

function manilaParts(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(dt);
  const pick = (type: string) => formatted.find((part) => part.type === type)?.value ?? "00";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    time: `${hour}:${pick("minute")}:${pick("second")}`,
  };
}

export function assistanceAssignmentScheduleForWindow(params: {
  id: string;
  startAt: string;
  endAt: string;
}): {
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  schedule: ResolvedStaffSchedule;
} {
  const startParts = manilaParts(params.startAt);
  const endParts = manilaParts(params.endAt);
  const endsNextDay = endParts.date > startParts.date || endParts.time <= startParts.time;

  return {
    startTime: startParts.time,
    endTime: endParts.time,
    endsNextDay,
    schedule: {
      source: "override",
      status: "resolved",
      state: endsNextDay ? "VALID_OVERNIGHT_SHIFT" : "VALID_SCHEDULE",
      isWorking: true,
      isDayOff: false,
      windows: [
        {
          id: params.id,
          shiftType: "single",
          startTime: startParts.time,
          endTime: endParts.time,
          windowOrder: 1,
          endsNextDay,
        },
      ],
    },
  };
}

function isMissingAssistanceSchema(error: { code?: string | null; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("staff_assistance_assignments"))
  );
}

/**
 * Loads Stage C borrowed staff assignments for a receiving branch and business date.
 * By default returns only `"arrived_clocked_in"` staff (bookable), preserving the
 * rule that provisional approval alone never grants bookability.
 */
export async function getActiveAssistanceAssignmentsForBranchDate(params: {
  branchId: string;
  date: string;
  statuses?: AssistanceAssignmentStatus[];
  supabase?: UntypedDb;
}): Promise<ActiveBorrowedStaffEntry[]> {
  const statuses = params.statuses ?? ["arrived_clocked_in"];
  if (statuses.length === 0) return [];

  const db = (params.supabase ?? createAdminClient()) as unknown as UntypedDb;
  const { data, error } = await db
    .from("staff_assistance_assignments")
    .select(
      `id, request_id, staff_id, home_branch_id, receiving_branch_id, requested_role,
       visit_type, start_at, end_at, assistance_date, status,
       home_clocked_out_at, receiving_checkin_id, arrived_clocked_in_at, completed_at`
    )
    .eq("receiving_branch_id", params.branchId)
    .eq("assistance_date", params.date)
    .in("status", statuses)
    .order("start_at", { ascending: true });

  if (error) {
    if (isMissingAssistanceSchema(error)) return [];
    throw new Error(`Could not load inter-branch assistance assignments: ${error.message}`);
  }

  const rows = (data ?? []) as AssistanceAssignmentRow[];
  if (rows.length === 0) return [];

  const staffIds = [...new Set(rows.map((row) => row.staff_id))];
  const branchIds = [
    ...new Set(rows.flatMap((row) => [row.home_branch_id, row.receiving_branch_id])),
  ];

  const [staffRes, branchesRes] = await Promise.all([
    db
      .from("staff")
      .select(
        "id, full_name, nickname, tier, staff_type, system_role, is_head, branch_id, is_active, avatar_url, archived_at, merged_into_staff_id, metadata, staff_services(service_id)"
      )
      .in("id", staffIds)
      .eq("is_active", true)
      .is("archived_at", null)
      .is("merged_into_staff_id", null),
    db.from("branches").select("id, name").in("id", branchIds),
  ]);

  if (staffRes.error) {
    throw new Error(`Could not load borrowed staff profiles: ${staffRes.error.message}`);
  }

  const staffMap = new Map(
    ((staffRes.data ?? []) as ActiveBorrowedStaffEntry["staff"][]).map((member) => [
      member.id,
      member,
    ])
  );
  const branchMap = new Map(
    ((branchesRes.data ?? []) as Array<{ id: string; name: string | null }>).map((b) => [
      b.id,
      b.name ?? "Branch",
    ])
  );

  const entries: ActiveBorrowedStaffEntry[] = [];
  for (const row of rows) {
    const staff = staffMap.get(row.staff_id);
    if (!staff) continue;
    const windowInfo = assistanceAssignmentScheduleForWindow({
      id: row.id,
      startAt: row.start_at,
      endAt: row.end_at,
    });
    entries.push({
      assignment: row,
      homeBranchName: branchMap.get(row.home_branch_id) ?? "Main Branch",
      receivingBranchName: branchMap.get(row.receiving_branch_id) ?? "Receiving Branch",
      ...windowInfo,
      staff,
    });
  }

  return entries;
}

export async function getActiveAssistanceAssignmentForStaffAtBranch(params: {
  staffId: string;
  branchId: string;
  date: string;
  statuses?: AssistanceAssignmentStatus[];
  supabase?: UntypedDb;
}): Promise<ActiveBorrowedStaffEntry | null> {
  const entries = await getActiveAssistanceAssignmentsForBranchDate({
    branchId: params.branchId,
    date: params.date,
    statuses: params.statuses,
    supabase: params.supabase,
  });
  return entries.find((entry) => entry.staff.id === params.staffId) ?? null;
}

export async function getActiveAssistanceAssignmentForQrScan(params: {
  staffId: string;
  qrBranchId: string;
  nowIso?: string;
  supabase?: UntypedDb;
}): Promise<AssistanceAssignmentRow | null> {
  const db = (params.supabase ?? createAdminClient()) as unknown as UntypedDb;
  const { data, error } = await db
    .from("staff_assistance_assignments")
    .select(
      `id, request_id, staff_id, home_branch_id, receiving_branch_id, requested_role,
       visit_type, start_at, end_at, assistance_date, status,
       home_clocked_out_at, receiving_checkin_id, arrived_clocked_in_at, completed_at`
    )
    .eq("staff_id", params.staffId)
    .eq("receiving_branch_id", params.qrBranchId)
    .in("status", ["approved", "home_clocked_out", "arrived_clocked_in"])
    .order("start_at", { ascending: true });

  if (error) {
    if (isMissingAssistanceSchema(error)) return null;
    throw new Error(`Could not resolve QR assistance window: ${error.message}`);
  }

  const nowMs = Date.parse(params.nowIso ?? new Date().toISOString());
  const rows = (data ?? []) as AssistanceAssignmentRow[];
  return (
    rows.find((row) => {
      if (row.status === "arrived_clocked_in") return true;
      const startMs = Date.parse(row.start_at);
      const endMs = Date.parse(row.end_at);
      return Number.isFinite(startMs) && Number.isFinite(endMs)
        ? nowMs >= startMs - 120 * 60_000 && nowMs <= endMs
        : false;
    }) ?? null
  );
}

/**
 * Transitions Stage C per-staff assistance status after an Attendance QR commit:
 * - Receiving-branch clock_in: `approved | home_clocked_out` -> `arrived_clocked_in` (bookable!)
 * - Receiving-branch clock_out: `arrived_clocked_in` -> `completed`
 * - Home-branch clock_out: today's/upcoming `approved` -> `home_clocked_out`
 */
export async function syncAssistanceAssignmentsOnScan(params: {
  staffId: string;
  scannedBranchId: string;
  action: "clock_in" | "clock_out";
  checkinId?: string | null;
  isTest: boolean;
  staffName: string;
  receivingBranchName: string;
  nowIso?: string;
  supabase?: UntypedDb;
}): Promise<void> {
  if (params.isTest) return;
  const db = (params.supabase ?? createAdminClient()) as unknown as UntypedDb;
  const nowIso = params.nowIso ?? new Date().toISOString();

  try {
    if (params.action === "clock_in") {
      const assignment = await getActiveAssistanceAssignmentForQrScan({
        staffId: params.staffId,
        qrBranchId: params.scannedBranchId,
        nowIso,
        supabase: db,
      });
      if (!assignment || assignment.status === "arrived_clocked_in") return;

      const { error } = await db
        .from("staff_assistance_assignments")
        .update({
          status: "arrived_clocked_in",
          arrived_clocked_in_at: nowIso,
          receiving_checkin_id: params.checkinId ?? null,
        })
        .eq("id", assignment.id)
        .in("status", ["approved", "home_clocked_out"]);

      if (!error) {
        const windowInfo = assistanceAssignmentScheduleForWindow({
          id: assignment.id,
          startAt: assignment.start_at,
          endAt: assignment.end_at,
        });
        await createNotification({
          branchId: assignment.receiving_branch_id,
          targetWorkspace: "crm",
          type: "interbranch_assistance_approved",
          title: `${params.staffName} arrived for branch assistance`,
          body: `${params.staffName} clocked in at ${params.receivingBranchName} and is now bookable (${windowInfo.startTime.slice(0, 5)}–${windowInfo.endTime.slice(0, 5)}).`,
          entityType: "staff_assistance_request",
          entityId: assignment.request_id,
          actionHref: "/crm/schedule?tab=assistance",
          priority: "high",
          dedupeKey: `assistance:${assignment.id}:arrived`,
        });
      }
      return;
    }

    // clock_out path: either completing receiving-branch duty or leaving home branch
    const { data: activeReceiving } = await db
      .from("staff_assistance_assignments")
      .select("id")
      .eq("staff_id", params.staffId)
      .eq("receiving_branch_id", params.scannedBranchId)
      .eq("status", "arrived_clocked_in");

    if ((activeReceiving ?? []).length > 0) {
      await db
        .from("staff_assistance_assignments")
        .update({
          status: "completed",
          completed_at: nowIso,
        })
        .eq("staff_id", params.staffId)
        .eq("receiving_branch_id", params.scannedBranchId)
        .eq("status", "arrived_clocked_in");
      return;
    }

    await db
      .from("staff_assistance_assignments")
      .update({
        status: "home_clocked_out",
        home_clocked_out_at: nowIso,
      })
      .eq("staff_id", params.staffId)
      .eq("home_branch_id", params.scannedBranchId)
      .eq("status", "approved")
      .gte("end_at", nowIso);
  } catch {
    // Lifecycle sync errors must never reverse a committed QR attendance scan.
  }
}
