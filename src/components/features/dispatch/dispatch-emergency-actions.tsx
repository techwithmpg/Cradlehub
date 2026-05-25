/**
 * DispatchEmergencyActions
 *
 * Emergency link card for quick navigation to related operational pages.
 * Links only — no mutation logic.
 */

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

const EMERGENCY_LINKS = [
  { label: "Review Home-Service Bookings", href: "/crm/bookings" },
  { label: "Open Live Availability", href: "/crm/availability" },
  { label: "Open Schedule Setup", href: "/crm/staff-availability" },
  { label: "Open Daily Operations", href: "/crm/today" },
  { label: "Open Customer Records", href: "/crm/customers" },
  { label: "Open Notifications", href: "/crm/notifications" },
];

export function DispatchEmergencyActions() {
  return (
    <div className="cs-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--cs-error)" }}
        />
        <h3
          style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}
        >
          Emergency Dispatch Actions
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EMERGENCY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: "block",
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--cs-border)",
              borderRadius: "var(--cs-r-sm)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--cs-text-secondary)",
              textDecoration: "none",
              transition: "border-color 0.15s, color 0.15s",
            }}
            className="hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)]"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
