/**
 * ScheduleSetupHealthSummary
 *
 * Compact KPI strip computed from the already-fetched items array.
 * No new queries — reads from StaffScheduleItem[] and StaffScheduleGroup[].
 */

import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffScheduleGroup } from "@/lib/queries/staff-schedule-groups";
import {
  addDaysToYmd,
  getBranchBusinessDate,
  getDayOfWeekFromYmd,
} from "@/lib/engine/slot-time";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const today = getBranchBusinessDate();
  const dow = getDayOfWeekFromYmd(today);
  const weekStart = addDaysToYmd(today, -dow);
  return {
    weekStart,
    weekEnd: addDaysToYmd(weekStart, 6),
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

// ── Stat chip ─────────────────────────────────────────────────────────────────

type StatChipProps = {
  label: string;
  value: number;
  color?: string;
};

function StatChip({ label, value, color }: StatChipProps) {
  return (
    <div
      className="cs-card"
      style={{
        padding: "0.625rem 0.875rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flex: 1,
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontSize: "1.125rem",
          fontWeight: 700,
          lineHeight: 1,
          color: color ?? "var(--cs-text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
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
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,
      }}
    >
      <StatChip label="Active Staff" value={stats.totalActive} />
      <StatChip
        label="With Schedule"
        value={stats.withSchedule}
        color={
          stats.withSchedule === stats.totalActive
            ? "var(--cs-success,#27ae60)"
            : undefined
        }
      />
      <StatChip
        label="Missing Schedule"
        value={stats.missingSchedule}
        color={stats.missingSchedule > 0 ? "var(--cs-warning,#e67e22)" : undefined}
      />
      <StatChip
        label="Schedule Groups"
        value={stats.groupCount}
        color={stats.groupCount > 0 ? "var(--cs-info,#2980b9)" : undefined}
      />
      <StatChip
        label="Overrides This Week"
        value={stats.overridesThisWeek}
        color={stats.overridesThisWeek > 0 ? "var(--cs-sand)" : undefined}
      />
      <StatChip
        label="Blocked Time This Week"
        value={stats.blockedThisWeek}
        color={stats.blockedThisWeek > 0 ? "var(--cs-sand)" : undefined}
      />
    </div>
  );
}
