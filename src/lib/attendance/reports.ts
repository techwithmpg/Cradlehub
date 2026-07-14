import type {
  AttendanceCorrection,
  AttendanceException,
  AttendanceRecord,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

export const ATTENDANCE_REPORT_NAMES = [
  "Daily Attendance",
  "Exceptions and Corrections",
  "Payroll Export",
] as const;

export type AttendanceReportName = (typeof ATTENDANCE_REPORT_NAMES)[number];

export type AttendanceReportFilters = {
  startDate: string;
  endDate: string;
  staffType: string;
  staffId: string;
};

export type AttendanceReportColumn = { key: string; label: string };
export type AttendanceReportRow = Record<string, string | number>;
export type AttendanceReport = {
  name: AttendanceReportName;
  columns: AttendanceReportColumn[];
  rows: AttendanceReportRow[];
};

function reportColumns(entries: Array<[string, string]>): AttendanceReportColumn[] {
  return entries.map(([key, label]) => ({ key, label }));
}

const AMBIGUOUS_EXCEPTION_TYPES = new Set([
  "conflicting_open_checkin",
  "likely_closing_scan_without_clock_in",
  "missing_schedule",
  "off_day_exception",
  "outside_schedule_window",
  "schedule_state_unsupported",
  "stale_open_checkin",
  "wrong_branch",
]);

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inRange(date: string, filters: AttendanceReportFilters): boolean {
  return date >= filters.startDate && date <= filters.endDate;
}

function staffMatches(params: {
  staffId: string | null;
  staffType?: string | null;
  filters: AttendanceReportFilters;
}): boolean {
  if (params.filters.staffId !== "all" && params.staffId !== params.filters.staffId) return false;
  return params.filters.staffType === "all" || params.staffType === params.filters.staffType;
}

function exceptionsForRecord(record: AttendanceRecord, exceptions: AttendanceException[]): AttendanceException[] {
  return exceptions.filter((exception) =>
    exception.checkin_id === record.id ||
    (exception.staff_id === record.staff_id && exception.detected_at.slice(0, 10) === record.shift_date)
  );
}

function correctionsForRecord(record: AttendanceRecord, corrections: AttendanceCorrection[]): AttendanceCorrection[] {
  return corrections.filter((correction) =>
    correction.checkin_id === record.id ||
    (correction.staff_id === record.staff_id && correction.attendance_date === record.shift_date)
  );
}

function exceptionLabels(exceptions: AttendanceException[]): string {
  return Array.from(new Set(exceptions.map((exception) => humanize(exception.exception_type)))).join("; ");
}

function recordStatus(record: AttendanceRecord, exceptions: AttendanceException[]): string {
  if (exceptions.some((exception) => exception.status === "open")) return "needs_review";
  if (record.status === "checked_in" && !record.checked_out_at) return "clocked_in";
  if (record.status === "checked_out" || record.checked_out_at) return "clocked_out";
  return record.status;
}

function dailyAttendanceReport(
  data: AttendanceWorkspaceData,
  filters: AttendanceReportFilters
): AttendanceReport {
  const rows = data.records
    .filter((record) => inRange(record.shift_date, filters))
    .filter((record) => staffMatches({ staffId: record.staff_id, staffType: record.staff_type, filters }))
    .map((record) => {
      const exceptions = exceptionsForRecord(record, data.exceptions);
      const corrections = correctionsForRecord(record, data.corrections);
      return {
        businessDate: record.shift_date,
        staff: record.staff_name,
        staffType: record.staff_type ?? "Staff",
        scheduledStart: record.scheduled_start_at ?? "",
        scheduledEnd: record.scheduled_end_at ?? "",
        clockIn: record.checked_in_at,
        clockOut: record.checked_out_at ?? "",
        workedMinutes: record.worked_minutes,
        lateMinutes: record.late_minutes,
        earlyLeaveMinutes: record.early_leave_minutes,
        overtimeMinutes: record.overtime_minutes,
        status: recordStatus(record, exceptions),
        exceptionLabels: exceptionLabels(exceptions),
        correctionIndicator: corrections.length > 0 ? "Yes" : "No",
      };
    });

  if (inRange(data.businessDate, filters)) {
    const represented = new Set(
      data.records.filter((record) => record.shift_date === data.businessDate).map((record) => record.staff_id)
    );
    for (const state of data.dailyStaffStates) {
      if (represented.has(state.staffId)) continue;
      if (!staffMatches({ staffId: state.staffId, staffType: state.staffType, filters })) continue;
      rows.push({
        businessDate: state.businessDate,
        staff: state.staffName,
        staffType: state.staffType ?? "Staff",
        scheduledStart: state.scheduledStart ?? "",
        scheduledEnd: state.scheduledEnd ?? "",
        clockIn: "",
        clockOut: "",
        workedMinutes: 0,
        lateMinutes: state.lateMinutes,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        status: state.operationalStatus,
        exceptionLabels: state.issueCodes.map(humanize).join("; "),
        correctionIndicator: "No",
      });
    }
  }

  return {
    name: "Daily Attendance",
    columns: reportColumns([
      ["businessDate", "Business Date"], ["staff", "Staff"], ["staffType", "Staff Type"],
      ["scheduledStart", "Scheduled Start"], ["scheduledEnd", "Scheduled End"],
      ["clockIn", "Clock In"], ["clockOut", "Clock Out"], ["workedMinutes", "Worked Minutes"],
      ["lateMinutes", "Late Minutes"], ["earlyLeaveMinutes", "Early Leave Minutes"],
      ["overtimeMinutes", "Overtime Minutes"], ["status", "Status"],
      ["exceptionLabels", "Exception Labels"], ["correctionIndicator", "Corrected"],
    ]),
    rows: rows.sort((a, b) => String(b.businessDate).localeCompare(String(a.businessDate)) || String(a.staff).localeCompare(String(b.staff))),
  };
}

function exceptionsAndCorrectionsReport(
  data: AttendanceWorkspaceData,
  filters: AttendanceReportFilters
): AttendanceReport {
  const staffTypes = new Map(data.staffOptions.map((staff) => [staff.id, staff.staff_type]));
  const correctionIds = new Set<string>();
  const rows: AttendanceReportRow[] = data.exceptions
    .filter((exception) => inRange(exception.detected_at.slice(0, 10), filters))
    .filter((exception) => staffMatches({
      staffId: exception.staff_id,
      staffType: exception.staff_id ? staffTypes.get(exception.staff_id) : null,
      filters,
    }))
    .map((exception) => {
      const correction = data.corrections.find((item) =>
        item.exception_id === exception.id ||
        (exception.checkin_id && item.checkin_id === exception.checkin_id)
      );
      if (correction) correctionIds.add(correction.id);
      return {
        businessDate: exception.detected_at.slice(0, 10),
        staff: exception.staff_name ?? "Unknown staff",
        exception: humanize(exception.exception_type),
        severity: exception.severity,
        status: exception.status,
        detectedAt: exception.detected_at,
        message: exception.message,
        resolution: exception.resolution_note ?? "",
        resolvedAt: exception.resolved_at ?? "",
        correctedBy: correction?.corrected_by_name ?? exception.resolved_by_name ?? "",
        correctionAction: correction ? humanize(correction.action_type) : "",
        correctionReason: correction?.reason ?? "",
        auditReference: correction?.id ?? exception.id,
      };
    });

  for (const correction of data.corrections) {
    const correctionDate = correction.attendance_date ?? correction.created_at.slice(0, 10);
    if (correctionIds.has(correction.id) || !inRange(correctionDate, filters)) continue;
    if (!staffMatches({
      staffId: correction.staff_id,
      staffType: correction.staff_id ? staffTypes.get(correction.staff_id) : null,
      filters,
    })) continue;
    rows.push({
      businessDate: correctionDate,
      staff: correction.staff_name ?? "Unknown staff",
      exception: "",
      severity: "",
      status: correction.status,
      detectedAt: "",
      message: "",
      resolution: "",
      resolvedAt: correction.corrected_at ?? correction.applied_at ?? "",
      correctedBy: correction.corrected_by_name ?? "",
      correctionAction: humanize(correction.action_type),
      correctionReason: correction.reason,
      auditReference: correction.id,
    });
  }

  return {
    name: "Exceptions and Corrections",
    columns: reportColumns([
      ["businessDate", "Business Date"], ["staff", "Staff"], ["exception", "Exception"],
      ["severity", "Severity"], ["status", "Status"], ["detectedAt", "Detected At"],
      ["message", "Message"], ["resolution", "Resolution"], ["resolvedAt", "Resolved At"],
      ["correctedBy", "Corrected By"], ["correctionAction", "Correction Action"],
      ["correctionReason", "Correction Reason"], ["auditReference", "Audit Reference"],
    ]),
    rows: rows.sort((a, b) => String(b.businessDate).localeCompare(String(a.businessDate))),
  };
}

function payrollExportReport(
  data: AttendanceWorkspaceData,
  filters: AttendanceReportFilters
): AttendanceReport {
  const rows = data.records
    .filter((record) => inRange(record.shift_date, filters))
    .filter((record) => staffMatches({ staffId: record.staff_id, staffType: record.staff_type, filters }))
    .filter((record) => record.status !== "voided")
    .map((record) => {
      const exceptions = exceptionsForRecord(record, data.exceptions);
      const corrections = correctionsForRecord(record, data.corrections);
      const unresolvedAmbiguity = exceptions.some(
        (exception) => exception.status === "open" && AMBIGUOUS_EXCEPTION_TYPES.has(exception.exception_type)
      );
      return {
        businessDate: record.shift_date,
        staff: record.staff_name,
        staffType: record.staff_type ?? "Staff",
        clockIn: record.checked_in_at,
        clockOut: record.checked_out_at ?? "",
        workedMinutes: record.worked_minutes,
        approvedPayableMinutes: unresolvedAmbiguity ? 0 : record.worked_minutes,
        unresolvedAmbiguity: unresolvedAmbiguity ? "Yes" : "No",
        exceptionLabels: exceptionLabels(exceptions),
        correctionIndicator: corrections.length > 0 ? "Yes" : "No",
      };
    });

  return {
    name: "Payroll Export",
    columns: reportColumns([
      ["businessDate", "Business Date"], ["staff", "Staff"], ["staffType", "Staff Type"],
      ["clockIn", "Clock In"], ["clockOut", "Clock Out"], ["workedMinutes", "Worked Minutes"],
      ["approvedPayableMinutes", "Approved Payable Minutes"],
      ["unresolvedAmbiguity", "Unresolved Ambiguity"], ["exceptionLabels", "Exception Labels"],
      ["correctionIndicator", "Corrected"],
    ]),
    rows,
  };
}

export function buildAttendanceReport(params: {
  name: AttendanceReportName;
  data: AttendanceWorkspaceData;
  filters: AttendanceReportFilters;
}): AttendanceReport {
  if (params.name === "Daily Attendance") return dailyAttendanceReport(params.data, params.filters);
  if (params.name === "Exceptions and Corrections") return exceptionsAndCorrectionsReport(params.data, params.filters);
  return payrollExportReport(params.data, params.filters);
}
