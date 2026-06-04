import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

type TherapistStatsData = {
  total_assigned: number;
  completed: number;
  cancelled: number;
  no_show: number;
  revenue_generated: number;
};

type TherapistStatsProps = {
  stats: TherapistStatsData;
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  isFuture: boolean;
};

const NAV_LINK: React.CSSProperties = {
  padding: "5px 14px", borderRadius: 8,
  border: "1px solid var(--cs-border)", backgroundColor: "var(--cs-surface-warm)",
  color: "var(--cs-text-muted)", fontSize: "0.8rem", textDecoration: "none",
  display: "inline-flex", alignItems: "center", fontWeight: 500,
};

type StatRow = { label: string; value: string; sub: string; accent?: boolean };

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
        <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2, lineHeight: 1.3 }}>{sub}</div>
      </div>
      <div
        style={{
          fontSize: 20, fontWeight: 700,
          color: accent ? "var(--cs-staff-accent)" : "var(--cs-text)",
          fontVariantNumeric: "tabular-nums", textAlign: "right", flexShrink: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)",
        padding: "2.5rem 1.5rem", textAlign: "center", boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: "0.75rem" }}>📊</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)", marginBottom: "0.375rem" }}>
        No completed services yet
      </div>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
        Your stats will appear after your assigned services are completed.
      </div>
    </div>
  );
}

export function TherapistStats({ stats, monthLabel, prevHref, nextHref, isFuture }: TherapistStatsProps) {
  const completionRate = stats.total_assigned > 0 ? Math.round((stats.completed / stats.total_assigned) * 100) : 0;
  const hasData = stats.total_assigned > 0;

  const statRows: StatRow[] = [
    { label: "Services Completed", value: String(stats.completed), sub: "This month", accent: true },
    { label: "Revenue Generated", value: formatCurrency(stats.revenue_generated), sub: "From completed sessions", accent: true },
    { label: "Total Assigned", value: String(stats.total_assigned), sub: "Bookings" },
    { label: "Completion Rate", value: `${completionRate}%`, sub: "Completed / Assigned", accent: completionRate >= 80 },
    { label: "Cancellations", value: String(stats.cancelled), sub: "Cancelled bookings" },
    { label: "No Shows", value: String(stats.no_show), sub: "No show bookings" },
  ];

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem", position: "sticky", top: 0, zIndex: 30 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>My Stats</h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--cs-text-muted)" }}>{monthLabel}</p>
      </div>

      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {/* Month navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "space-between" }}>
          <Link href={prevHref} style={NAV_LINK}>← Prev</Link>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", textAlign: "center", flex: 1 }}>{monthLabel}</span>
          {!isFuture ? <Link href={nextHref} style={NAV_LINK}>Next →</Link> : <div style={{ minWidth: 60 }} />}
        </div>

        {hasData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {statRows.map((row) => <StatCard key={row.label} {...row} />)}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
