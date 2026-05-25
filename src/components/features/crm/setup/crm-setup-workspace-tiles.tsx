import Link from "next/link";

type WorkspaceTile = {
  icon: string;
  label: string;
  description: string;
  href: string;
  badge?: string;
};

const TILES: WorkspaceTile[] = [
  {
    icon: "✨",
    label: "Services & Therapists",
    description: "Control which services are active, where they are offered, and which therapists can perform them. Review or manage therapist-service assignments where available.",
    href: "/crm/services",
  },
  {
    icon: "🗓️",
    label: "Schedule Setup",
    description: "Configure weekly schedules, split shifts, individual adjustments, overrides, and blocked time. Used by online booking and CRM operations.",
    href: "/crm/staff-availability",
  },
  {
    icon: "🏠",
    label: "Spaces & Rules",
    description: "View and manage rooms, resources, in-spa service hours, home-service windows, slot intervals, and branch booking rules.",
    href: "/crm/spaces-rules",
  },
  {
    icon: "✅",
    label: "Live Availability",
    description: "See who is scheduled, checked in, busy, or off today. Check in staff to mark them available for CRM in-house operations.",
    href: "/crm/availability",
  },
  {
    icon: "🚗",
    label: "Dispatch",
    description: "Review home-service dispatch queue, driver readiness, active trips, and zone/location details for today's home-service bookings.",
    href: "/crm/dispatch",
  },
  {
    icon: "📋",
    label: "Daily Operations Center",
    description: "Return to today's front-desk view — booking queue, staff readiness, quick actions, and day progress.",
    href: "/crm/today",
  },
];

export function CrmSetupWorkspaceTiles() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "0.875rem",
      }}
    >
      {TILES.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "1rem 1.125rem",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: "var(--cs-r-md, 10px)",
            textDecoration: "none",
            color: "var(--cs-text)",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{tile.icon}</span>
            <span
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                flex: 1,
              }}
            >
              {tile.label}
            </span>
            <span style={{ color: "var(--cs-text-muted)", fontSize: 14 }}>›</span>
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
            {tile.description}
          </div>
        </Link>
      ))}
    </div>
  );
}
