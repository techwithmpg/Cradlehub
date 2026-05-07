import { PageHeader } from "@/components/features/dashboard/page-header";
import Link from "next/link";

const AVAILABLE_TOOLS = [
  { icon: "📋", label: "Today\u2019s Control Center", desc: "Live bookings, issues, and quick actions", href: "/manager" },
  { icon: "📅", label: "Booking Management", desc: "View, edit, and transition booking statuses", href: "/manager/bookings" },
  { icon: "👥", label: "Staff Schedule & Time-Off", desc: "Weekly hours, day overrides, and blocked time windows", href: "/manager/staff" },
  { icon: "🏠", label: "Space Utilization", desc: "Room and bed occupancy for any date", href: "/manager/resources" },
];

const COMING_SOON = [
  { icon: "🚗", label: "Driver Dispatch", desc: "Assign drivers to home service appointments" },
  { icon: "🧹", label: "Utility Task Management", desc: "Track cleaning, maintenance, and support tasks" },
  { icon: "🎧", label: "CSR Shift Tracking", desc: "Front-desk coverage and handover logs" },
  { icon: "⚖️", label: "Staff Workload Balancing", desc: "Evenly distribute appointments across therapists" },
  { icon: "📝", label: "Branch Issue Log", desc: "Record and track operational incidents" },
  { icon: "✅", label: "Daily Closing Checklist", desc: "End-of-day tasks and verification" },
];

export default function ManagerOperationsPage() {
  return (
    <div>
      <PageHeader
        title="Operations"
        description="Tools and modules for daily branch management"
        icon="⚙️"
      />

      {/* Available now */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "0.75rem",
          }}
        >
          Available Now
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {AVAILABLE_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "1rem",
                borderRadius: "var(--cs-r-lg)",
                backgroundColor: "var(--cs-surface)",
                border: "1px solid var(--cs-border-soft)",
                boxShadow: "var(--cs-shadow-sm)",
                textDecoration: "none",
                color: "var(--cs-text)",
                transition: "var(--cs-trans)",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tool.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--cs-text)",
                    marginBottom: 2,
                  }}
                >
                  {tool.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
                  {tool.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Coming soon */}
      <div>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "0.75rem",
          }}
        >
          Coming Soon
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {COMING_SOON.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "1rem",
                borderRadius: "var(--cs-r-lg)",
                backgroundColor: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border-soft)",
                opacity: 0.7,
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, filter: "grayscale(0.6)" }}>{item.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--cs-text-muted)",
                    marginBottom: 2,
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

