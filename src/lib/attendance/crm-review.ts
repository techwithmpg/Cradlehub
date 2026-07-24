import {
  recurrenceLevel,
  resolveAttendanceDiagnostic,
  type AttendanceDiagnostic,
} from "@/lib/attendance/diagnostic-catalog";
import type { AttendanceException } from "@/lib/attendance/types";
import type {
  AttendanceStaffDiagnostic,
  AttendanceStaffStatus,
} from "@/lib/attendance/staff-diagnostics";
import {
  effectiveAttendanceExceptionType,
  isActionableAttendanceException,
} from "@/lib/attendance/attendance-exception-actionability";

export type AttendanceReviewCategory = "clock" | "schedule" | "branch" | "phone" | "technical";

export type AttendanceReviewItem = {
  id: string;
  exception: AttendanceException;
  relatedExceptionIds: string[];
  category: AttendanceReviewCategory;
  priority: "critical" | "high" | "normal";
  title: string;
  recommendedAction: string;
  diagnostic: AttendanceDiagnostic;
  recurrenceCount: number;
  recurrenceLabel: string;
};

export function attendanceReviewCategory(typeValue: string): AttendanceReviewCategory {
  const type = typeValue.toLowerCase();
  if (type.includes("device") || type.includes("phone") || type.includes("registration")) {
    return "phone";
  }
  if (type.includes("branch") || type.includes("location")) return "branch";
  if (type.includes("schedule") || type.includes("shift") || type.includes("off_day")) {
    return "schedule";
  }
  if (type.includes("clock") || type.includes("scan") || type.includes("attendance")) {
    return "clock";
  }
  return "technical";
}

function reviewCategoryFromDiagnostic(
  diagnostic: AttendanceDiagnostic,
  exception: AttendanceException
): AttendanceReviewCategory {
  if (diagnostic.category === "phone") return "phone";
  if (diagnostic.category === "branch") return "branch";
  if (diagnostic.category === "schedule") return "schedule";
  if (diagnostic.category === "clock" || diagnostic.category === "service") return "clock";
  return attendanceReviewCategory(effectiveAttendanceExceptionType(exception));
}

function dedupeKey(exception: AttendanceException, diagnostic: AttendanceDiagnostic): string {
  if (exception.dedupe_key) return exception.dedupe_key;
  if (exception.checkin_id) return `checkin:${exception.checkin_id}:${diagnostic.code}`;
  if (exception.scan_event_id) return `scan:${exception.scan_event_id}:${diagnostic.code}`;
  return `staff:${exception.staff_id ?? "unknown"}:${diagnostic.code}:${exception.detected_at.slice(0, 10)}`;
}

function reviewPriority(exception: AttendanceException, diagnostic: AttendanceDiagnostic) {
  if (exception.severity === "critical" || diagnostic.severity === "critical") return "critical";
  if (exception.severity === "high") return "high";
  return "normal";
}

export function buildAttendanceReviewItems(
  exceptions: AttendanceException[]
): AttendanceReviewItem[] {
  const items = new Map<string, AttendanceReviewItem>();

  for (const exception of exceptions.filter(isActionableAttendanceException)) {
    const diagnostic = resolveAttendanceDiagnostic({ exception });
    const category = reviewCategoryFromDiagnostic(diagnostic, exception);
    const key = dedupeKey(exception, diagnostic);
    const existing = items.get(key);
    const occurrenceCount = Math.max(1, exception.occurrence_count ?? 1);

    if (existing) {
      existing.relatedExceptionIds.push(exception.id);
      existing.recurrenceCount += occurrenceCount;
      existing.recurrenceLabel = recurrenceLevel(existing.recurrenceCount).label;
      if (reviewPriority(exception, diagnostic) === "critical") existing.priority = "critical";
      continue;
    }

    const name = exception.staff_name ?? "Staff member";
    const recurrence = recurrenceLevel(occurrenceCount);
    items.set(key, {
      id: key,
      exception,
      relatedExceptionIds: [exception.id],
      category,
      priority: reviewPriority(exception, diagnostic),
      title: `${name} ${diagnostic.crmTitle}`,
      recommendedAction: diagnostic.crmPrimaryAction,
      diagnostic,
      recurrenceCount: occurrenceCount,
      recurrenceLabel: recurrence.label,
    });
  }

  return Array.from(items.values()).sort((a, b) => {
    const rank = { critical: 0, high: 1, normal: 2 };
    return (
      rank[a.priority] - rank[b.priority] ||
      b.recurrenceCount - a.recurrenceCount ||
      b.exception.detected_at.localeCompare(a.exception.detected_at)
    );
  });
}

export function applyCanonicalReviewToStaff(
  rows: AttendanceStaffDiagnostic[],
  items: AttendanceReviewItem[]
): AttendanceStaffDiagnostic[] {
  return rows.map((row) => {
    const currentExceptionIds = new Set(row.staff.currentExceptionIds);
    const needsHelp = items.some(
      (item) =>
        item.exception.staff_id === row.staff.staffId &&
        item.relatedExceptionIds.some((id) => currentExceptionIds.has(id))
    );

    if (needsHelp) {
      return {
        ...row,
        needsHelp,
        working: false,
        notScannedIn: false,
      };
    }

    const operational = row.staff.operationalStatus;
    if (operational === "needs_review" || operational === "scan_captured") {
      return row;
    }

    const status: AttendanceStaffStatus =
      operational === "on_service"
        ? "in_service"
        : operational === "clocked_in"
          ? "working"
          : operational === "clocked_out"
            ? "checked_out"
            : operational === "missing"
              ? "late"
              : operational === "expected_later"
                ? "not_scanned_in"
                : "not_expected";

    const labels: Partial<Record<AttendanceStaffStatus, string>> = {
      in_service: "In service",
      working: "Working",
      checked_out: "Checked out",
      late: "Late",
      not_scanned_in: "Not scanned in",
      not_expected: "Not expected today",
    };

    return {
      ...row,
      status,
      statusLabel: labels[status] ?? row.staff.displayLabel,
      needsHelp: false,
      issue: null,
      openException: null,
      working: operational === "clocked_in" || operational === "on_service",
      notScannedIn: operational === "missing" || operational === "expected_later",
      checkedOut: operational === "clocked_out",
    };
  });
}
