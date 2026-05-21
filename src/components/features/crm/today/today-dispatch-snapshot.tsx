import Link from "next/link";
import type { DispatchStats } from "@/lib/queries/crm-today";

type Props = {
  stats: DispatchStats;
};

export function TodayDispatchSnapshot({ stats }: Props) {
  if (stats.totalToday === 0) return null;

  const rows = [
    {
      label: "Awaiting Dispatch",
      value: stats.awaitingDispatch,
      color:
        stats.awaitingDispatch > 0 ? "var(--cs-warning)" : "var(--cs-text-muted)",
    },
    {
      label: "Active Trips",
      value: stats.activeTrips,
      color: stats.activeTrips > 0 ? "var(--cs-sand)" : "var(--cs-text-muted)",
    },
    {
      label: "Completed",
      value: stats.completedToday,
      color: "var(--cs-success)",
    },
  ];

  return (
    <div className="cs-card" style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.875rem",
        }}
      >
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
          }}
        >
          Home Service
        </div>
        <Link
          href="/crm/dispatch"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-brand)",
            textDecoration: "none",
          }}
        >
          Dispatch →
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.4rem 0.625rem",
              borderRadius: "var(--cs-r-sm)",
              backgroundColor: "var(--cs-surface-warm)",
            }}
          >
            <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>
              {row.label}
            </span>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: row.color,
                minWidth: 18,
                textAlign: "right",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
