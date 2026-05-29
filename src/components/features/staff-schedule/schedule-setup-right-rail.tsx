import Link from "next/link";
import type { StaffScheduleItem } from "./staff-schedule-list";
import { STAFF_GROUPS } from "./schedule-group-cards";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";
import { Target, Users, Zap } from "lucide-react";

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 0",
      }}
    >
      <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color }}>
        {value} <span style={{ fontWeight: 400, opacity: 0.7 }}>{pctStr}</span>
      </span>
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
    { label: "Opening", count: openingToday, total: scheduledToday || total, color: "var(--cs-success)" },
    { label: "Closing", count: closingToday, total: scheduledToday || total, color: "var(--cs-info)" },
    { label: "Scheduled", count: scheduledToday, total, color: "var(--cs-sand)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Coverage Today */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-xl)",
          padding: "1rem 1.125rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(90,138,106,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cs-crm-accent)",
              flexShrink: 0,
            }}
          >
            <Target size={14} />
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
              Coverage Today
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", fontWeight: 500 }}>{todayLabel()}</div>
          </div>
        </div>
        {total > 0 ? (
          coverageBars.map((bar) => {
            const fill = bar.total > 0 ? Math.min(100, Math.round((bar.count / bar.total) * 100)) : 0;
            return (
              <div key={bar.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontWeight: 500 }}>{bar.label}</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--cs-text)" }}>
                    {bar.count} / {bar.total}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--cs-surface-warm)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${fill}%`,
                      background: bar.color,
                      borderRadius: 3,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>No staff in this group.</div>
        )}
      </div>

      {/* Group Status */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-xl)",
          padding: "1rem 1.125rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--cs-sand-mist)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cs-sand)",
              flexShrink: 0,
            }}
          >
            <Users size={14} />
          </div>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
            {groupLabel}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginLeft: "auto", fontWeight: 500 }}>
            {total} staff
          </span>
        </div>
        {total > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <StatRow label="Following Default" value={followingDefault} pctStr={pct(followingDefault, total)} color="var(--cs-success)" />
            <StatRow label="With Custom Schedule" value={withCustom} pctStr={pct(withCustom, total)} color="var(--cs-warning)" />
            <StatRow label="On Leave Today" value={onLeaveToday} pctStr={pct(onLeaveToday, total)} color="var(--cs-error)" />
          </div>
        ) : (
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>No staff in this group yet.</div>
        )}

        {/* Group rules status */}
        <div
          style={{
            marginTop: 4,
            padding: "0.5rem 0.625rem",
            background: "var(--cs-surface-warm)",
            borderRadius: "var(--cs-r-md)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: 2 }}>Group Rules</div>
          {hasGroupRules ? (
            <div style={{ fontSize: "0.75rem", color: "var(--cs-success)", fontWeight: 500 }}>
              {groupRuleDays} active rule{groupRuleDays !== 1 ? "s" : ""}
            </div>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>No universal rules yet.</div>
          )}
        </div>
      </div>

      {/* Quick Actions — only functional ones */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-xl)",
          padding: "1rem 1.125rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(166,123,91,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cs-sand)",
              flexShrink: 0,
            }}
          >
            <Zap size={14} />
          </div>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
            Quick Actions
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Link
            href="/crm/staff-availability?tab=coverage"
            style={{
              fontSize: "0.8125rem",
              color: "var(--cs-sand)",
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              display: "block",
              fontWeight: 500,
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cs-sand-mist)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cs-surface-warm)";
            }}
          >
            View Coverage Issues ›
          </Link>
          <Link
            href="/crm/staff-availability?tab=individual"
            style={{
              fontSize: "0.8125rem",
              color: "var(--cs-sand)",
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              display: "block",
              fontWeight: 500,
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cs-sand-mist)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cs-surface-warm)";
            }}
          >
            Open Individual Adjustments ›
          </Link>
          <Link
            href="/crm/staff-availability?tab=overrides"
            style={{
              fontSize: "0.8125rem",
              color: "var(--cs-sand)",
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              display: "block",
              fontWeight: 500,
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cs-sand-mist)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cs-surface-warm)";
            }}
          >
            Open Overrides ›
          </Link>
        </div>
      </div>
    </div>
  );
}
