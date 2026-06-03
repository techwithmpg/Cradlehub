import { Activity, Moon, Minus } from "lucide-react";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { TodayScheduleInfo, TodayOverrideInfo } from "@/app/(dashboard)/staff-portal/actions";

type GreetingCardProps = {
  staff: StaffPortalStaff;
  todaySchedule: TodayScheduleInfo | null;
  todayOverride: TodayOverrideInfo | null;
};

type ShiftStatus = "on_duty" | "day_off" | "no_shift";

function getShiftStatus(
  schedule: TodayScheduleInfo | null,
  override: TodayOverrideInfo | null
): ShiftStatus {
  if (override?.is_day_off) return "day_off";
  if (override && !override.is_day_off) return "on_duty";
  if (schedule) return "on_duty";
  return "no_shift";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const STATUS_CONFIG: Record<
  ShiftStatus,
  { label: string; bg: string; color: string; border: string; Icon: React.ElementType }
> = {
  on_duty: {
    label: "On Duty",
    bg: "var(--cs-success-bg)",
    color: "var(--cs-success)",
    border: "rgba(90,138,106,0.2)",
    Icon: Activity,
  },
  day_off: {
    label: "Day Off",
    bg: "rgba(251,191,36,0.12)",
    color: "#92700A",
    border: "rgba(146,112,10,0.2)",
    Icon: Moon,
  },
  no_shift: {
    label: "No Shift",
    bg: "var(--cs-surface-warm)",
    color: "var(--cs-text-muted)",
    border: "var(--cs-border-soft)",
    Icon: Minus,
  },
};

export function BasicStaffGreetingCard({
  staff,
  todaySchedule,
  todayOverride,
}: GreetingCardProps) {
  const displayName = getStaffDisplayName(staff);
  const firstName = displayName.split(" ")[0] ?? displayName;
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const status = getShiftStatus(todaySchedule, todayOverride);
  const { label, bg, color, border, Icon } = STATUS_CONFIG[status];

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 21,
              fontWeight: 700,
              color: "var(--cs-text)",
              lineHeight: 1.2,
            }}
          >
            Good {getGreeting()}, {firstName} 👋
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: 13,
              color: "var(--cs-text-secondary)",
              lineHeight: 1.4,
            }}
          >
            {todayLabel}
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            backgroundColor: bg,
            color,
            borderRadius: 100,
            padding: "0.3rem 0.625rem",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            border: `1px solid ${border}`,
          }}
        >
          <Icon size={11} />
          {label}
        </div>
      </div>
    </div>
  );
}
