import type {
  AttendanceRecordFilters,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

export type AttendanceSearchParams = Record<string, string | string[] | undefined>;

export function oneAttendanceParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function buildAttendanceRecordFilters(
  params: AttendanceSearchParams,
  data: AttendanceWorkspaceData,
  branchId: string
): {
  filters: AttendanceRecordFilters;
  warning: string | null;
} {
  const requestedStaffId = oneAttendanceParam(params.staffId);
  const requestedBranchId = oneAttendanceParam(params.branchId);
  const requestedDate = oneAttendanceParam(params.date);
  const validStaffIds = new Set([
    ...data.staffOptions.map((staff) => staff.id),
    ...data.records.map((record) => record.staff_id),
  ]);
  const staffId =
    requestedStaffId && validStaffIds.has(requestedStaffId) ? requestedStaffId : null;
  const date = normalizeDate(requestedDate);
  const warnings: string[] = [];

  if (requestedStaffId && !staffId) {
    warnings.push("The selected staff member is not available in this branch.");
  }
  if (requestedDate && !date) {
    warnings.push("The selected attendance date is invalid.");
  }
  if (requestedBranchId && requestedBranchId !== branchId) {
    warnings.push("The selected branch is not available from this workspace.");
  }

  return {
    filters: { staffId, date, branchId },
    warning: warnings[0] ?? null,
  };
}
