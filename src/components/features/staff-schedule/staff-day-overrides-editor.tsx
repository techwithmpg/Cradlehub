"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createScheduleOverrideAction,
  deleteScheduleOverrideAction,
} from "@/app/(dashboard)/manager/staff/actions";
import { CalendarDays, Trash2, Check } from "lucide-react";

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
  onSave?: () => void;
};

function shortTime(value: string | null): string {
  if (!value) return "00:00";
  return value.slice(0, 5);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()] ?? "Jan"} ${d.getDate()}, ${d.getFullYear()}`;
}

export function StaffDayOverridesEditor({ staffId, staffName, existingOverrides, onSave }: Props) {
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
      onSave?.();
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
    height: 36,
    borderRadius: "var(--cs-r-sm)",
    border: "1px solid var(--cs-border-soft)",
    padding: "0 0.625rem",
    fontSize: "0.8125rem",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {feedback && (
        <div
          style={{
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

      {/* Add override card */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "14px 16px",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 10 }}>
          Add Override
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: "0 0 10px" }}>
          Override {staffName}&apos;s regular schedule for a specific date.
        </p>

        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text-muted)", marginBottom: 4 }}>
              Date
            </div>
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
              padding: "6px 0",
            }}
          >
            <input
              type="checkbox"
              checked={overrideIsDayOff}
              onChange={(e) => setOverrideIsDayOff(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <span style={{ color: "var(--cs-text-secondary)", fontWeight: 500 }}>Day off</span>
          </label>
          {!overrideIsDayOff && (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text-muted)", marginBottom: 4 }}>
                  From
                </div>
                <input
                  type="time"
                  value={overrideStart}
                  onChange={(e) => setOverrideStart(e.target.value)}
                  style={{ ...inputStyle, width: 90 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text-muted)", marginBottom: 4 }}>
                  To
                </div>
                <input
                  type="time"
                  value={overrideEnd}
                  onChange={(e) => setOverrideEnd(e.target.value)}
                  style={{ ...inputStyle, width: 90 }}
                />
              </div>
            </>
          )}
          <Button
            type="button"
            onClick={saveOverride}
            disabled={!overrideDate || isPending}
            size="sm"
            style={{
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--cs-r-sm)",
              height: 36,
              padding: "0 14px",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <Check size={14} style={{ marginRight: 4 }} />
            Save
          </Button>
        </div>
      </div>

      {/* Overrides list */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}>
          Upcoming Overrides
          <span
            style={{
              marginLeft: 6,
              fontSize: 11,
              fontWeight: 500,
              color: "var(--cs-text-muted)",
              background: "var(--cs-surface)",
              padding: "1px 7px",
              borderRadius: "var(--cs-r-pill)",
            }}
          >
            {overrides.length}
          </span>
        </div>

        {overrides.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              textAlign: "center",
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
              background: "var(--cs-surface)",
              border: "1px solid var(--cs-border-soft)",
              borderRadius: "var(--cs-r-lg)",
            }}
          >
            <CalendarDays size={18} style={{ color: "var(--cs-text-subtle)", margin: "0 auto 6px" }} />
            No overrides set.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {overrides.map((override) => (
              <div
                key={override.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "10px 14px",
                  background: "var(--cs-surface)",
                  border: "1px solid var(--cs-border-soft)",
                  borderRadius: "var(--cs-r-md)",
                  transition: "box-shadow 120ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: override.is_day_off ? "var(--cs-error-bg)" : "var(--cs-info-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: override.is_day_off ? "var(--cs-error)" : "var(--cs-info)",
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {override.override_date.slice(8)}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text)" }}>
                      {formatDateLabel(override.override_date)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
                      {override.is_day_off ? (
                        <span style={{ color: "var(--cs-error)", fontWeight: 500 }}>Day off</span>
                      ) : (
                        `${shortTime(override.start_time)} – ${shortTime(override.end_time)}`
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeOverride(override.id)}
                  disabled={isPending}
                  className="cs-btn cs-btn-ghost cs-btn-sm"
                  style={{
                    color: "var(--cs-error)",
                    padding: "4px 8px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Trash2 size={13} />
                  <span style={{ fontSize: 11 }}>Remove</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
