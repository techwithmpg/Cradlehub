"use client";

import { useState, useTransition } from "react";
import { setStaffScheduleAction } from "@/app/(dashboard)/manager/staff/actions";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type Props = {
  staffId: string;
  existingSchedules: Schedule[];
};

function shortTime(value: string): string {
  return value.slice(0, 5);
}

export function StaffWeeklyHoursEditor({ staffId, existingSchedules }: Props) {
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
    });
  }

  const inputStyle: React.CSSProperties = {
    height: 32,
    borderRadius: 5,
    border: "1px solid var(--cs-border)",
    padding: "0 0.5rem",
    fontSize: "0.8125rem",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      {feedback && (
        <div
          style={{
            marginBottom: "0.5rem",
            padding: "5px 10px",
            backgroundColor:
              feedback.includes("Failed") || feedback.includes("Error") ? "#FEF2F2" : "#F0FDF4",
            border: `1px solid ${
              feedback.includes("Failed") || feedback.includes("Error") ? "#FECACA" : "#BBF7D0"
            }`,
            borderRadius: 5,
            fontSize: "0.8125rem",
            color: feedback.includes("Failed") || feedback.includes("Error") ? "#991B1B" : "#15803D",
          }}
        >
          {feedback}
        </div>
      )}

      {DAY_NAMES.map((day, idx) => {
        const existing = schedules.find((row) => row.day_of_week === idx && row.is_active);
        const isEditing = editDay === idx;

        return (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "5px 0",
              borderBottom: idx < 6 ? "1px solid var(--cs-border)" : "none",
            }}
          >
            <div
              style={{
                minWidth: 80,
                fontSize: "0.8125rem",
                color: existing ? "var(--cs-text)" : "var(--cs-text-muted)",
                fontWeight: existing ? 500 : 400,
              }}
            >
              {day}
            </div>

            {isEditing ? (
              <>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={inputStyle}
                />
                <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>to</span>
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
                  style={{
                    padding: "4px 10px",
                    borderRadius: 5,
                    border: "none",
                    backgroundColor: "var(--cs-sand)",
                    color: "#fff",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditDay(null)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 5,
                    border: "1px solid var(--cs-border)",
                    backgroundColor: "transparent",
                    color: "var(--cs-text-muted)",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                  {existing
                    ? `${shortTime(existing.start_time)} – ${shortTime(existing.end_time)}`
                    : "Not scheduled"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditDay(idx);
                    setStartTime(existing ? shortTime(existing.start_time) : "09:00");
                    setEndTime(existing ? shortTime(existing.end_time) : "18:00");
                  }}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 4,
                    border: "1px solid var(--cs-border)",
                    backgroundColor: "transparent",
                    color: "var(--cs-text-muted)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  {existing ? "Edit" : "Set"}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
