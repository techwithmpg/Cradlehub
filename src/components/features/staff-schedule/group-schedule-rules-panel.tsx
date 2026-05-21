"use client";

import { useState, Fragment } from "react";
import type { StaffScheduleItem } from "./staff-schedule-list";
import { getGroupLabel } from "./schedule-group-cards";

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

const DEFAULT_PATTERN: Record<number, DayPattern> = {
  1: { opening: true,  closing: true,  regular: false, dayOff: false },
  2: { opening: true,  closing: true,  regular: false, dayOff: false },
  3: { opening: true,  closing: true,  regular: false, dayOff: false },
  4: { opening: true,  closing: true,  regular: false, dayOff: false },
  5: { opening: true,  closing: true,  regular: true,  dayOff: false },
  6: { opening: true,  closing: true,  regular: false, dayOff: false },
  0: { opening: false, closing: false, regular: false, dayOff: true  },
};

const SHIFT_TEMPLATES = [
  { id: "opening", label: "Opening Shift", type: "opening", startTime: "9:00 AM",  endTime: "5:00 PM",   durH: 8, durM: 0  },
  { id: "closing", label: "Closing Shift", type: "closing", startTime: "2:00 PM",  endTime: "10:30 PM",  durH: 8, durM: 30 },
  { id: "regular", label: "Regular Shift", type: "regular", startTime: "9:00 AM",  endTime: "6:00 PM",   durH: 9, durM: 0  },
] as const;

const SHIFT_STYLE: Record<string, { dot: string; badge: string; bg: string }> = {
  opening: { dot: "var(--cs-success)",    badge: "#4A7C59", bg: "rgba(74,124,89,0.12)" },
  closing: { dot: "var(--cs-info)",       badge: "#2563EB", bg: "rgba(59,130,246,0.12)" },
  regular: { dot: "var(--cs-sand)",       badge: "var(--cs-sand-dark)", bg: "rgba(166,123,91,0.12)" },
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

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  selectedGroup: string;
  groupItems: StaffScheduleItem[];
};

export function GroupScheduleRulesPanel({ selectedGroup, groupItems }: Props) {
  const groupLabel = getGroupLabel(selectedGroup);
  const [pattern, setPattern] = useState<Record<number, DayPattern>>(DEFAULT_PATTERN);

  const toggle = (dow: number, field: keyof DayPattern) => {
    setPattern((prev) => ({
      ...prev,
      [dow]: { ...prev[dow]!, [field]: !prev[dow]![field] },
    }));
  };

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* ── Header + explainer cards ── */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", margin: 0 }}>
              {groupLabel} — Universal Schedule Rules
            </h2>
            <p style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 4, marginBottom: 0 }}>
              Default rules for all {groupLabel.toLowerCase()} staff. Override individuals in the Individual Adjustments tab.
            </p>
          </div>
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
        </div>
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
              Create and manage shift templates for {groupLabel.toLowerCase()}.
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
          Preview defaults — universal schedule persistence will be wired in the next implementation step.
          {groupItems.length > 0 && (
            <span style={{ marginLeft: 8 }}>
              {realOpeningCount} of {groupItems.length} staff have opening schedules set individually.
              {" "}{realClosingCount} have closing.
            </span>
          )}
        </div>

        {SHIFT_TEMPLATES.map((tpl, idx) => {
          const style = SHIFT_STYLE[tpl.type]!;
          return (
            <div
              key={tpl.id}
              style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto 28px",
                alignItems: "center", gap: 12,
                padding: "9px 0",
                borderBottom: idx < SHIFT_TEMPLATES.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
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
                {tpl.startTime} – {tpl.endTime}
              </span>
              <span style={{ fontSize: 11, color: "var(--cs-text-subtle)", whiteSpace: "nowrap" }}>
                🕐 {tpl.durH}h {tpl.durM}m
              </span>
              <span style={{ fontSize: 16, color: "var(--cs-text-muted)", textAlign: "right" }}>···</span>
            </div>
          );
        })}
      </div>

      {/* ── Weekly Pattern ── */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "16px 20px" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>Weekly Pattern</div>
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
            Set the default weekly schedule pattern for {groupLabel.toLowerCase()}.
          </div>
          <div style={{ fontSize: 10, color: "var(--cs-sand-dark)", background: "var(--cs-sand-mist)", borderRadius: "var(--cs-r-sm)", padding: "5px 10px", marginTop: 8, display: "inline-block" }}>
            Preview — changes are not yet persisted to the database.
          </div>
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
                <Fragment key={dow}>
                  <div style={{ fontSize: 12, color: "var(--cs-text)", padding: "8px 4px", borderBottom: border, display: "flex", alignItems: "center" }}>
                    {label}
                  </div>
                  {(["opening", "closing", "regular", "dayOff"] as const).map((field) => (
                    <div key={`${dow}-${field}`} style={{ padding: "8px 4px", borderBottom: border, display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={dp[field]}
                        onChange={() => toggle(dow, field)}
                        style={{ width: 15, height: 15, cursor: "pointer" }}
                      />
                    </div>
                  ))}
                </Fragment>
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
