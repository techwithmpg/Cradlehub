/**
 * TodaySystemMatchStatus
 *
 * Orientation card explaining what the CRM system tracks and linking to each
 * operational tool. Informational / navigation only in Phase 2 — no new queries,
 * no readiness calculations, no mutations.
 */

import Link from "next/link";

type SystemLink = {
  label: string;
  description: string;
  href: string;
};

const SYSTEM_LINKS: SystemLink[] = [
  {
    label: "Staff readiness",
    description: "See who is checked in, missing, busy, or available now.",
    href: "/crm/availability",
  },
  {
    label: "Services & therapists",
    description: "Review active services and therapist capability setup.",
    href: "/crm/services",
  },
  {
    label: "Rooms & spaces",
    description: "Review room/resource readiness and booking rules.",
    href: "/crm/spaces-rules",
  },
  {
    label: "Schedule setup",
    description: "Review staff schedules, overrides, and blocked time.",
    href: "/crm/staff-availability",
  },
  {
    label: "Dispatch readiness",
    description: "Review home-service dispatch and driver operations.",
    href: "/crm/dispatch",
  },
  {
    label: "Rules & setup",
    description: "Review the rules the system is currently following.",
    href: "/crm/setup",
  },
];

export function TodaySystemMatchStatus() {
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
          System Match Status
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
          The system uses schedules, staff services, blocked time, bookings, rooms, and dispatch
          rules to guide CRM actions.
        </div>
      </div>

      {/* Link grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {SYSTEM_LINKS.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--cs-r-sm)",
                background: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border-soft)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                transition: "border-color 0.15s",
              }}
            >
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--cs-text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {item.description}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
