/**
 * SpacesRulesRelatedTools
 *
 * Footer row of quick links to the CRM tools most connected to spaces and
 * booking rule configuration. Server component — no client state, no queries.
 */

import Link from "next/link";

type ToolLink = {
  icon: string;
  title: string;
  description: string;
  href: string;
  label: string;
};

const TOOL_LINKS: ToolLink[] = [
  {
    icon: "📋",
    title: "Daily Operations Center",
    description:
      "Today's bookings, resource usage snapshot, and operational health. Room assignments and availability reflect here in real time.",
    href: "/crm/today",
    label: "Open Today's Center →",
  },
  {
    icon: "✅",
    title: "Live Availability",
    description:
      "Daily staff check-in, live presence, and same-day operational readiness. CRM uses this alongside room availability for walk-ins.",
    href: "/crm/availability",
    label: "Open Live Availability →",
  },
  {
    icon: "✨",
    title: "Services & Therapist Setup",
    description:
      "Manage which staff are assigned to each service. Resources and booking rules combine with provider assignments to determine slot availability.",
    href: "/crm/services",
    label: "Open Services Setup →",
  },
  {
    icon: "📅",
    title: "Schedule Setup Center",
    description:
      "Staff schedules, overrides, and blocked time. Schedules are the primary availability source for online booking.",
    href: "/crm/staff-availability",
    label: "Open Schedule Setup →",
  },
  {
    icon: "⚙️",
    title: "Rules & Setup Center",
    description:
      "Booking flow rules overview, impact matrix, and system health. See how all rules interact across booking flows.",
    href: "/crm/setup",
    label: "Open Rules Center →",
  },
];

function ToolCard({ tool }: { tool: ToolLink }) {
  return (
    <div
      className="cs-card"
      style={{
        padding: "1rem 1.125rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{tool.icon}</span>
        <span
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
          }}
        >
          {tool.title}
        </span>
      </div>

      <div
        style={{
          fontSize: "0.8125rem",
          color: "var(--cs-text-muted)",
          lineHeight: 1.5,
          flex: 1,
        }}
      >
        {tool.description}
      </div>

      <div>
        <Link
          href={tool.href}
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--cs-brand)",
            textDecoration: "none",
            padding: "3px 10px",
            borderRadius: 20,
            border: "1px solid var(--cs-border-soft)",
            background: "var(--cs-surface-warm)",
            display: "inline-block",
          }}
        >
          {tool.label}
        </Link>
      </div>
    </div>
  );
}

export function SpacesRulesRelatedTools() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Related Tools
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {TOOL_LINKS.map((tool) => (
          <ToolCard key={tool.href} tool={tool} />
        ))}
      </div>
    </div>
  );
}
