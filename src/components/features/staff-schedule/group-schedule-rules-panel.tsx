"use client";

import { useState, useCallback, useTransition } from "react";
import { getGroupLabel } from "./schedule-group-cards";
import {
  upsertStaffGroupScheduleRuleAction,
  deleteStaffGroupScheduleRuleAction,
} from "@/lib/actions/staff-schedule-groups";
import { formatShiftTimeRange } from "@/lib/utils/time-format";
import type { StaffScheduleGroup, StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";
import { Save, RotateCcw, Clock } from "lucide-react";

// ── Shared types (exported for StaffScheduleCard) ──────────────────────────────

export type DayPattern = {
  opening: boolean;
  closing: boolean;
  regular: boolean;
  dayOff: boolean;
};

export type ShiftTimes = {
  opening: { start: string; end: string };
  closing: { start: string; end: string };
  regular: { start: string; end: string };
};

// ── Constants ──────────────────────────────────────────────────────────────────

export const SCHEDULE_DAYS = [
  { dow: 1, label: "Monday" },
  { dow: 2, label: "Tuesday" },
  { dow: 3, label: "Wednesday" },
  { dow: 4, label: "Thursday" },
  { dow: 5, label: "Friday" },
  { dow: 6, label: "Saturday" },
  { dow: 0, label: "Sunday" },
] as const;

export const DEFAULT_SHIFT_TIMES: ShiftTimes = {
  opening: { start: "09:00", end: "17:00" },
  closing: { start: "14:00", end: "22:30" },
  regular: { start: "09:00", end: "18:00" },
};

export const SHIFT_STYLE: Record<string, { dot: string; badge: string; bg: string }> = {
  opening: { dot: "var(--cs-success)", badge: "#4A7C59", bg: "rgba(74,124,89,0.12)" },
  closing: { dot: "var(--cs-info)", badge: "#2563EB", bg: "rgba(37,99,235,0.12)" },
  regular: { dot: "var(--cs-sand)", badge: "var(--cs-sand-dark)", bg: "rgba(166,123,91,0.12)" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function dayAbbr(label: string): string {
  return label.slice(0, 3);
}

export function formatDayList(days: string[]): string {
  if (days.length === 0) return "—";
  if (days.length === 1) return days[0] ?? "—";
  if (days.length > 2) return `${days[0]} – ${days[days.length - 1]}`;
  return days.join(", ");
}

export function extractShiftTimes(rules: StaffGroupScheduleRule[]): ShiftTimes {
  const times: ShiftTimes = {
    opening: { ...DEFAULT_SHIFT_TIMES.opening },
    closing: { ...DEFAULT_SHIFT_TIMES.closing },
    regular: { ...DEFAULT_SHIFT_TIMES.regular },
  };
  for (const rule of rules) {
    if (rule.is_day_off || !rule.start_time || !rule.end_time) continue;
    const start = rule.start_time.slice(0, 5);
    const end = rule.end_time.slice(0, 5);
    if (rule.shift_type === "opening") times.opening = { start, end };
    else if (rule.shift_type === "closing") times.closing = { start, end };
    else if (rule.shift_type === "single") times.regular = { start, end };
  }
  return times;
}

function toMins(t: string): number {
  const parts = t.split(":");
  return parseInt(parts[0] ?? "0", 10) * 60 + parseInt(parts[1] ?? "0", 10);
}

function minsToTime12h(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function computeOverlap(
  opening: { start: string; end: string },
  closing: { start: string; end: string }
): string | null {
  const start = Math.max(toMins(opening.start), toMins(closing.start));
  const end = Math.min(toMins(opening.end), toMins(closing.end));
  if (end <= start) return null;
  const dur = end - start;
  const durLabel =
    dur % 60 > 0
      ? `${Math.floor(dur / 60)}h ${dur % 60}m`
      : `${Math.floor(dur / 60)}h`;
  return `${minsToTime12h(start)} – ${minsToTime12h(end)} (${durLabel})`;
}

function rulesToPattern(rules: StaffGroupScheduleRule[]): Record<number, DayPattern> {
  const pattern: Record<number, DayPattern> = {
    0: { opening: false, closing: false, regular: false, dayOff: false },
    1: { opening: false, closing: false, regular: false, dayOff: false },
    2: { opening: false, closing: false, regular: false, dayOff: false },
    3: { opening: false, closing: false, regular: false, dayOff: false },
    4: { opening: false, closing: false, regular: false, dayOff: false },
    5: { opening: false, closing: false, regular: false, dayOff: false },
    6: { opening: false, closing: false, regular: false, dayOff: false },
  };

  for (const rule of rules) {
    const p = pattern[rule.day_of_week];
    if (!p) continue;
    if (rule.is_day_off) {
      p.dayOff = true;
    } else if (rule.shift_type === "opening") {
      p.opening = true;
    } else if (rule.shift_type === "closing") {
      p.closing = true;
    } else if (rule.shift_type === "single") {
      p.regular = true;
    }
  }

  return pattern;
}

function activeShiftBadges(
  pattern: Record<number, DayPattern>,
  times: ShiftTimes
): Array<{ id: string; label: string; type: string; startTime: string; endTime: string }> {
  const badges = [];
  if (SCHEDULE_DAYS.some((d) => pattern[d.dow]?.opening))
    badges.push({ id: "opening", label: "Opening Shift", type: "opening", startTime: times.opening.start, endTime: times.opening.end });
  if (SCHEDULE_DAYS.some((d) => pattern[d.dow]?.closing))
    badges.push({ id: "closing", label: "Closing Shift", type: "closing", startTime: times.closing.start, endTime: times.closing.end });
  if (SCHEDULE_DAYS.some((d) => pattern[d.dow]?.regular))
    badges.push({ id: "regular", label: "Regular Shift", type: "regular", startTime: times.regular.start, endTime: times.regular.end });
  return badges;
}

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  selectedGroup: string;
  groupData?: StaffScheduleGroup;
  groupRules: StaffGroupScheduleRule[];
};

export function GroupScheduleRulesPanel({ selectedGroup, groupData, groupRules }: Props) {
  const groupLabel = getGroupLabel(selectedGroup);
  const groupId = groupData?.id;

  const [pattern, setPattern] = useState<Record<number, DayPattern>>(() =>
    rulesToPattern(groupRules)
  );
  const [shiftTimes, setShiftTimes] = useState<ShiftTimes>(() =>
    extractShiftTimes(groupRules)
  );
  const [editingTimes, setEditingTimes] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const toggle = useCallback((dow: number, field: keyof DayPattern) => {
    setPattern((prev) => ({
      ...prev,
      [dow]: { ...prev[dow]!, [field]: !prev[dow]![field] },
    }));
    setDirty(true);
  }, []);

  const savePattern = useCallback(() => {
    if (!groupId) return;

    startTransition(async () => {
      const promises: Promise<unknown>[] = [];

      for (const { dow } of SCHEDULE_DAYS) {
        const p = pattern[dow];
        if (!p) continue;

        // Opening
        if (p.opening) {
          promises.push(
            upsertStaffGroupScheduleRuleAction({
              groupId,
              dayOfWeek: dow,
              shiftType: "opening",
              startTime: shiftTimes.opening.start,
              endTime: shiftTimes.opening.end,
              isDayOff: false,
              isActive: true,
            })
          );
        } else {
          promises.push(
            deleteStaffGroupScheduleRuleAction({ groupId, dayOfWeek: dow, shiftType: "opening" })
          );
        }

        // Closing
        if (p.closing) {
          promises.push(
            upsertStaffGroupScheduleRuleAction({
              groupId,
              dayOfWeek: dow,
              shiftType: "closing",
              startTime: shiftTimes.closing.start,
              endTime: shiftTimes.closing.end,
              isDayOff: false,
              isActive: true,
            })
          );
        } else {
          promises.push(
            deleteStaffGroupScheduleRuleAction({ groupId, dayOfWeek: dow, shiftType: "closing" })
          );
        }

        // Regular (single)
        if (p.regular) {
          promises.push(
            upsertStaffGroupScheduleRuleAction({
              groupId,
              dayOfWeek: dow,
              shiftType: "single",
              startTime: shiftTimes.regular.start,
              endTime: shiftTimes.regular.end,
              isDayOff: false,
              isActive: true,
            })
          );
        } else {
          promises.push(
            deleteStaffGroupScheduleRuleAction({ groupId, dayOfWeek: dow, shiftType: "single" })
          );
        }

        // Day off
        if (p.dayOff) {
          promises.push(
            upsertStaffGroupScheduleRuleAction({
              groupId,
              dayOfWeek: dow,
              shiftType: "single",
              startTime: null,
              endTime: null,
              isDayOff: true,
              isActive: true,
            })
          );
        }
      }

      const results = await Promise.all(promises);
      const failed = results.filter((r) => (r as { success: boolean }).success === false);

      if (failed.length > 0) {
        setFeedback("Some rules failed to save. Please try again.");
      } else {
        setFeedback("Schedule rules saved successfully.");
        setDirty(false);
        setEditingTimes(false);
      }

      window.setTimeout(() => setFeedback(null), 3000);
    });
  }, [groupId, pattern, shiftTimes]);

  const resetPattern = useCallback(() => {
    setPattern(rulesToPattern(groupRules));
    setShiftTimes(extractShiftTimes(groupRules));
    setEditingTimes(false);
    setDirty(false);
  }, [groupRules]);

  // Summary rows — derived from current pattern + times state
  const summaryRows = [
    {
      label: "Opening Shift",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.opening).map((d) => dayAbbr(d.label))
      ),
      time: formatShiftTimeRange(shiftTimes.opening.start, shiftTimes.opening.end),
      dot: "var(--cs-success)",
    },
    {
      label: "Closing Shift",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.closing).map((d) => dayAbbr(d.label))
      ),
      time: formatShiftTimeRange(shiftTimes.closing.start, shiftTimes.closing.end),
      dot: "var(--cs-info)",
    },
    {
      label: "Regular Shift",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.regular).map((d) => dayAbbr(d.label))
      ),
      time: formatShiftTimeRange(shiftTimes.regular.start, shiftTimes.regular.end),
      dot: "var(--cs-sand)",
    },
    {
      label: "Day Off",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.dayOff).map((d) => dayAbbr(d.label))
      ),
      time: "All day",
      dot: "var(--cs-text-subtle)",
    },
  ];

  const hasOpening = SCHEDULE_DAYS.some((d) => pattern[d.dow]?.opening);
  const hasClosing = SCHEDULE_DAYS.some((d) => pattern[d.dow]?.closing);
  const hasOverlap = hasOpening && hasClosing;
  const overlapLabel = hasOverlap
    ? computeOverlap(shiftTimes.opening, shiftTimes.closing)
    : null;

  const badges = activeShiftBadges(pattern, shiftTimes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* ── Main card ── */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "16px 20px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", margin: 0 }}>
              {groupLabel} — Weekly Rules
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "var(--cs-text-muted)",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Default weekly pattern for this staff group. Use Individual Adjustments for special
              cases.
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {dirty && (
              <>
                <button
                  type="button"
                  onClick={savePattern}
                  disabled={isPending || !groupId}
                  className="cs-btn cs-btn-primary cs-btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Save size={13} />
                  Save Rules
                </button>
                <button
                  type="button"
                  onClick={resetPattern}
                  disabled={isPending}
                  className="cs-btn cs-btn-secondary cs-btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: "var(--cs-r-sm)",
              fontSize: 12,
              fontWeight: 500,
              background: feedback.includes("failed")
                ? "var(--cs-error-bg)"
                : "var(--cs-success-bg)",
              color: feedback.includes("failed")
                ? "var(--cs-error-text)"
                : "var(--cs-success-text)",
            }}
          >
            {feedback}
          </div>
        )}

        {/* Shift badges + "Edit Times" toggle */}
        {badges.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {badges.map((b) => {
              const s = SHIFT_STYLE[b.type] ?? SHIFT_STYLE.regular!;
              return (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: "var(--cs-r-sm)",
                    background: s.bg,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: s.dot,
                      flexShrink: 0,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 600, color: s.badge }}>{b.label}</span>
                  <span style={{ color: "var(--cs-text-muted)" }}>
                    {formatShiftTimeRange(b.startTime, b.endTime)}
                  </span>
                </div>
              );
            })}

            {/* Edit Times button */}
            <button
              type="button"
              onClick={() => setEditingTimes((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: "var(--cs-r-sm)",
                border: editingTimes
                  ? "1px solid var(--cs-sand)"
                  : "1px solid var(--cs-border)",
                background: editingTimes ? "var(--cs-sand-tint)" : "transparent",
                color: editingTimes ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <Clock size={11} />
              {editingTimes ? "Done Editing" : "Edit Times"}
            </button>
          </div>
        )}

        {/* Inline time editor */}
        {editingTimes && (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              background: "var(--cs-surface-warm)",
              borderRadius: "var(--cs-r-md)",
              border: "1px solid var(--cs-border-soft)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--cs-text)",
                marginBottom: 10,
              }}
            >
              Shift Times — saved together with the weekly pattern
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(["opening", "closing", "regular"] as const).map((k) => {
                const label =
                  k === "opening" ? "Opening" : k === "closing" ? "Closing" : "Regular";
                const t = shiftTimes[k];
                const s = SHIFT_STYLE[k] ?? SHIFT_STYLE.regular!;
                return (
                  <div
                    key={k}
                    style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: s.dot,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--cs-text)",
                        minWidth: 70,
                      }}
                    >
                      {label}
                    </span>
                    <input
                      type="time"
                      value={t.start}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShiftTimes((prev) => ({
                          ...prev,
                          [k]: { ...prev[k], start: val },
                        }));
                        setDirty(true);
                      }}
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: "var(--cs-r-sm)",
                        border: "1px solid var(--cs-border)",
                        background: "var(--cs-surface)",
                        color: "var(--cs-text)",
                      }}
                    />
                    <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>–</span>
                    <input
                      type="time"
                      value={t.end}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShiftTimes((prev) => ({
                          ...prev,
                          [k]: { ...prev[k], end: val },
                        }));
                        setDirty(true);
                      }}
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: "var(--cs-r-sm)",
                        border: "1px solid var(--cs-border)",
                        background: "var(--cs-surface)",
                        color: "var(--cs-text)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly Pattern heading */}
        <div style={{ marginBottom: 4 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}
          >
            Weekly Pattern
          </div>
          {dirty && (
            <div
              style={{
                fontSize: 10,
                color: "var(--cs-sand-dark)",
                background: "var(--cs-sand-mist)",
                borderRadius: "var(--cs-r-sm)",
                padding: "5px 10px",
                marginBottom: 8,
                display: "inline-block",
              }}
            >
              You have unsaved changes. Click Save Rules to persist.
            </div>
          )}
        </div>

        {/* Matrix */}
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 1fr 1fr 1fr",
              minWidth: 380,
            }}
          >
            {["Day", "Opening", "Closing", "Regular", "Day Off"].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "6px 4px",
                  borderBottom: "1px solid var(--cs-border)",
                }}
              >
                {h}
              </div>
            ))}
            {SCHEDULE_DAYS.map(({ dow, label }, rowIdx) => {
              const dp = pattern[dow] ?? {
                opening: false,
                closing: false,
                regular: false,
                dayOff: false,
              };
              const border =
                rowIdx < SCHEDULE_DAYS.length - 1
                  ? "1px solid var(--cs-border-soft)"
                  : "none";
              return (
                <div key={dow} style={{ display: "contents" }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--cs-text)",
                      padding: "8px 4px",
                      borderBottom: border,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {label}
                  </div>
                  {(["opening", "closing", "regular", "dayOff"] as const).map((field) => (
                    <div
                      key={`${dow}-${field}`}
                      style={{
                        padding: "8px 4px",
                        borderBottom: border,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={dp[field]}
                        onChange={() => toggle(dow, field)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule Summary */}
        <div
          style={{
            marginTop: "1rem",
            padding: 12,
            background: "var(--cs-surface-warm)",
            borderRadius: "var(--cs-r-md)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <div
            style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 6 }}
          >
            Schedule Summary
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {summaryRows.map((row, idx) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                  borderBottom:
                    idx < summaryRows.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: row.dot,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--cs-text)",
                    width: 90,
                  }}
                >
                  {row.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--cs-text-muted)", flex: 1 }}>
                  {row.days}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--cs-text-subtle)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.time}
                </span>
              </div>
            ))}
          </div>

          {hasOverlap && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "var(--cs-success-bg)",
                borderRadius: "var(--cs-r-sm)",
                border: "1px solid rgba(90,138,106,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-success)" }}>
                  Overlap Window
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    background: "var(--cs-success)",
                    color: "#fff",
                    borderRadius: "var(--cs-r-pill)",
                  }}
                >
                  High Coverage
                </span>
              </div>
              {overlapLabel ? (
                <span style={{ fontSize: 11, color: "var(--cs-text)" }}>{overlapLabel}</span>
              ) : (
                <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
                  No overlap — opening and closing shifts don&apos;t share any hours
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
