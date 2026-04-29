"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  setStaffScheduleAction,
  createScheduleOverrideAction,
  createBlockedTimeAction,
  deleteBlockedTimeAction,
  deleteScheduleOverrideAction,
} from "@/app/(dashboard)/manager/staff/actions";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type ScheduleOverride = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type BlockedTime = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
};

type BlockReason = "break" | "leave" | "training" | "other";

type ScheduleManagerProps = {
  staffId: string;
  staffName: string;
  existingSchedules: Schedule[];
  existingOverrides: ScheduleOverride[];
  existingBlockedTimes: BlockedTime[];
};

function shortTime(value: string): string {
  return value.slice(0, 5);
}

export function ScheduleManager({
  staffId,
  staffName,
  existingSchedules,
  existingOverrides,
  existingBlockedTimes,
}: ScheduleManagerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"weekly" | "override" | "block">("weekly");
  const [schedules, setSchedules] = useState(existingSchedules);
  const [overrides, setOverrides] = useState(existingOverrides);
  const [blockedTimes, setBlockedTimes] = useState(existingBlockedTimes);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const [editDay, setEditDay] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const [overrideDate, setOverrideDate] = useState("");
  const [overrideIsDayOff, setOverrideIsDayOff] = useState(false);
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("18:00");

  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockReason, setBlockReason] = useState<BlockReason>("break");

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

      showFeedback("Override saved");
      setOverrideDate("");
      router.refresh();
    });
  }

  function saveBlock() {
    startTransition(async () => {
      const result = await createBlockedTimeAction({
        staffId,
        blockDate,
        startTime: blockStart,
        endTime: blockEnd,
        reason: blockReason,
      });

      if (!result.success) {
        showFeedback(result.error ?? "Failed to add blocked time");
        return;
      }

      showFeedback("Blocked time saved");
      setBlockDate("");
      router.refresh();
    });
  }

  function removeOverride(overrideId: string) {
    startTransition(async () => {
      const result = await deleteScheduleOverrideAction(overrideId);
      if (!result.success) {
        showFeedback(result.error ?? "Failed to remove override");
        return;
      }
      setOverrides((previous) => previous.filter((item) => item.id !== overrideId));
      showFeedback("Override removed");
    });
  }

  function removeBlockedTime(blockedTimeId: string) {
    startTransition(async () => {
      const result = await deleteBlockedTimeAction(blockedTimeId);
      if (!result.success) {
        showFeedback(result.error ?? "Failed to remove blocked time");
        return;
      }
      setBlockedTimes((previous) => previous.filter((item) => item.id !== blockedTimeId));
      showFeedback("Blocked time removed");
    });
  }

  const inputStyle: React.CSSProperties = {
    height: 32,
    borderRadius: 5,
    border: "1px solid var(--ch-border)",
    padding: "0 0.5rem",
    fontSize: "0.8125rem",
    backgroundColor: "var(--ch-surface)",
    color: "var(--ch-text)",
  };

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: "5px 12px",
      borderRadius: 5,
      border: `1px solid ${active ? "var(--ch-accent)" : "var(--ch-border)"}`,
      backgroundColor: active ? "var(--ch-accent-light)" : "transparent",
      color: active ? "var(--ch-accent)" : "var(--ch-text-muted)",
      fontSize: "0.8125rem",
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
    };
  }

  return (
    <div style={{ padding: "0.875rem 1rem" }}>
      {feedback && (
        <div
          style={{
            marginBottom: "0.75rem",
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

      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button type="button" style={tabStyle(tab === "weekly")} onClick={() => setTab("weekly")}>
          Weekly Hours
        </button>
        <button type="button" style={tabStyle(tab === "override")} onClick={() => setTab("override")}>
          Day Override
        </button>
        <button type="button" style={tabStyle(tab === "block")} onClick={() => setTab("block")}>
          Block Time
        </button>
      </div>

      {tab === "weekly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
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
                  borderBottom: idx < 6 ? "1px solid var(--ch-border)" : "none",
                }}
              >
                <div
                  style={{
                    minWidth: 80,
                    fontSize: "0.8125rem",
                    color: existing ? "var(--ch-text)" : "var(--ch-text-subtle)",
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
                      onChange={(event) => setStartTime(event.target.value)}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)" }}>to</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
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
                        backgroundColor: "var(--ch-accent)",
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
                        border: "1px solid var(--ch-border)",
                        backgroundColor: "transparent",
                        color: "var(--ch-text-muted)",
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, fontSize: "0.8125rem", color: "var(--ch-text-muted)" }}>
                      {existing ? `${shortTime(existing.start_time)} – ${shortTime(existing.end_time)}` : "Not scheduled"}
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
                        border: "1px solid var(--ch-border)",
                        backgroundColor: "transparent",
                        color: "var(--ch-text-muted)",
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
      )}

      {tab === "override" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)", margin: 0 }}>
            Override {staffName}&apos;s regular schedule for a specific date.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", marginBottom: 3 }}>Date</div>
              <input
                type="date"
                value={overrideDate}
                onChange={(event) => setOverrideDate(event.target.value)}
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
                onChange={(event) => setOverrideIsDayOff(event.target.checked)}
              />
              Day off
            </label>
            {!overrideIsDayOff && (
              <>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", marginBottom: 3 }}>From</div>
                  <input
                    type="time"
                    value={overrideStart}
                    onChange={(event) => setOverrideStart(event.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", marginBottom: 3 }}>To</div>
                  <input
                    type="time"
                    value={overrideEnd}
                    onChange={(event) => setOverrideEnd(event.target.value)}
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
              style={{ backgroundColor: "var(--ch-accent)", color: "#fff", border: "none" }}
            >
              Save Override
            </Button>
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            {overrides.length === 0 ? (
              <div style={{ fontSize: "0.8125rem", color: "var(--ch-text-subtle)" }}>No overrides set.</div>
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
                      border: "1px solid var(--ch-border)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: "0.8125rem", color: "var(--ch-text)" }}>
                      {override.override_date} ·{" "}
                      {override.is_day_off
                        ? "Day off"
                        : `${shortTime(override.start_time ?? "00:00")} - ${shortTime(
                            override.end_time ?? "00:00"
                          )}`}
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
      )}

      {tab === "block" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)", margin: 0 }}>
            Block a time period within a working day (break, training, leave).
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", marginBottom: 3 }}>Date</div>
              <input
                type="date"
                value={blockDate}
                onChange={(event) => setBlockDate(event.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", marginBottom: 3 }}>From</div>
              <input
                type="time"
                value={blockStart}
                onChange={(event) => setBlockStart(event.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", marginBottom: 3 }}>To</div>
              <input
                type="time"
                value={blockEnd}
                onChange={(event) => setBlockEnd(event.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", marginBottom: 3 }}>Reason</div>
              <select
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value as BlockReason)}
                style={{ ...inputStyle, paddingRight: "1.5rem" }}
              >
                <option value="break">Break</option>
                <option value="leave">Leave</option>
                <option value="training">Training</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Button
              type="button"
              onClick={saveBlock}
              disabled={!blockDate || isPending}
              size="sm"
              style={{ backgroundColor: "var(--ch-accent)", color: "#fff", border: "none" }}
            >
              Add Block
            </Button>
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            {blockedTimes.length === 0 ? (
              <div style={{ fontSize: "0.8125rem", color: "var(--ch-text-subtle)" }}>No blocked time entries.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {blockedTimes.map((block) => (
                  <div
                    key={block.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0.5rem 0.625rem",
                      border: "1px solid var(--ch-border)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: "0.8125rem", color: "var(--ch-text)" }}>
                      {block.block_date} · {shortTime(block.start_time)} - {shortTime(block.end_time)} ·{" "}
                      {block.reason}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBlockedTime(block.id)}
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
      )}
    </div>
  );
}
