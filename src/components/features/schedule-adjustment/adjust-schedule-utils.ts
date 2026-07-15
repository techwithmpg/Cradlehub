import { canUseOpeningClosingShift } from "@/lib/schedule/shift-eligibility";
import {
  databaseShiftToUi,
  getScheduleShiftLabel,
  uiShiftToDatabase,
} from "@/lib/schedule/schedule-domain";
import {
  getScheduleWindowAbsoluteRange,
  getUniqueScheduleCoverageMinutes,
} from "@/lib/schedule/schedule-coverage";
import { MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY } from "@/lib/schedule/staff-schedule-write";
import { formatTime12h, timeToMinutes } from "@/lib/utils/time-format";
import type {
  AdjustScheduleDraft,
  AdjustScheduleStaffItem,
  OpenCloseNormalizationCandidate,
  ScheduleShiftKind,
  ScheduleValidationIssue,
  ScheduleWindowDraft,
  WeeklyScheduleDayDraft,
} from "./adjust-schedule-types";

export const ADJUST_SCHEDULE_DAYS = [
  { dayOfWeek: 0, label: "Sunday", short: "Sun" },
  { dayOfWeek: 1, label: "Monday", short: "Mon" },
  { dayOfWeek: 2, label: "Tuesday", short: "Tue" },
  { dayOfWeek: 3, label: "Wednesday", short: "Wed" },
  { dayOfWeek: 4, label: "Thursday", short: "Thu" },
  { dayOfWeek: 5, label: "Friday", short: "Fri" },
  { dayOfWeek: 6, label: "Saturday", short: "Sat" },
] as const;

export function getShiftLabel(value: ScheduleShiftKind): string {
  return getScheduleShiftLabel(value);
}

export { databaseShiftToUi, uiShiftToDatabase };

export function getAllowedShiftKinds(staff: AdjustScheduleStaffItem["staff"]): ScheduleShiftKind[] {
  return canUseOpeningClosingShift({
    staff_type: staff.staff_type,
    system_role: staff.system_role,
  })
    ? ["opening", "regular", "closing"]
    : ["regular"];
}

