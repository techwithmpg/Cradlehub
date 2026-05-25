/**
 * ScheduleRelatedTools
 *
 * Footer section surfacing quick links to the CRM tools most closely
 * connected to schedule configuration — so CRM staff can jump between
 * related workspaces without navigating the sidebar manually.
 *
 * Server component — no client state, no queries.
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
    icon: "✅",
    title: "Live Availability",
    description:
      "See who has checked in today, mark staff present or absent, and manage real-time presence for in-house operations.",
    href: "/crm/availability",
    label: "Open Live Availability →",
  },
  {
    icon: "📋",
    title: "Daily Operations Center",
    description:
      "Today's bookings, dispatch queue, and operational health snapshot. Schedule data feeds into this view's availability calculations.",
    href: "/crm/today",
    label: "Open Today's Center →",
  },
  {
    icon: "✨",
    title: "Services & Therapist Setup",
    description:
      "Manage which staff members are assigned to each service. A therapist needs both an active schedule and a service assignment to appear in the booking wizard.",
    href: "/crm/services",
    label: "Open Services Setup →",
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
        <span style={{ fontSize: 18, flexShrink: 0 }}>{tool.icon}</span>
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
          lineHeight: 1.55,
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

export function ScheduleRelatedTools() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Section label */}
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

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
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
