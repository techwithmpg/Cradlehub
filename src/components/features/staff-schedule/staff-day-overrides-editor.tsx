"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createScheduleOverrideAction,
  deleteScheduleOverrideAction,
} from "@/app/(dashboard)/manager/staff/actions";

type ScheduleOverride = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type Props = {
  staffId: string;
  staffName: string;
  existingOverrides: ScheduleOverride[];
};

function shortTime(value: string | null): string {
  if (!value) return "00:00";
  return value.slice(0, 5);
}

export function StaffDayOverridesEditor({ staffId, staffName, existingOverrides }: Props) {
  const [overrides, setOverrides] = useState<ScheduleOverride[]>(existingOverrides);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideIsDayOff, setOverrideIsDayOff] = useState(false);
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("18:00");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function saveOverride() {
    startTransition(async () => {
      const result = await createScheduleOverrideAction({
        staffId,
        overrideDate,
        isDayOff: overrideIsDayOff,
        startTime: overrideIsDayOff ? undefined : overrideStart,
        endTime: overrideIsDayOff ? undefined : overrideEnd,
      });

      if (!result.success) {
        showFeedback(result.error ?? "Failed to save override");
        return;
      }

      // Optimistically add to local state
      const newOverride: ScheduleOverride = {
        id: `tmp-${Date.now()}`,
        override_date: overrideDate,
        is_day_off: overrideIsDayOff,
        start_time: overrideIsDayOff ? null : overrideStart,
        end_time: overrideIsDayOff ? null : overrideEnd,
        reason: null,
      };
      setOverrides((prev) =>
        [...prev, newOverride].sort((a, b) => a.override_date.localeCompare(b.override_date))
      );
      setOverrideDate("");
      showFeedback("Override saved");
    });
  }

  function removeOverride(overrideId: string) {
    startTransition(async () => {
      const result = await deleteScheduleOverrideAction(overrideId);
      if (!result.success) {
        showFeedback(result.error ?? "Failed to remove override");
        return;
      }
      setOverrides((prev) => prev.filter((item) => item.id !== overrideId));
      showFeedback("Override removed");
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {feedback && (
        <div
          style={{
            marginBottom: "0.25rem",
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

      <p style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", margin: 0 }}>
        Override {staffName}&apos;s regular schedule for a specific date.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 3 }}>Date</div>
          <input
            type="date"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.8125rem",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={overrideIsDayOff}
            onChange={(e) => setOverrideIsDayOff(e.target.checked)}
          />
          Day off
        </label>
        {!overrideIsDayOff && (
          <>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 3 }}>From</div>
              <input
                type="time"
                value={overrideStart}
                onChange={(e) => setOverrideStart(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 3 }}>To</div>
              <input
                type="time"
                value={overrideEnd}
                onChange={(e) => setOverrideEnd(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}
        <Button
          type="button"
          onClick={saveOverride}
          disabled={!overrideDate || isPending}
          size="sm"
          style={{ backgroundColor: "var(--cs-sand)", color: "#fff", border: "none" }}
        >
          Save Override
        </Button>
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        {overrides.length === 0 ? (
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>No overrides set.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {overrides.map((override) => (
              <div
                key={override.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.5rem 0.625rem",
                  border: "1px solid var(--cs-border)",
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: "0.8125rem", color: "var(--cs-text)" }}>
                  {override.override_date} ·{" "}
                  {override.is_day_off
                    ? "Day off"
                    : `${shortTime(override.start_time)} - ${shortTime(override.end_time)}`}
                </div>
                <button
                  type="button"
                  onClick={() => removeOverride(override.id)}
                  disabled={isPending}
                  style={{
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#DC2626",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
