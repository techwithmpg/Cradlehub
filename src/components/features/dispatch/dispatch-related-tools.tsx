/**
 * DispatchRelatedTools
 *
 * Related tool navigation links for the dispatch workspace.
 * Links only — no mutation logic.
 */

import Link from "next/link";
import { Wrench } from "lucide-react";

const RELATED_TOOLS = [
  { label: "Daily Operations Center", href: "/crm/today" },
  { label: "Daily Timeline", href: "/crm/schedule" },
  { label: "Schedule Setup", href: "/crm/schedule?tab=setup" },
  { label: "Services & Therapist Setup", href: "/crm/services" },
  { label: "Spaces & Booking Rules", href: "/crm/spaces-rules" },
  { label: "Rules & Setup Center", href: "/crm/setup" },
];

export function DispatchRelatedTools() {
  return (
    <div className="cs-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Wrench
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--cs-text-muted)" }}
        />
        <h3
          style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}
        >
          Related Tools
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {RELATED_TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            style={{
              display: "block",
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--cs-border-soft)",
              borderRadius: "var(--cs-r-sm)",
              fontSize: "0.8125rem",
              color: "var(--cs-text-secondary)",
              textDecoration: "none",
              transition: "border-color 0.15s, color 0.15s",
            }}
            className="hover:border-[var(--cs-border)] hover:text-[var(--cs-text)]"
          >
            {tool.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
