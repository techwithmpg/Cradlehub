import type { StaffScheduleShiftType } from "@/lib/schedule/resolve-staff-schedule";

export const STAFF_SCHEDULE_CONFLICT_TARGET = "staff_id,day_of_week,shift_type";

export const STAFF_SCHEDULE_RETURNING_COLUMNS =
  "id, staff_id, day_of_week, shift_type, start_time, end_time, is_active";

export type StaffScheduleUpsertRow = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type: StaffScheduleShiftType;
};

export type SavedStaffScheduleRow = StaffScheduleUpsertRow & {
  id: string;
};

export function savedRowsMatchRequest(params: {
  requestedRows: StaffScheduleUpsertRow[];
  savedRows: SavedStaffScheduleRow[] | null | undefined;
}): boolean {
  return (params.savedRows?.length ?? 0) === params.requestedRows.length;
}
