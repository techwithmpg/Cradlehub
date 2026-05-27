import Link from "next/link";
import type { StaffScheduleItem } from "./staff-schedule-list";
import { STAFF_GROUPS } from "./schedule-group-cards";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(count: number, total: number): string {
  if (total === 0) return "—";
  return `(${Math.round((count / total) * 100)}%)`;
}

/** Deterministic date label — no locale API to avoid SSR/client mismatch. */
function todayLabel(): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;
  const d = new Date();
  return `${months[d.getMonth()] ?? "Jan"} ${d.getDate()}, ${d.getFullYear()}`;
}

function StatRow({
  label,
  value,
  pctStr,
  color,
}: {
  label: string;
  value: number;
  pctStr: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{value} {pctStr}</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  selectedGroup: string;
  groupItems: StaffScheduleItem[];
  groupRules: StaffGroupScheduleRule[];
};

export function ScheduleSetupRightRail({ selectedGroup, groupItems, groupRules }: Props) {
  const group = STAFF_GROUPS.find((g) => g.id === selectedGroup);
  const groupLabel = group?.label ?? selectedGroup;

  const today = new Date().toISOString().split("T")[0]!;
  const todayDow = new Date().getDay();
  const total = groupItems.length;

  // Group overview stats — computed from real data
  const withCustom = groupItems.filter(
    (i) => i.overrides.length > 0 || i.blockedTimes.length > 0
  ).length;
  const followingDefault = groupItems.filter(
    (i) =>
      i.schedules.some((s) => s.is_active) &&
      i.overrides.length === 0 &&
      i.blockedTimes.length === 0
  ).length;
  const onLeaveToday = groupItems.filter((i) =>
    i.overrides.some((o) => o.override_date === today && o.is_day_off)
  ).length;

  // Coverage insight — from today's day-of-week schedules
  const openingToday = groupItems.filter((i) =>
    i.schedules.some(
      (s) => s.day_of_week === todayDow && s.is_active && s.shift_type === "opening"
    )
  ).length;
  const closingToday = groupItems.filter((i) =>
    i.schedules.some(
      (s) => s.day_of_week === todayDow && s.is_active && s.shift_type === "closing"
    )
  ).length;
  const scheduledToday = groupItems.filter((i) =>
    i.schedules.some((s) => s.day_of_week === todayDow && s.is_active)
  ).length;

  // Group rules insight
  const hasGroupRules = groupRules.some((r) => r.is_active && !r.is_day_off);
  const groupRuleDays = groupRules.filter((r) => r.is_active && !r.is_day_off).length;

  const coverageBars = [
    { label: "Opening",   count: openingToday,   total: scheduledToday || total, color: "var(--cs-success)" },
    { label: "Closing",   count: closingToday,   total: scheduledToday || total, color: "var(--cs-info)" },
    { label: "Scheduled", count: scheduledToday, total,                          color: "var(--cs-sand)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* Coverage Today */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>Coverage Today</div>
            <div style={{ fontSize: 10, color: "var(--cs-text-muted)" }}>{todayLabel()}</div>
          </div>
        </div>
        {total > 0 ? (
          coverageBars.map((bar) => {
            const fill = bar.total > 0 ? Math.min(100, Math.round((bar.count / bar.total) * 100)) : 0;
            return (
              <div key={bar.label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>{bar.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text)" }}>{bar.count} / {bar.total}</span>
                </div>
                <div style={{ height: 5, background: "var(--cs-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fill}%`, background: bar.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>No staff in this group.</div>
        )}
      </div>

      {/* Group Status */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>👥</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>{groupLabel}</span>
          <span style={{ fontSize: 11, color: "var(--cs-text-muted)", marginLeft: "auto" }}>{total} staff</span>
        </div>
        {total > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <StatRow label="Following Default"    value={followingDefault} pctStr={pct(followingDefault, total)} color="var(--cs-success)" />
            <StatRow label="With Custom Schedule" value={withCustom}       pctStr={pct(withCustom, total)}       color="var(--cs-warning)" />
            <StatRow label="On Leave Today"        value={onLeaveToday}    pctStr={pct(onLeaveToday, total)}     color="var(--cs-error)" />
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>No staff in this group yet.</div>
        )}

        {/* Group rules status */}
        <div style={{ marginTop: 8, padding: "6px 8px", background: "var(--cs-surface-warm)", borderRadius: "var(--cs-r-sm)", border: "1px solid var(--cs-border-soft)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text)", marginBottom: 2 }}>Group Rules</div>
          {hasGroupRules ? (
            <div style={{ fontSize: 11, color: "var(--cs-success)" }}>
              {groupRuleDays} active rule{groupRuleDays !== 1 ? "s" : ""}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
              No universal rules yet.
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions — only functional ones */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "12px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}>Quick Actions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Link
            href="/crm/staff-availability?tab=coverage"
            style={{
              fontSize: 12,
              color: "var(--cs-sand)",
              textDecoration: "none",
              padding: "5px 8px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              display: "block",
            }}
          >
            View Coverage Issues ›
          </Link>
          <Link
            href="/crm/staff-availability?tab=individual"
            style={{
              fontSize: 12,
              color: "var(--cs-sand)",
              textDecoration: "none",
              padding: "5px 8px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              display: "block",
            }}
          >
            Open Individual Adjustments ›
          </Link>
          <Link
            href="/crm/staff-availability?tab=overrides"
            style={{
              fontSize: 12,
              color: "var(--cs-sand)",
              textDecoration: "none",
              padding: "5px 8px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              display: "block",
            }}
          >
            Open Overrides ›
          </Link>
        </div>
      </div>

    </div>
  );
}
