import Link from "next/link";
import { StaffMobileBottomNav } from "@/components/features/staff-portal/mobile/staff-mobile-bottom-nav";
import type { MonthlyScheduleStats } from "@/app/(dashboard)/staff-portal/actions";

type BasicStaffStatsProps = {
  stats: MonthlyScheduleStats;
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  isFuture: boolean;
};

type StatRow = {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
};

const NAV_LINK: React.CSSProperties = {
  padding: "5px 14px",
  borderRadius: 8,
  border: "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface-warm)",
  color: "var(--cs-text-muted)",
  fontSize: "0.8rem",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  fontWeight: 500,
};

function StatCard({ label, value, sub, accent = false }: StatRow) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 14,
        border: `1px solid ${accent ? "rgba(90,138,106,0.2)" : "var(--cs-border-soft)"}`,
        padding: "0.875rem 1rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", fontWeight: 500, lineHeight: 1.3 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--cs-text-muted)",
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {sub}
        </div>
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: accent ? "var(--cs-staff-accent)" : "var(--cs-text)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyStatsState() {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: "0.75rem" }}>📋</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--cs-text)",
          marginBottom: "0.375rem",
        }}
      >
        No completed shifts yet
      </div>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
        Stats will appear once your shifts are scheduled and completed.
      </div>
    </div>
  );
}

export function BasicStaffStats({
  stats,
  monthLabel,
  prevHref,
  nextHref,
  isFuture,
}: BasicStaffStatsProps) {
  const hasData = stats.workingDays > 0 || stats.daysOff > 0;

  const statRows: StatRow[] = [
    {
      label: "Working Days",
      value: `${stats.workingDays}`,
      sub: "Days",
      accent: true,
    },
    {
      label: "Days Off",
      value: `${stats.daysOff}`,
      sub: "Days",
    },
    {
      label: "Shifts Scheduled",
      value: `${stats.workingDays}`,
      sub: "Shifts",
      accent: true,
    },
    {
      label: "Hours Scheduled",
      value: `${stats.hoursScheduled}h`,
      sub: "Total",
      accent: true,
    },
    {
      label: "Avg Daily Hours",
      value: `${stats.avgDailyHours}h`,
      sub: "Per Day",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
        paddingBottom: 96,
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid var(--cs-border-soft)",
          padding: "0.875rem 1rem",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 700,
            color: "var(--cs-text)",
            lineHeight: 1.2,
          }}
        >
          My Stats
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--cs-text-muted)" }}>
          {monthLabel}
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {/* Month navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            justifyContent: "space-between",
          }}
        >
          <Link href={prevHref} style={NAV_LINK}>
            ← Prev
          </Link>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--cs-text)",
              textAlign: "center",
              flex: 1,
            }}
          >
            {monthLabel}
          </span>
          {!isFuture ? (
            <Link href={nextHref} style={NAV_LINK}>
              Next →
            </Link>
          ) : (
            <div style={{ minWidth: 60 }} />
          )}
        </div>

        {/* Stat cards or empty state */}
        {hasData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {statRows.map((row) => (
              <StatCard key={row.label} {...row} />
            ))}
          </div>
        ) : (
          <EmptyStatsState />
        )}
      </div>

      <StaffMobileBottomNav />
    </div>
  );
}
