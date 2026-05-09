"use client";

import { CalendarDays, Grid3X3, Users } from "lucide-react";

export type ScheduleViewMode = "day" | "week" | "staff";

type ScheduleModeSwitcherProps = {
  mode: ScheduleViewMode;
  onChange: (mode: ScheduleViewMode) => void;
};

const MODES: { key: ScheduleViewMode; label: string; icon: typeof CalendarDays }[] = [
  { key: "day", label: "Day", icon: CalendarDays },
  { key: "week", label: "Week", icon: Grid3X3 },
  { key: "staff", label: "Staff", icon: Users },
];

export function ScheduleModeSwitcher({ mode, onChange }: ScheduleModeSwitcherProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        backgroundColor: "var(--cs-bg)",
        border: "1px solid var(--cs-border)",
        borderRadius: 8,
        padding: 2,
      }}
    >
      {MODES.map((m) => {
        const isActive = mode === m.key;
        const Icon = m.icon;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              background: isActive ? "var(--cs-surface)" : "transparent",
              boxShadow: isActive ? "0 1px 2px rgba(30,25,22,0.06)" : "none",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: isActive ? "var(--cs-text)" : "var(--cs-text-muted)",
              cursor: "pointer",
              transition: "all 120ms ease",
              whiteSpace: "nowrap",
            }}
            aria-pressed={isActive}
          >
            <Icon size={13} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
