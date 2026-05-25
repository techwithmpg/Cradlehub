import Link from "next/link";
import type { CrmAvailabilitySummary } from "@/lib/queries/crm-today";

type Props = {
  summary: CrmAvailabilitySummary;
};

type Row = {
  label: string;
  value: number;
  color: string;
};

export function TodayStaffReadiness({ summary }: Props) {
  const rows: Row[] = [
    {
      label: "Checked In",
      value: summary.checkedIn,
      color: "var(--cs-success)",
    },
    {
      label: "Available Now",
      value: summary.availableNow,
      color: "var(--cs-success)",
    },
    {
      label: "Busy",
      value: summary.busyNow,
      color: "var(--cs-sand)",
    },
    {
      label: "Not Checked In",
      value: summary.notCheckedIn,
      color: summary.notCheckedIn > 0 ? "var(--cs-info)" : "var(--cs-text-muted)",
    },
    {
      label: "Checked Out",
      value: summary.checkedOut,
      color: "var(--cs-text-muted)",
    },
  ];

  const hasDrivers = summary.driversTotal > 0;

  return (
    <div className="cs-card" style={{ padding: "1.25rem" }}>
      {/* Start Day label */}
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-sand)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.375rem",
        }}
      >
        Start Day
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          marginBottom: "0.75rem",
          lineHeight: 1.4,
        }}
      >
        Check who is present, missing, and ready before accepting walk-ins.
      </div>

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
          Staff Readiness
        </div>
        <Link
          href="/crm/availability"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-brand)",
            textDecoration: "none",
          }}
        >
          Full View →
        </Link>
      </div>

      {/* Scheduled total pill */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          marginBottom: "0.625rem",
        }}
      >
        {summary.scheduledToday} of {summary.total} scheduled today
      </div>

      {/* Status rows */}
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

      {/* Drivers sub-section */}
      {hasDrivers && (
        <div
          style={{
            marginTop: "0.75rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--cs-border-soft)",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.375rem",
            }}
          >
            Drivers
          </div>
          <div
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
              Ready
            </span>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color:
                  summary.driversReady > 0 ? "var(--cs-success)" : "var(--cs-error)",
              }}
            >
              {summary.driversReady} / {summary.driversTotal}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
