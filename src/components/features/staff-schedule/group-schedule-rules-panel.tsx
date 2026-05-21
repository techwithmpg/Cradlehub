"use client";

import { useState, useCallback, useTransition } from "react";
import type { StaffScheduleItem } from "./staff-schedule-list";
import { getGroupLabel } from "./schedule-group-cards";
import {
  upsertStaffGroupScheduleRuleAction,
  deleteStaffGroupScheduleRuleAction,
} from "@/lib/actions/staff-schedule-groups";
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

function shortTime(value: string | null): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const displayHour = (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0) === 0 ? 12 : (h ?? 0);
  return `${displayHour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = (sh ?? 0) * 60 + (sm ?? 0);
  const endMin = (eh ?? 0) * 60 + (em ?? 0);
  const diff = endMin - startMin;
  if (diff <= 0) return "—";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m`;
}

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
  // Derive templates from pattern — use defaults for now since we don't store templates separately
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
  groupItems: StaffScheduleItem[];
};

export function GroupScheduleRulesPanel({ selectedGroup, groupData, groupRules, groupItems }: Props) {
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

  // Real counts from existing individual schedules
  const realOpeningCount = groupItems.filter((i) =>
    i.schedules.some((s) => s.is_active && s.shift_type === "opening")
  ).length;
  const realClosingCount = groupItems.filter((i) =>
    i.schedules.some((s) => s.is_active && s.shift_type === "closing")
  ).length;

  const templates = patternToTemplates(pattern);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* ── Header + explainer cards ── */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", margin: 0 }}>
              {groupLabel} — Universal Schedule Rules
            </h2>
            <p style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 4, marginBottom: 0 }}>
              Default rules for all {groupLabel.toLowerCase()} staff. Override individuals in the Individual Adjustments tab.
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
            {!dirty && (
              <button
                type="button"
                disabled
                title="Available in a future release"
                style={{
                  flexShrink: 0, padding: "6px 12px", fontSize: 11, fontWeight: 500,
                  background: "var(--cs-surface-warm)", border: "1px solid var(--cs-border)",
                  borderRadius: "var(--cs-r-sm)", cursor: "not-allowed", color: "var(--cs-text-muted)",
                  opacity: 0.6,
                }}
              >
                📅 Set Default Day Offs
              </button>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { icon: "📋", title: "Universal rules", desc: "Set once for this staff group." },
            { icon: "🔧", title: "Individual overrides", desc: "Customize only special cases." },
            { icon: "✅", title: "Final availability", desc: "Schedule + check-in + bookings." },
          ].map((c) => (
            <div key={c.title} style={{ background: "var(--cs-surface-warm)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-sm)", padding: "10px 12px" }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{c.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text)", marginBottom: 3 }}>{c.title}</div>
              <div style={{ fontSize: 10, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Shift Templates ── */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>Shift Templates</div>
            <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
              Default shifts for {groupLabel.toLowerCase()}.
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Universal schedule persistence will be wired in the next implementation step."
            style={{
              padding: "5px 12px", fontSize: 11, fontWeight: 500,
              background: "var(--cs-surface-warm)", border: "1px solid var(--cs-border)",
              borderRadius: "var(--cs-r-sm)", cursor: "not-allowed", color: "var(--cs-text-muted)", opacity: 0.6,
            }}
          >
            + Add Shift Template
          </button>
        </div>

        <div style={{ fontSize: 10, color: "var(--cs-sand-dark)", background: "var(--cs-sand-mist)", borderRadius: "var(--cs-r-sm)", padding: "6px 10px", marginBottom: 12 }}>
          {groupItems.length > 0 ? (
            <span>
              {realOpeningCount} of {groupItems.length} staff have opening schedules set individually.
              {" "}{realClosingCount} have closing.
            </span>
          ) : (
            <span>No staff in this group yet.</span>
          )}
        </div>

        {templates.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)", padding: "8px 0" }}>
            No shift templates configured. Use the weekly pattern below to set default shifts.
          </div>
        ) : (
          templates.map((tpl, idx) => {
            const style = SHIFT_STYLE[tpl.type] ?? SHIFT_STYLE.regular!;
            return (
              <div
                key={tpl.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto 28px",
                  alignItems: "center", gap: 12,
                  padding: "9px 0",
                  borderBottom: idx < templates.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: style.dot, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text)" }}>{tpl.label}</span>
                </div>
                <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 600, background: style.bg, color: style.badge, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {tpl.type}
                </span>
                <span style={{ fontSize: 12, color: "var(--cs-text-muted)", whiteSpace: "nowrap" }}>
                  {shortTime(tpl.startTime)} – {shortTime(tpl.endTime)}
                </span>
                <span style={{ fontSize: 11, color: "var(--cs-text-subtle)", whiteSpace: "nowrap" }}>
                  🕐 {formatDuration(tpl.startTime, tpl.endTime)}
                </span>
                <span style={{ fontSize: 16, color: "var(--cs-text-muted)", textAlign: "right" }}>···</span>
              </div>
            );
          })
        )}
      </div>

      {/* ── Weekly Pattern ── */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "16px 20px" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>Weekly Pattern</div>
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
            Set the default weekly schedule pattern for {groupLabel.toLowerCase()}.
          </div>
          {dirty && (
            <div style={{ fontSize: 10, color: "var(--cs-sand-dark)", background: "var(--cs-sand-mist)", borderRadius: "var(--cs-r-sm)", padding: "5px 10px", marginTop: 8, display: "inline-block" }}>
              You have unsaved changes. Click Save Rules to persist.
            </div>
          )}
        </div>

        {/* Matrix */}
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr 1fr", minWidth: 380 }}>
            {["Day", "Opening Shift", "Closing Shift", "Regular Shift", "Day Off"].map((h) => (
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

        {/* Schedule Summary */}
        <div style={{ marginTop: "1.25rem", padding: 14, background: "var(--cs-surface-warm)", borderRadius: "var(--cs-r-md)", border: "1px solid var(--cs-border-soft)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}>Schedule Summary</div>
          {summaryRows.map((row, idx) => (
            <div
              key={row.label}
              style={{
                display: "grid", gridTemplateColumns: "8px 1fr 80px 1fr",
                alignItems: "center", gap: 10,
                padding: "5px 0",
                borderBottom: idx < summaryRows.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.dot, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text)" }}>{row.label}</span>
              <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>{row.days}</span>
              <span style={{ fontSize: 11, color: "var(--cs-text-subtle)" }}>{row.time}</span>
            </div>
          ))}

          {hasOverlap && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--cs-success-bg)", borderRadius: "var(--cs-r-sm)", border: "1px solid rgba(90,138,106,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-success)" }}>Overlap Window</span>
                <span style={{ fontSize: 10, color: "var(--cs-text-muted)" }}>When both opening and closing shifts are active.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text)" }}>2:00 PM – 5:00 PM (3h)</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", background: "var(--cs-success)", color: "#fff", borderRadius: "var(--cs-r-pill)" }}>
                  High Coverage
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