function makeDraftId(dayOfWeek: number, order: number): string {
  return `draft-${dayOfWeek}-${order}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createNewWindow(
  dayOfWeek: number,
  order: number,
  shiftKind: ScheduleShiftKind = "regular"
): ScheduleWindowDraft {
  return {
    id: makeDraftId(dayOfWeek, order),
    shiftKind,
    startTime: "09:00",
    endTime: "18:00",
    endsNextDay: false,
    order,
  };
}

export function createDraftFromScheduleItem(params: {
  item: AdjustScheduleStaffItem;
  branchId: string;
}): AdjustScheduleDraft {
  const days: WeeklyScheduleDayDraft[] = ADJUST_SCHEDULE_DAYS.map(({ dayOfWeek }) => {
    const rows = params.item.schedules.filter((schedule) => schedule.day_of_week === dayOfWeek);
    const activeRows = rows
      .filter((schedule) => schedule.is_active)
      .sort(
        (a, b) =>
          (a.window_order ?? Number.MAX_SAFE_INTEGER) -
            (b.window_order ?? Number.MAX_SAFE_INTEGER) || a.start_time.localeCompare(b.start_time)
      );

    if (rows.length === 0) {
      return { dayOfWeek, mode: "unconfigured", windows: [] };
    }
    if (activeRows.length === 0) {
      return { dayOfWeek, mode: "day_off", windows: [] };
    }

    return {
      dayOfWeek,
      mode: "working",
      windows: activeRows.map((row, index) => ({
        id: row.id,
        persistedId: row.id,
        shiftKind: databaseShiftToUi(row.shift_type),
        startTime: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
        endsNextDay: row.ends_next_day ?? isImplicitOvernight(row.start_time, row.end_time),
        order: row.window_order ?? index + 1,
      })),
    };
  });

  return {
    staffId: params.item.staff.id,
    branchId: params.branchId,
    days,
  };
}

export function cloneDraft(draft: AdjustScheduleDraft): AdjustScheduleDraft {
  return {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      windows: day.windows.map((window) => ({ ...window })),
    })),
  };
}

export function normalizeWindowOrders(day: WeeklyScheduleDayDraft): WeeklyScheduleDayDraft {
  return {
    ...day,
    windows: day.windows.map((window, index) => ({ ...window, order: index + 1 })),
  };
}

export function getWindowDurationMinutes(window: ScheduleWindowDraft): number | null {
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (start === null || end === null || start === end) return null;
  const absoluteEnd = window.endsNextDay ? end + 24 * 60 : end;
  if (absoluteEnd <= start) return null;
  return absoluteEnd - start;
}

export function getWeeklyDurationMinutes(draft: AdjustScheduleDraft): number {
  return draft.days.reduce((total, day) => {
    if (day.mode !== "working") return total;
    return total + getUniqueScheduleCoverageMinutes(day.windows);
  }, 0);
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatWindowTime(window: ScheduleWindowDraft): string {
  const suffix = window.endsNextDay ? " · next day" : "";
  return `${formatTime12h(window.startTime)} - ${formatTime12h(window.endTime)}${suffix}`;
}

function getOpenCloseCandidate(
  day: WeeklyScheduleDayDraft
): OpenCloseNormalizationCandidate | null {
  if (day.mode !== "working" || day.windows.length !== 2) return null;

  const opening = day.windows.find((window) => window.shiftKind === "opening");
  const closing = day.windows.find((window) => window.shiftKind === "closing");
  if (!opening || !closing) return null;

  const openingRange = getScheduleWindowAbsoluteRange(opening);
  const closingRange = getScheduleWindowAbsoluteRange(closing);
  if (!openingRange || !closingRange) return null;
  if (openingRange.end - openingRange.start > 16 * 60) return null;
  if (closingRange.end - closingRange.start > 16 * 60) return null;

  const compatible =
    openingRange.start < closingRange.start &&
    closingRange.start < openingRange.end &&
    closingRange.end > openingRange.end;
  if (!compatible) return null;

  return {
    dayOfWeek: day.dayOfWeek,
    openingWindowId: opening.id,
    closingWindowId: closing.id,
    openingStartTime: opening.startTime,
    previousOpeningEndTime: opening.endTime,
    closingStartTime: closing.startTime,
    closingEndTime: closing.endTime,
    closingEndsNextDay: closing.endsNextDay,
  };
}

export function getOpenCloseNormalizationCandidates(params: {
  draft: AdjustScheduleDraft;
  eligible: boolean;
}): OpenCloseNormalizationCandidate[] {
  if (!params.eligible) return [];
  return params.draft.days
    .map(getOpenCloseCandidate)
    .filter((candidate): candidate is OpenCloseNormalizationCandidate => candidate !== null);
}

export function normalizeOpenCloseCoverage(params: {
  draft: AdjustScheduleDraft;
  candidates: OpenCloseNormalizationCandidate[];
}): AdjustScheduleDraft {
  const candidateByDay = new Map(
    params.candidates.map((candidate) => [candidate.dayOfWeek, candidate])
  );

  return {
    ...params.draft,
    days: params.draft.days.map((day) => {
      const candidate = candidateByDay.get(day.dayOfWeek);
      if (!candidate) return day;
      return {
        ...day,
        windows: day.windows.map((window) =>
          window.id === candidate.openingWindowId
            ? {
                ...window,
                endTime: candidate.closingStartTime,
                endsNextDay: false,
              }
            : window
        ),
      };
    }),
  };
}

export function validateAdjustScheduleDraft(params: {
  draft: AdjustScheduleDraft;
  allowedShiftKinds: ScheduleShiftKind[];
  openCloseNormalizationEligible?: boolean;
}): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = [];
  const allowed = new Set(params.allowedShiftKinds);
  const compatibleByDay = new Map(
    getOpenCloseNormalizationCandidates({
      draft: params.draft,
      eligible: params.openCloseNormalizationEligible === true,
    }).map((candidate) => [candidate.dayOfWeek, candidate])
  );

  for (const day of params.draft.days) {
    if (day.mode === "working" && day.windows.length === 0) {
      issues.push({
        id: `empty-${day.dayOfWeek}`,
        level: "error",
        dayOfWeek: day.dayOfWeek,
        message: `${getDayLabel(day.dayOfWeek)} needs at least one work window.`,
      });
    }
    if (day.windows.length > MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY) {
      issues.push({
        id: `too-many-windows-${day.dayOfWeek}`,
        level: "error",
        dayOfWeek: day.dayOfWeek,
        message: `${getDayLabel(day.dayOfWeek)} can have up to ${MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY} schedule windows.`,
      });
    }
    if (day.mode !== "working" && day.windows.length > 0) {
      issues.push({
        id: `inactive-windows-${day.dayOfWeek}`,
        level: "error",
        dayOfWeek: day.dayOfWeek,
        message: `${getDayLabel(day.dayOfWeek)} cannot keep windows while marked ${day.mode === "day_off" ? "Day Off" : "Not Configured"}.`,
      });
    }

    const compatible = compatibleByDay.get(day.dayOfWeek);
    const ranges: Array<{ start: number; end: number; order: number; windowId: string }> = [];
    for (const [index, window] of day.windows.entries()) {
      if (!allowed.has(window.shiftKind)) {
        issues.push({
          id: `ineligible-${day.dayOfWeek}-${window.id}`,
          level: "error",
          dayOfWeek: day.dayOfWeek,
          message: "Opening and Closing shifts are only available to therapists and CRM staff.",
        });
      }

      const start = timeToMinutes(window.startTime);
      const end = timeToMinutes(window.endTime);
      if (start === null || end === null || start === end) {
        issues.push({
          id: `time-${day.dayOfWeek}-${window.id}`,
          level: "error",
          dayOfWeek: day.dayOfWeek,
          message: `Window ${index + 1} on ${getDayLabel(day.dayOfWeek)} needs a valid time range.`,
        });
        continue;
      }
      if (!window.endsNextDay && end <= start) {
        issues.push({
          id: `overnight-${day.dayOfWeek}-${window.id}`,
          level: "error",
          dayOfWeek: day.dayOfWeek,
          message: `Window ${index + 1} on ${getDayLabel(day.dayOfWeek)} crosses midnight. Enable Ends next day.`,
        });
        continue;
      }

      const absoluteEnd = window.endsNextDay ? end + 24 * 60 : end;
      if (absoluteEnd - start > 16 * 60) {
        issues.push({
          id: `duration-${day.dayOfWeek}-${window.id}`,
          level: "error",
          dayOfWeek: day.dayOfWeek,
          message: `Window ${index + 1} on ${getDayLabel(day.dayOfWeek)} is longer than 16 hours.`,
        });
        continue;
      }

      for (const range of ranges) {
        if (range.start < absoluteEnd && start < range.end) {
          const isCompatibleOpenClose = Boolean(
            compatible &&
            new Set([compatible.openingWindowId, compatible.closingWindowId]).has(window.id) &&
            new Set([compatible.openingWindowId, compatible.closingWindowId]).has(range.windowId)
          );
          issues.push({
            id: `overlap-${day.dayOfWeek}-${window.id}`,
            code: isCompatibleOpenClose ? "open_close_overlap" : "overlap",
            level: "error",
            dayOfWeek: day.dayOfWeek,
            message: isCompatibleOpenClose
              ? `${getDayLabel(day.dayOfWeek)} has overlapping Opening and Closing coverage. Fix automatically to use the Closing start as the responsibility handoff.`
              : `Window ${index + 1} overlaps Window ${range.order} on ${getDayLabel(day.dayOfWeek)}.`,
          });
        }
      }
      ranges.push({ start, end: absoluteEnd, order: index + 1, windowId: window.id });
    }
  }

  if (params.draft.days.every((day) => day.mode === "unconfigured")) {
    issues.push({
      id: "no-schedule",
      level: "info",
      message:
        "No weekly schedule is configured yet. This staff member will not be available for booking from weekly rules.",
    });
  }

  return issues;
}

export function getDayLabel(dayOfWeek: number): string {
  return ADJUST_SCHEDULE_DAYS.find((day) => day.dayOfWeek === dayOfWeek)?.label ?? "Weekday";
}

export function isImplicitOvernight(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start !== null && end !== null && end <= start;
}

export function hasBlockingIssues(issues: ScheduleValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}

export function serializeDraftForSave(draft: AdjustScheduleDraft) {
  return {
    branchId: draft.branchId,
    staffId: draft.staffId,
    days: draft.days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      mode: day.mode,
      windows: day.windows.map((window, index) => ({
        id: window.persistedId ?? window.id,
        shiftKind: window.shiftKind,
        startTime: window.startTime,
        endTime: window.endTime,
        endsNextDay: window.endsNextDay,
        order: index + 1,
      })),
    })),
  };
}
