/**
 * ScheduleRelatedTools
 *
 * Compact footer links to related CRM tools.
 * Server component — no client state, no queries.
 */

import Link from "next/link";

const TOOL_LINKS = [
  { icon: "✅", title: "Daily Timeline", href: "/crm/schedule" },
  { icon: "📋", title: "Daily Operations", href: "/crm/today" },
  { icon: "✨", title: "Services & Therapists", href: "/crm/services" },
] as const;

export function ScheduleRelatedTools() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
        padding: "10px 14px",
        background: "var(--cs-surface-warm)",
        borderRadius: "var(--cs-r-sm)",
        border: "1px solid var(--cs-border-soft)",
      }}
    >
      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Related:
      </span>
      {TOOL_LINKS.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--cs-sand)",
            textDecoration: "none",
            padding: "3px 10px",
            borderRadius: "var(--cs-r-sm)",
            border: "1px solid var(--cs-border-soft)",
            background: "var(--cs-surface)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{tool.icon}</span>
          {tool.title}
        </Link>
      ))}
    </div>
  );
}
