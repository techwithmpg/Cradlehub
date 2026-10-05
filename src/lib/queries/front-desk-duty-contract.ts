import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

function minute(value: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
}

export function dutyWindowAt(schedule: ResolvedStaffSchedule | undefined, nowMinute: number) {
  if (schedule?.status !== "resolved") return null;
  return (
    schedule.windows.find((window) => {
      const start = minute(window.startTime);
      const end = minute(window.endTime);
      if (start < 0 || end < 0) return false;
      return end <= start
        ? nowMinute >= start || nowMinute < end
        : nowMinute >= start && nowMinute < end;
    }) ?? null
  );
}

export function shouldRemindHandover(input: {
  role: string;
  staffId: string;
  staffBranchId: string;
  viewedBranchId: string;
  scheduledNow: boolean;
  sessionBranchId: string;
  custodianId: string;
}): boolean {
  return (
    input.role === "crm" &&
    input.scheduledNow &&
    input.staffBranchId === input.viewedBranchId &&
    input.sessionBranchId === input.viewedBranchId &&
    Boolean(input.custodianId) &&
    input.custodianId !== input.staffId
  );
}
