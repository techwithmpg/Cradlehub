/**
 * ScheduleSetupHealthSummary
 *
 * Quick-glance stat cards computed from the already-fetched items array.
 * No new queries — reads from StaffScheduleItem[] and StaffScheduleGroup[].
 *
 * Shows:
 *   - Total active staff
 *   - Staff with individual weekly schedule
 *   - Staff missing individual schedule (no active schedule rows)
 *   - Active schedule groups configured
 *   - Overrides this week
 *   - Blocked time this week
 *
 * A warning banner is shown when any staff have no individual schedule,
 * directing CRM to the Coverage Issues tab for full details.
 */

import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffScheduleGroup } from "@/lib/queries/staff-schedule-groups";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sunday
  const start = new Date(today);
  start.setDate(today.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    weekStart: start.toISOString().split("T")[0]!,
    weekEnd:   end.toISOString().split("T")[0]!,
  };
}

type HealthStats = {
  totalActive: number;
  withSchedule: number;
  missingSchedule: number;
  groupCount: number;
  overridesThisWeek: number;
  blockedThisWeek: number;
};

function computeStats(
  items: StaffScheduleItem[],
  groups: StaffScheduleGroup[]
): HealthStats {
  const { weekStart, weekEnd } = getWeekBounds();

  const withSchedule = items.filter((i) =>
    i.schedules.some((s) => s.is_active)
  ).length;

  const overridesThisWeek = items.reduce(
    (sum, i) =>
      sum +
      i.overrides.filter(
        (o) => o.override_date >= weekStart && o.override_date <= weekEnd
      ).length,
    0
  );

  const blockedThisWeek = items.reduce(
    (sum, i) =>
      sum +
      i.blockedTimes.filter(
        (b) => b.block_date >= weekStart && b.block_date <= weekEnd
      ).length,
    0
  );

  return {
    totalActive: items.length,
    withSchedule,
    missingSchedule: items.length - withSchedule,
    groupCount: groups.length,
    overridesThisWeek,
    blockedThisWeek,
  };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

type StatCardProps = {
  label: string;
  value: number;
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
          fontSize: "1.5rem",
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
        <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
          {note}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ScheduleSetupHealthSummary({
  items,
  groups,
}: {
  items: StaffScheduleItem[];
  groups: StaffScheduleGroup[];
}) {
  const stats = computeStats(items, groups);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Warning if staff missing individual schedules */}
      {stats.missingSchedule > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: "var(--cs-r-sm,8px)",
            border: "1px solid rgba(230,126,34,0.25)",
            background: "rgba(230,126,34,0.05)",
            fontSize: "0.8125rem",
            color: "var(--cs-text-secondary)",
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <span>
            <strong style={{ color: "var(--cs-warning,#e67e22)" }}>
              {stats.missingSchedule} staff member{stats.missingSchedule > 1 ? "s have" : " has"} no individual weekly schedule.
            </strong>
            {" They may still be covered by a group schedule rule. Check the "}
            <strong>Coverage Issues</strong>
            {" tab below for full detail."}
          </span>
        </div>
      )}

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.625rem",
        }}
      >
        <StatCard label="Active Staff" value={stats.totalActive} />
        <StatCard
          label="With Schedule"
          value={stats.withSchedule}
          valueColor={
            stats.withSchedule === stats.totalActive
              ? "var(--cs-success,#27ae60)"
              : "var(--cs-text)"
          }
        />
        <StatCard
          label="Missing Schedule"
          value={stats.missingSchedule}
          valueColor={
            stats.missingSchedule > 0 ? "var(--cs-warning,#e67e22)" : "var(--cs-text-muted)"
          }
          activeTint={
            stats.missingSchedule > 0 ? "rgba(230,126,34,0.04)" : undefined
          }
          note="individual only — may have group rules"
        />
        <StatCard
          label="Schedule Groups"
          value={stats.groupCount}
          valueColor={
            stats.groupCount > 0 ? "var(--cs-info,#2980b9)" : "var(--cs-text-muted)"
          }
        />
        <StatCard
          label="Overrides This Week"
          value={stats.overridesThisWeek}
          valueColor={
            stats.overridesThisWeek > 0 ? "var(--cs-sand)" : "var(--cs-text-muted)"
          }
        />
        <StatCard
          label="Blocked Time This Week"
          value={stats.blockedThisWeek}
          valueColor={
            stats.blockedThisWeek > 0 ? "var(--cs-sand)" : "var(--cs-text-muted)"
          }
        />
      </div>
    </div>
  );
}
