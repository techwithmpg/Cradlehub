/**
 * TodayEmergencyActions
 *
 * Mid-shift action links for when operations change during the day.
 * Navigation only — no new mutation logic in Phase 2.
 */

import Link from "next/link";

type EmergencyLink = {
  label: string;
  href: string;
};

const EMERGENCY_LINKS: EmergencyLink[] = [
  { label: "Reassign / Review Booking", href: "/crm/bookings" },
  { label: "Open Cradle Flow", href: "/crm/today?filter=exceptions" },
  { label: "Open Dispatch", href: "/crm/dispatch" },
  { label: "Review Daily Timeline", href: "/crm/schedule" },
  { label: "Review Alerts", href: "/crm/notifications" },
  { label: "Open Schedule", href: "/crm/schedule" },
];

export function TodayEmergencyActions() {
  return (
    <div className="cs-card" style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "0.875rem" }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.25rem",
          }}
        >
          Emergency Actions
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          Use these tools when operations change during the day.
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        {EMERGENCY_LINKS.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--cs-border)",
              background: "var(--cs-surface)",
              color: "var(--cs-text)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              transition: "border-color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
