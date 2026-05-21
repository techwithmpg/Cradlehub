"use client";

import { useState, useTransition } from "react";
import { setStaffScheduleAction } from "@/app/(dashboard)/manager/staff/actions";
import { Check, X, Pencil } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type?: string;
};

type Props = {
  staffId: string;
  existingSchedules: Schedule[];
  onSave?: () => void;
};

function shortTime(value: string): string {
  return value.slice(0, 5);
}

export function StaffWeeklyHoursEditor({ staffId, existingSchedules, onSave }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>(existingSchedules);
  const [editDay, setEditDay] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function saveWeeklySchedule(dayOfWeek: number) {
    startTransition(async () => {
      const result = await setStaffScheduleAction({
        staffId,
        dayOfWeek,
        startTime,
        endTime,
        isActive: true,
      });

      if (!result.success) {
        showFeedback(result.error ?? "Failed to save schedule");
        return;
      }

      setSchedules((previous) => {
        const withoutDay = previous.filter((row) => row.day_of_week !== dayOfWeek);
        return [
          ...withoutDay,
          {
            id: `tmp-${staffId}-${dayOfWeek}`,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            is_active: true,
          },
        ].sort((a, b) => a.day_of_week - b.day_of_week);
      });
      setEditDay(null);
      showFeedback("Schedule saved");
      onSave?.();
    });
  }

  const inputStyle: React.CSSProperties = {
    height: 34,
    borderRadius: "var(--cs-r-sm)",
    border: "1px solid var(--cs-border-soft)",
    padding: "0 0.625rem",
    fontSize: "0.8125rem",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
    outline: "none",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {feedback && (
        <div
          style={{
            marginBottom: "0.25rem",
            padding: "8px 12px",
            borderRadius: "var(--cs-r-sm)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            background:
              feedback.includes("Failed") || feedback.includes("Error")
                ? "var(--cs-error-bg)"
                : "var(--cs-success-bg)",
            color:
              feedback.includes("Failed") || feedback.includes("Error")
                ? "var(--cs-error-text)"
                : "var(--cs-success-text)",
            border:
              feedback.includes("Failed") || feedback.includes("Error")
                ? "1px solid var(--cs-error-bg)"
                : "1px solid var(--cs-success-bg)",
          }}
        >
          {feedback}
        </div>
      )}

      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "12px 16px",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 10 }}>
          Weekly Pattern
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {DAY_NAMES.map((day, idx) => {
            const daySchedules = schedules.filter((row) => row.day_of_week === idx && row.is_active);
            const existing = daySchedules.find((r) => r.shift_type === "single") ?? daySchedules[0];
            const isEditing = editDay === idx;

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "7px 8px",
                  borderRadius: "var(--cs-r-sm)",
                  transition: "background-color 120ms ease",
                  backgroundColor: isEditing ? "var(--cs-surface-warm)" : "transparent",
                }}
              >
                <div
                  style={{
                    minWidth: 40,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: existing ? "var(--cs-success-bg)" : "var(--cs-border-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: existing ? "var(--cs-success)" : "var(--cs-text-subtle)",
                    flexShrink: 0,
                  }}
                >
                  {DAY_SHORT[idx]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: existing ? 500 : 400,
                      color: existing ? "var(--cs-text)" : "var(--cs-text-muted)",
                    }}
                  >
                    {day}
                  </div>
                  {existing && !isEditing && (
                    <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 1 }}>
                      {shortTime(existing.start_time)} – {shortTime(existing.end_time)}
                    </div>
                  )}
                  {!existing && !isEditing && (
                    <div style={{ fontSize: 11, color: "var(--cs-text-subtle)", marginTop: 1 }}>
                      Not scheduled
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>to</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => saveWeeklySchedule(idx)}
                      disabled={isPending}
                      className="cs-btn cs-btn-primary cs-btn-sm"
                      style={{ padding: "5px 10px", borderRadius: "var(--cs-r-sm)" }}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDay(null)}
                      className="cs-btn cs-btn-secondary cs-btn-sm"
                      style={{ padding: "5px 10px", borderRadius: "var(--cs-r-sm)" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditDay(idx);
                      setStartTime(existing ? shortTime(existing.start_time) : "09:00");
                      setEndTime(existing ? shortTime(existing.end_time) : "18:00");
                    }}
                    className="cs-btn cs-btn-ghost cs-btn-sm"
                    style={{
                      padding: "5px 10px",
                      borderRadius: "var(--cs-r-sm)",
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Pencil size={12} />
                    {existing ? "Edit" : "Set"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
