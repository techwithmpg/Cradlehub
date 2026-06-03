import Link from "next/link";
import { CalendarDays, Stethoscope, MapPin, TrendingUp } from "lucide-react";

const ACTIONS = [
  {
    label: "My Schedule",
    href: "/staff-portal/schedule",
    icon: CalendarDays,
    desc: "View your shifts",
  },
  {
    label: "Service Progress",
    href: "/staff-portal/service-progress",
    icon: Stethoscope,
    desc: "Track your services",
  },
  {
    label: "Dispatch",
    href: "/staff-portal/dispatch",
    icon: MapPin,
    desc: "Home service jobs",
  },
  {
    label: "My Stats",
    href: "/staff-portal/stats",
    icon: TrendingUp,
    desc: "Performance & earnings",
  },
] as const;

export function TherapistQuickActions() {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cs-text-muted)",
          marginBottom: "0.5rem",
        }}
      >
        Quick Actions
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "0.5rem",
        }}
      >
        {ACTIONS.map(({ label, href, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            style={{
              textDecoration: "none",
              backgroundColor: "#fff",
              borderRadius: 14,
              border: "1px solid var(--cs-border-soft)",
              padding: "0.875rem 0.875rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              boxShadow: "var(--cs-shadow-xs)",
              minHeight: 86,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={17} color="var(--cs-staff-accent)" />
            </div>
            <div>
              <div
                style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", lineHeight: 1.25 }}
              >
                {label}
              </div>
              <div
                style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2, lineHeight: 1.3 }}
              >
                {desc}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
