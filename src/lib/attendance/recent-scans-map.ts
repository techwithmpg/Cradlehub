import type { RecentAttendanceScan } from "@/lib/attendance/types";

type Relation<T> = T | T[] | null | undefined;

export type RecentScanRow = {
  id: string;
  branch_id: string | null;
  staff_id: string | null;
  action: string;
  created_at: string;
  staff?: Relation<{
    id: string;
    full_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  }>;
  branches?: Relation<{ id: string; name: string | null }>;
  qr_points?: Relation<{ label: string | null }>;
  checkin?: Relation<{
    shift_type: string | null;
    attendance_status: string | null;
    worked_minutes: number | null;
    checked_in_at: string | null;
    checked_out_at: string | null;
  }>;
};

type RecentScanMapContext = {
  branchId?: string | null;
  branchName?: string | null;
};

function first<T>(value: Relation<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapRecentScan(
  row: RecentScanRow,
  context: RecentScanMapContext
): RecentAttendanceScan | null {
  if (!row.staff_id) return null;
  if (row.action !== "clock_in" && row.action !== "clock_out") return null;

  const staff = first(row.staff);
  const branch = first(row.branches);
  const point = first(row.qr_points);
  const checkin = first(row.checkin);

  return {
    eventId: row.id,
    staffId: row.staff_id,
    staffName: staff?.full_name ?? "Staff member",
    staffNickname: staff?.nickname ?? null,
    staffAvatarUrl: staff?.avatar_url ?? null,
    branchId: row.branch_id ?? branch?.id ?? context.branchId ?? null,
    branchName: branch?.name ?? context.branchName ?? null,
    eventType: row.action,
    occurredAt: row.created_at,
    shiftType: checkin?.shift_type ?? null,
    attendanceStatus: checkin?.attendance_status ?? null,
    workedMinutes:
      typeof checkin?.worked_minutes === "number" ? checkin.worked_minutes : null,
    clockInAt: checkin?.checked_in_at ?? null,
    clockOutAt: checkin?.checked_out_at ?? null,
    sourceLabel: point?.label ?? null,
  };
}
