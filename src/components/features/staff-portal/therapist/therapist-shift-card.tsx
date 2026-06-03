import Link from "next/link";
import { Clock, CalendarDays } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { TodayScheduleInfo, TodayOverrideInfo } from "@/app/(dashboard)/staff-portal/actions";

type TherapistShiftCardProps = {
  todaySchedule: TodayScheduleInfo | null;
  todayOverride: TodayOverrideInfo | null;
};

function getShiftTypeLabel(shiftType: string): string {
  if (shiftType === "opening") return "Opening Shift";
  if (shiftType === "closing") return "Closing Shift";
  return "Regular Shift";
}

type ResolvedShift =
  | { status: "on_duty"; startTime: string; endTime: string; shiftType: string }
  | { status: "day_off" }
  | { status: "no_shift" };

function resolveShift(
  schedule: TodayScheduleInfo | null,
  override: TodayOverrideInfo | null
): ResolvedShift {
  if (override?.is_day_off) return { status: "day_off" };
  if (override && !override.is_day_off) {
    const start = override.start_time ?? schedule?.start_time ?? null;
    const end = override.end_time ?? schedule?.end_time ?? null;
    if (start && end) {
      return {
        status: "on_duty",
        startTime: start,
        endTime: end,
        shiftType: schedule ? getShiftTypeLabel(schedule.shift_type) : "Regular Shift",
      };
    }
  }
  if (schedule) {
    return {
      status: "on_duty",
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      shiftType: getShiftTypeLabel(schedule.shift_type),
    };
  }
  return { status: "no_shift" };
}

export function TherapistShiftCard({
  todaySchedule,
  todayOverride,
}: TherapistShiftCardProps) {
  const shift = resolveShift(todaySchedule, todayOverride);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cs-text-muted)",
          marginBottom: "0.625rem",
        }}
      >
        My Shift Today
      </div>

      {shift.status === "on_duty" ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <Clock size={16} color="var(--cs-staff-accent)" />
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--cs-text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", paddingLeft: 23 }}>
            {shift.shiftType}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "var(--cs-text-muted)", fontWeight: 500 }}>
          {shift.status === "day_off" ? "Day Off" : "No shift scheduled"}
        </div>
      )}

      <Link
        href="/staff-portal/schedule"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: "0.875rem",
          padding: "0.5rem 0.875rem",
          borderRadius: 10,
          border: "1px solid var(--cs-border)",
          backgroundColor: "var(--cs-surface-warm)",
          color: "var(--cs-staff-accent)",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        <CalendarDays size={13} />
        View Full Schedule
      </Link>
    </div>
  );
}
