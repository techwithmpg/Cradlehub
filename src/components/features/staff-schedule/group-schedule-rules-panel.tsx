"use client";

import { useState, useCallback, useTransition } from "react";
import { getGroupLabel } from "./schedule-group-cards";
import {
  upsertStaffGroupScheduleRuleAction,
  deleteStaffGroupScheduleRuleAction,
} from "@/lib/actions/staff-schedule-groups";
import { formatTime12h } from "@/lib/utils/time-format";
import type { StaffScheduleGroup, StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";
import { Save, RotateCcw } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type DayPattern = {
  opening: boolean;
  closing: boolean;
  regular: boolean;
  dayOff: boolean;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = [
  { dow: 1, label: "Monday" },
  { dow: 2, label: "Tuesday" },
  { dow: 3, label: "Wednesday" },
  { dow: 4, label: "Thursday" },
  { dow: 5, label: "Friday" },
  { dow: 6, label: "Saturday" },
  { dow: 0, label: "Sunday" },
] as const;

const DEFAULT_SHIFT_TEMPLATES = [
  { id: "opening", label: "Opening Shift", type: "opening", startTime: "09:00", endTime: "17:00", durH: 8, durM: 0 },
  { id: "closing", label: "Closing Shift", type: "closing", startTime: "14:00", endTime: "22:30", durH: 8, durM: 30 },
  { id: "regular", label: "Regular Shift", type: "regular", startTime: "09:00", endTime: "18:00", durH: 9, durM: 0 },
] as const;

const SHIFT_STYLE: Record<string, { dot: string; badge: string; bg: string }> = {
  opening: { dot: "var(--cs-success)", badge: "#4A7C59", bg: "rgba(74,124,89,0.12)" },
  closing: { dot: "var(--cs-info)", badge: "#2563EB", bg: "rgba(37,99,235,0.12)" },
  regular: { dot: "var(--cs-sand)", badge: "var(--cs-sand-dark)", bg: "rgba(166,123,91,0.12)" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function dayAbbr(label: string): string {
  return label.slice(0, 3);
}

function formatDayList(days: string[]): string {
  if (days.length === 0) return "—";
  if (days.length === 1) return days[0] ?? "—";
  if (days.length > 2) return `${days[0]} – ${days[days.length - 1]}`;
  return days.join(", ");
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

function patternToTemplates(pattern: Record<number, DayPattern>): Array<{
  id: string;
  label: string;
  type: string;
  startTime: string;
  endTime: string;
  durH: number;
  durM: number;
}> {
  const templates = [];

  const hasOpening = DAYS.some((d) => pattern[d.dow]?.opening);
  const hasClosing = DAYS.some((d) => pattern[d.dow]?.closing);
  const hasRegular = DAYS.some((d) => pattern[d.dow]?.regular);

  if (hasOpening) {
    templates.push({ ...DEFAULT_SHIFT_TEMPLATES[0] });
  }
  if (hasClosing) {
    templates.push({ ...DEFAULT_SHIFT_TEMPLATES[1] });
  }
  if (hasRegular) {
    templates.push({ ...DEFAULT_SHIFT_TEMPLATES[2] });
  }

  return templates;
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
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const toggle = useCallback((dow: number, field: keyof DayPattern) => {
    setPattern((prev) => {
      const next = { ...prev, [dow]: { ...prev[dow]!, [field]: !prev[dow]![field] } };
      return next;
    });
    setDirty(true);
  }, []);

  const savePattern = useCallback(() => {
    if (!groupId) return;

    startTransition(async () => {
      const promises: Promise<unknown>[] = [];

      for (const { dow } of DAYS) {
        const p = pattern[dow];
        if (!p) continue;

        // Opening
        if (p.opening) {
          promises.push(
            upsertStaffGroupScheduleRuleAction({
              groupId,
              dayOfWeek: dow,
              shiftType: "opening",
              startTime: "09:00",
              endTime: "17:00",
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
              startTime: "14:00",
              endTime: "22:30",
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
              startTime: "09:00",
              endTime: "18:00",
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
      }

      window.setTimeout(() => setFeedback(null), 3000);
    });
  }, [groupId, pattern]);

  const resetPattern = useCallback(() => {
    setPattern(rulesToPattern(groupRules));
    setDirty(false);
  }, [groupRules]);

  // Summary rows — derived from current pattern state
  const summaryRows = [
    {
      label: "Opening Shift",
      days: formatDayList(DAYS.filter((d) => pattern[d.dow]?.opening).map((d) => dayAbbr(d.label))),
      time: "9:00 AM – 5:00 PM",
      dot: "var(--cs-success)",
    },
    {
      label: "Closing Shift",
      days: formatDayList(DAYS.filter((d) => pattern[d.dow]?.closing).map((d) => dayAbbr(d.label))),
      time: "2:00 PM – 10:30 PM",
      dot: "var(--cs-info)",
    },
    {
      label: "Regular Shift",
      days: formatDayList(DAYS.filter((d) => pattern[d.dow]?.regular).map((d) => dayAbbr(d.label))),
      time: "9:00 AM – 6:00 PM",
      dot: "var(--cs-sand)",
    },
    {
      label: "Day Off",
      days: formatDayList(DAYS.filter((d) => pattern[d.dow]?.dayOff).map((d) => dayAbbr(d.label))),
      time: "All day",
      dot: "var(--cs-text-subtle)",
    },
  ];

  const hasOverlap =
    DAYS.some((d) => pattern[d.dow]?.opening) && DAYS.some((d) => pattern[d.dow]?.closing);

  const templates = patternToTemplates(pattern);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* ── Main card: header + weekly pattern + summary ── */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "16px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", margin: 0 }}>
              {groupLabel} — Weekly Rules
            </h2>
            <p style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 4, marginBottom: 0 }}>
              Default weekly pattern for this staff group. Use Individual Adjustments for special cases.
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

        {feedback && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: "var(--cs-r-sm)",
              fontSize: 12,
              fontWeight: 500,
              background: feedback.includes("failed") ? "var(--cs-error-bg)" : "var(--cs-success-bg)",
              color: feedback.includes("failed") ? "var(--cs-error-text)" : "var(--cs-success-text)",
            }}
          >
            {feedback}
          </div>
        )}

        {/* Shift templates compact row */}
        {templates.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {templates.map((tpl) => {
              const style = SHIFT_STYLE[tpl.type] ?? SHIFT_STYLE.regular!;
              return (
                <div
                  key={tpl.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: "var(--cs-r-sm)",
                    background: style.bg,
                    fontSize: 11,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: style.dot, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontWeight: 600, color: style.badge }}>{tpl.label}</span>
                  <span style={{ color: "var(--cs-text-muted)" }}>
                    {formatTime12h(tpl.startTime)} – {formatTime12h(tpl.endTime)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Weekly Pattern */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}>Weekly Pattern</div>
          {dirty && (
            <div style={{ fontSize: 10, color: "var(--cs-sand-dark)", background: "var(--cs-sand-mist)", borderRadius: "var(--cs-r-sm)", padding: "5px 10px", marginBottom: 8, display: "inline-block" }}>
              You have unsaved changes. Click Save Rules to persist.
            </div>
          )}
        </div>

        {/* Matrix */}
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr 1fr", minWidth: 380 }}>
            {["Day", "Opening", "Closing", "Regular", "Day Off"].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 4px", borderBottom: "1px solid var(--cs-border)" }}>
                {h}
              </div>
            ))}
            {DAYS.map(({ dow, label }, rowIdx) => {
              const dp = pattern[dow] ?? { opening: false, closing: false, regular: false, dayOff: false };
              const border = rowIdx < DAYS.length - 1 ? "1px solid var(--cs-border-soft)" : "none";
              return (
                <div key={dow} style={{ display: "contents" }}>
                  <div style={{ fontSize: 12, color: "var(--cs-text)", padding: "8px 4px", borderBottom: border, display: "flex", alignItems: "center" }}>
                    {label}
                  </div>
                  {(["opening", "closing", "regular", "dayOff"] as const).map((field) => (
                    <div key={`${dow}-${field}`} style={{ padding: "8px 4px", borderBottom: border, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

        {/* Schedule Summary — compact */}
        <div style={{ marginTop: "1rem", padding: 12, background: "var(--cs-surface-warm)", borderRadius: "var(--cs-r-md)", border: "1px solid var(--cs-border-soft)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 6 }}>Schedule Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {summaryRows.map((row, idx) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                  borderBottom: idx < summaryRows.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.dot, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text)", width: 90 }}>{row.label}</span>
                <span style={{ fontSize: 11, color: "var(--cs-text-muted)", flex: 1 }}>{row.days}</span>
                <span style={{ fontSize: 11, color: "var(--cs-text-subtle)", whiteSpace: "nowrap" }}>{row.time}</span>
              </div>
            ))}
          </div>

          {hasOverlap && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--cs-success-bg)", borderRadius: "var(--cs-r-sm)", border: "1px solid rgba(90,138,106,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-success)" }}>Overlap Window</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", background: "var(--cs-success)", color: "#fff", borderRadius: "var(--cs-r-pill)" }}>
                  High Coverage
                </span>
              </div>
              <span style={{ fontSize: 11, color: "var(--cs-text)" }}>2:00 PM – 5:00 PM (3h)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
