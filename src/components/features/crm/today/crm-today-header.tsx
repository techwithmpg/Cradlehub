"use client";

import Link from "next/link";

export function CrmTodayHeader({
  branchName,
  dateLabel,
  roleLabel,
}: {
  branchName: string;
  dateLabel: string;
  roleLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "1.25rem",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.2rem" }}>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--cs-text)",
              margin: 0,
              lineHeight: 1.25,
              fontFamily: "var(--font-display)",
            }}
          >
            Work Queue
          </h1>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--cs-r-pill)",
              background: "var(--cs-sand-mist)",
              color: "var(--cs-sand)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {roleLabel}
          </span>
        </div>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          One prioritized list for confirmations, follow-up, exceptions, and home-service work.
        </p>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-subtle)",
            margin: "0.125rem 0 0",
          }}
        >
          {branchName} · {dateLabel}
        </p>
      </div>

      <Link
        href="/crm/bookings/new"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderRadius: "var(--cs-r-md)",
          backgroundColor: "var(--cs-sand)",
          color: "#fff",
          fontSize: "0.8125rem",
          fontWeight: 600,
          textDecoration: "none",
          flexShrink: 0,
          transition: "opacity 150ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = "1";
        }}
      >
        + New Booking
      </Link>
    </div>
  );
}
