"use client";

import type { CrmAvailabilitySummary } from "@/lib/queries/crm-availability";
import { MVP_CHECKIN_PAUSED } from "@/lib/config/mvp-flags";

type Props = {
  summary: CrmAvailabilitySummary;
};

type Chip = {
  label: string;
  value: string | number;
  color: string;
  dotColor: string;
  highlight?: boolean;
};

// ── Single metric chip ────────────────────────────────────────────────────────

function MetricChip({ label, value, color, dotColor, highlight = false }: Chip) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 11px",
        border: highlight
          ? `1px solid ${dotColor}55`
          : "1px solid var(--cs-border-soft)",
        borderRadius: 8,
        background: highlight ? `${dotColor}0d` : "var(--cs-surface)",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {/* Colored status dot */}
      <span
        style={{
          width: 7, height: 7, borderRadius: "50%",
          background: dotColor, flexShrink: 0,
        }}
      />
      {/* Label */}
      <span
        style={{
          fontSize: 10, fontWeight: 500,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      {/* Value */}
      <span
        style={{
          fontSize: 14, fontWeight: 700,
          color, lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────────

export function CrmAvailabilitySummary({ summary }: Props) {
  const chips: Chip[] = [
    {
      label: "Scheduled",
      value: `${summary.scheduledToday}/${summary.total}`,
      color: "var(--cs-text)",
      dotColor: "#c8a96b",
    },
    // "Checked In" and "Not In" are hidden during MVP since all scheduled staff are
    // synthetically treated as present — both chips would mirror "Scheduled" and 0.
    ...(!MVP_CHECKIN_PAUSED
      ? [
          {
            label: "Checked In",
            value: summary.checkedIn,
            color: "#2d9e63",
            dotColor: "#2d9e63",
            highlight: summary.checkedIn > 0,
          } satisfies Chip,
          {
            label: "Not In",
            value: summary.notCheckedIn,
            color: summary.notCheckedIn > 0 ? "#b35b0a" : "var(--cs-text-muted)",
            dotColor: summary.notCheckedIn > 0 ? "#c97a18" : "#b0b0b0",
            highlight: summary.notCheckedIn > 0,
          } satisfies Chip,
        ]
      : []),
    {
      label: "Available",
      value: summary.availableNow,
      color: "#2d9e63",
      dotColor: "#2d9e63",
      highlight: summary.availableNow > 0,
    },
    {
      label: "Busy",
      value: summary.busyNow,
      color: "#2471a3",
      dotColor: "#2471a3",
    },
    ...(summary.scheduleConflicts > 0
      ? [{
          label: "Conflicts",
          value: summary.scheduleConflicts,
          color: "#b91c1c",
          dotColor: "#b91c1c",
          highlight: true,
        } satisfies Chip]
      : []),
    {
      label: "Drivers",
      value: `${summary.driversReady}/${summary.driversTotal}`,
      color: summary.driversReady > 0 ? "#2471a3" : "var(--cs-text-muted)",
      dotColor: summary.driversReady > 0 ? "#2471a3" : "#b0b0b0",
      highlight: summary.driversTotal > 0 && summary.driversReady === 0,
    },
    ...(summary.needsAttention > 0
      ? [{
          label: "Attention",
          value: summary.needsAttention,
          color: "#b35b0a",
          dotColor: "#c97a18",
          highlight: true,
        } satisfies Chip]
      : []),
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}
    >
      {chips.map((chip) => (
        <MetricChip key={chip.label} {...chip} />
      ))}
    </div>
  );
}
