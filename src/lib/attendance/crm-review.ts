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

function itemCopy(
  exception: AttendanceException,
  category: AttendanceReviewCategory
): { title: string; action: string } {
  const name = exception.staff_name ?? "Staff member";
  if (category === "phone") {
    return {
      title: `${name} could not use their attendance phone`,
      action: "Fix phone",
    };
  }
  if (category === "branch") {
    return {
      title: `${name} scanned at a different branch`,
      action: "Approve branch",
    };
  }
  if (category === "schedule") {
    return {
      title: `${name} needs today’s schedule`,
      action: "Add today’s schedule",
    };
  }
  if (category === "clock" && exception.checkin_id) {
    return {
      title: `${name} has an attendance record to correct`,
      action: "Correct attendance",
    };
  }
  if (category === "clock" && exception.scan_event_id) {
    return {
      title: `${name} has a saved scan waiting for a decision`,
      action: "Resolve saved scan",
    };
  }
  if (category === "clock") {
    return {
      title: `${name} has an incomplete attendance incident`,
      action: "Review processing",
    };
  }
  return {
    title: `${name} has a scan-processing issue`,
    action: "Review processing",
  };
}

function dedupeKey(exception: AttendanceException, category: AttendanceReviewCategory): string {
  if (exception.checkin_id) return `checkin:${exception.checkin_id}`;
  if (exception.scan_event_id) return `scan:${exception.scan_event_id}`;
  return `staff:${exception.staff_id ?? "unknown"}:${category}:${exception.detected_at.slice(0, 10)}`;
}

export function buildAttendanceReviewItems(
  exceptions: AttendanceException[]
): AttendanceReviewItem[] {
  const items = new Map<string, AttendanceReviewItem>();

  for (const exception of exceptions.filter(isActionableAttendanceException)) {
    const category = attendanceReviewCategory(effectiveAttendanceExceptionType(exception));
    const key = dedupeKey(exception, category);
    const existing = items.get(key);

    if (existing) {
      existing.relatedExceptionIds.push(exception.id);
      if (exception.severity === "critical") existing.priority = "critical";
      continue;
    }

    const copy = itemCopy(exception, category);
    items.set(key, {
      id: key,
      exception,
      relatedExceptionIds: [exception.id],
      category,
      priority:
        exception.severity === "critical"
          ? "critical"
          : exception.severity === "high"
            ? "high"
            : "normal",
      title: copy.title,
      recommendedAction: copy.action,
    });
  }

  return Array.from(items.values()).sort((a, b) => {
    const rank = { critical: 0, high: 1, normal: 2 };
    return (
      rank[a.priority] - rank[b.priority] ||
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
