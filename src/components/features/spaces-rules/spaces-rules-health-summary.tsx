/**
 * SpacesRulesHealthSummary
 *
 * Quick-glance stat cards derived from already-fetched resources and rules.
 * No new queries — reads ResourceRow[] and BranchBookingRules.
 *
 * Shows:
 *   - Total resources
 *   - Active resources
 *   - Inactive resources
 *   - Total capacity (sum of all resource capacities)
 *   - Home service status (enabled/disabled)
 *   - Booking rules status (custom or system defaults)
 */

import type { ResourceRow } from "./spaces-rules-utils";
import type { BranchBookingRules } from "@/lib/validations/booking-rules";

// ── Helpers ────────────────────────────────────────────────────────────────────

type HealthStats = {
  totalResources: number;
  activeResources: number;
  inactiveResources: number;
  totalCapacity: number;
  homeServiceEnabled: boolean;
  hasCustomRules: boolean;
  inSpaWindow: string;
  homeServiceWindow: string;
  maxAdvanceDays: number;
  travelBufferMins: number;
};

function computeStats(
  resources: ResourceRow[],
  rules: BranchBookingRules
): HealthStats {
  const active = resources.filter((r) => r.is_active);
  const totalCapacity = resources.reduce((sum, r) => sum + (r.capacity ?? 1), 0);

  return {
    totalResources: resources.length,
    activeResources: active.length,
    inactiveResources: resources.length - active.length,
    totalCapacity,
    homeServiceEnabled: rules.homeServiceEnabled,
    hasCustomRules: Boolean(rules.id),
    inSpaWindow: `${rules.inSpaStartTime} – ${rules.inSpaEndTime}`,
    homeServiceWindow: rules.homeServiceEnabled
      ? `${rules.homeServiceStartTime} – ${rules.homeServiceEndTime}`
      : "Disabled",
    maxAdvanceDays: rules.maxAdvanceBookingDays,
    travelBufferMins: rules.travelBufferMins,
  };
}

// ── Stat card ──────────────────────────────────────────────────────────────────

type StatCardProps = {
  label: string;
  value: string | number;
  valueColor?: string;
  activeTint?: string;
  note?: string;
};

function StatCard({ label, value, valueColor, activeTint, note }: StatCardProps) {
  return (
    <div
      className="cs-card"
      style={{
        padding: "0.875rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        background: activeTint ?? "var(--cs-surface)",
      }}
    >
      <div
        style={{
          fontSize: "1.375rem",
          fontWeight: 700,
          lineHeight: 1,
          color: valueColor ?? "var(--cs-text)",
          fontFamily: "var(--font-display)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      {note && (
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--cs-text-muted)",
            fontStyle: "italic",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function SpacesRulesHealthSummary({
  resources,
  rules,
}: {
  resources: ResourceRow[];
  rules: BranchBookingRules;
}) {
  const s = computeStats(resources, rules);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.625rem",
      }}
    >
      <StatCard label="Total Resources" value={s.totalResources} />
      <StatCard
        label="Active Resources"
        value={s.activeResources}
        valueColor={
          s.activeResources === s.totalResources && s.totalResources > 0
            ? "var(--cs-success,#27ae60)"
            : "var(--cs-text)"
        }
      />
      <StatCard
        label="Inactive"
        value={s.inactiveResources}
        valueColor={
          s.inactiveResources > 0 ? "var(--cs-warning,#e67e22)" : "var(--cs-text-muted)"
        }
        activeTint={
          s.inactiveResources > 0 ? "rgba(230,126,34,0.04)" : undefined
        }
      />
      <StatCard
        label="Total Capacity"
        value={s.totalCapacity}
        note="sum of all resources"
      />
      <StatCard
        label="Home Service"
        value={s.homeServiceEnabled ? "On" : "Off"}
        valueColor={
          s.homeServiceEnabled
            ? "var(--cs-success,#27ae60)"
            : "var(--cs-text-muted)"
        }
        note={s.homeServiceEnabled ? s.homeServiceWindow : "not enabled"}
      />
      <StatCard
        label="Booking Rules"
        value={s.hasCustomRules ? "Custom" : "Default"}
        valueColor={
          s.hasCustomRules ? "var(--cs-info,#2980b9)" : "var(--cs-text-muted)"
        }
        note={`in-spa ${s.inSpaWindow}`}
      />
      <StatCard
        label="Max Advance"
        value={`${s.maxAdvanceDays}d`}
        note="days ahead for booking"
      />
      <StatCard
        label="Travel Buffer"
        value={`${s.travelBufferMins}m`}
        note="home-service travel pad"
      />
    </div>
  );
}
