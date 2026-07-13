import Link from "next/link";

// ── Tool definitions ──────────────────────────────────────────────────────────

type ToolCard = {
  icon: string;
  title: string;
  description: string;
  href: string;
  label: string;
};

const TOOLS: ToolCard[] = [
  {
    icon: "📋",
    title: "Daily Operations Center",
    description: "Today's full operational view — bookings, walk-ins, check-ins, and live alerts.",
    href: "/crm/today",
    label: "Open Today",
  },
  {
    icon: "📅",
    title: "Schedule Setup",
    description: "Set weekly schedules, blocked time, and overrides that control online booking availability.",
    href: "/crm/schedule?tab=setup",
    label: "Manage Schedules",
  },
  {
    icon: "🚐",
    title: "Dispatch",
    description: "Assign and track home-service trips, driver routes, and therapist dispatch.",
    href: "/crm/dispatch",
    label: "Open Dispatch",
  },
  {
    icon: "✨",
    title: "Services & Therapist Setup",
    description: "Assign service providers, manage active services, and control in-spa / home-service visibility.",
    href: "/crm/services",
    label: "Manage Services",
  },
  {
    icon: "🏠",
    title: "Spaces & Booking Rules",
    description: "Manage rooms, resources, and booking time windows for all booking flows.",
    href: "/crm/spaces-rules",
    label: "Manage Spaces",
  },
  {
    icon: "⚙️",
    title: "Rules & Setup Center",
    description: "View booking flow rules, coverage settings, and system configuration.",
    href: "/crm/setup",
    label: "Open Setup",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function AvailabilityRelatedTools() {
  return (
    <div style={{ borderTop: "1px solid var(--cs-border-soft)", paddingTop: "1.5rem" }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          marginBottom: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Related Tools
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {TOOLS.map((tool) => (
          <div
            key={tool.href}
            className="cs-card"
            style={{ padding: "0.875rem 1rem" }}
          >
            <div style={{ fontSize: 18, marginBottom: "0.4rem" }}>{tool.icon}</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--cs-text)",
                marginBottom: "0.25rem",
              }}
            >
              {tool.title}
            </div>
            <p
              style={{
                fontSize: 11,
                color: "var(--cs-text-muted)",
                margin: "0 0 0.625rem",
                lineHeight: 1.5,
              }}
            >
              {tool.description}
            </p>
            <Link
              href={tool.href}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--cs-text)",
                textDecoration: "none",
                borderBottom: "1px solid var(--cs-border-soft)",
              }}
            >
              {tool.label} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
