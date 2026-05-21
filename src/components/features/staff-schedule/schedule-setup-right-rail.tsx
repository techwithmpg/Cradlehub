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

  const QUICK_ACTIONS = [
    "Copy schedule to another group",
    "Apply rules to new staff",
    "Export group schedule",
    "View staff list",
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

      {/* Group Overview */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>👥</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>Group Overview</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text)" }}>{groupLabel}</div>
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>{total} Staff Member{total !== 1 ? "s" : ""}</div>
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
        <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--cs-surface-warm)", borderRadius: "var(--cs-r-sm)", border: "1px solid var(--cs-border-soft)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text)", marginBottom: 3 }}>Group Rules</div>
          {hasGroupRules ? (
            <div style={{ fontSize: 11, color: "var(--cs-success)" }}>
              {groupRuleDays} active rule{groupRuleDays !== 1 ? "s" : ""} configured
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
              No universal rules yet. Set the weekly pattern to create defaults.
            </div>
          )}
        </div>
      </div>

      {/* Coverage Insight */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>Coverage Insight</div>
            <div style={{ fontSize: 10, color: "var(--cs-text-muted)" }}>Today ({todayLabel()})</div>
          </div>
        </div>
        {total > 0 ? (
          coverageBars.map((bar) => {
            const fill = bar.total > 0 ? Math.min(100, Math.round((bar.count / bar.total) * 100)) : 0;
            return (
              <div key={bar.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>{bar.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text)" }}>{bar.count} / {bar.total}</span>
                </div>
                <div style={{ height: 6, background: "var(--cs-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fill}%`, background: bar.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>Coverage rules ready for wiring.</div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-lg)", padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", marginBottom: 10 }}>Quick Actions</div>
        {QUICK_ACTIONS.map((label, idx) => (
          <div
            key={label}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: idx < QUICK_ACTIONS.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
              opacity: 0.55,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--cs-text)" }}>{label}</span>
            <span style={{ fontSize: 14, color: "var(--cs-text-muted)" }}>›</span>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--cs-text-subtle)", fontStyle: "italic" }}>
          Coming in the next implementation step.
        </div>
      </div>

    </div>
  );
}
