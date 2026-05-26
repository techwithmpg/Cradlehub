/**
 * CrmSpacesQuickActions
 *
 * Quick links to related CRM tools from the Spaces & Availability page.
 * Server component — no client state.
 */

import Link from "next/link";
import { Calendar, Users, Truck, Settings, Clock, ExternalLink } from "lucide-react";

type QuickAction = {
  icon: typeof Calendar;
  label: string;
  href: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Calendar, label: "Bookings", href: "/crm/bookings" },
  { icon: Users, label: "Availability", href: "/crm/availability" },
  { icon: Truck, label: "Dispatch", href: "/crm/dispatch" },
  { icon: Clock, label: "Schedule Setup", href: "/crm/staff-availability" },
  { icon: Settings, label: "Rules & Setup", href: "/crm/setup" },
];

export function CrmSpacesQuickActions() {
  return (
    <div
      className="cs-card"
      style={{
        padding: "1rem",
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.625rem",
        }}
      >
        Quick Actions
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5rem 0.625rem",
              borderRadius: 6,
              backgroundColor: "var(--cs-surface-warm)",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "var(--cs-text)",
              textDecoration: "none",
              transition: "background-color 0.15s ease",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <action.icon size={13} style={{ color: "var(--cs-text-muted)" }} />
              {action.label}
            </span>
            <ExternalLink size={11} style={{ color: "var(--cs-text-muted)" }} />
          </Link>
        ))}
      </div>

      <div
        style={{
          marginTop: "0.75rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--cs-border-soft)",
          fontSize: "0.6875rem",
          color: "var(--cs-text-muted)",
          lineHeight: 1.5,
        }}
      >
        <strong>Tip:</strong> Use this page to check room availability before confirming walk-ins or
        reassigning bookings.
      </div>
    </div>
  );
}
