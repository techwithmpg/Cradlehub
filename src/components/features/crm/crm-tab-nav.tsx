import Link from "next/link";

export type CrmTabItem = {
  label: string;
  href?: string;
  disabled?: boolean;
};

// ── Per-section tab configs ───────────────────────────────────────────────────

export const TODAY_TABS: CrmTabItem[] = [
  { label: "Overview",         href: "/crm/today"   },
  { label: "Control Center",   href: "/crm/control" },
  { label: "Payments Pending", disabled: true        },
  { label: "Action Required",  disabled: true        },
];

export const BOOKINGS_TABS: CrmTabItem[] = [
  { label: "Today's Bookings", href: "/crm/bookings"     },
  { label: "New Booking",      href: "/crm/bookings/new" },
];

export const SCHEDULE_TABS: CrmTabItem[] = [
  { label: "Daily Timeline",    href: "/crm/schedule"           },
  { label: "Live Availability", href: "/crm/availability"       },
  { label: "Schedule Setup",    href: "/crm/staff-availability" },
];

export const CUSTOMERS_TABS: CrmTabItem[] = [
  { label: "All Customers",      href: "/crm/customers" },
  { label: "Repeat Clients",     href: "/crm/repeats"   },
  { label: "Lapsed Clients",     href: "/crm/lapsed"    },
  { label: "Waitlist / Follow-up", href: "/crm/waitlist"  },
];

/**
 * SETUP_TABS — retained for backward compatibility with any code that still
 * references it. New links should go directly to /crm/setup?tab=...
 * Old routes /crm/services and /crm/spaces-rules now redirect to Setup Center.
 */
export const SETUP_TABS: CrmTabItem[] = [
  { label: "Setup Health",   href: "/crm/setup?tab=health"  },
  { label: "Services",       href: "/crm/setup?tab=services" },
  { label: "Spaces & Rules", href: "/crm/setup?tab=spaces"  },
];

export const CRM_SERVICES_TABS: CrmTabItem[] = [
  { label: "Services",            href: "/crm/services?tab=services"       },
  { label: "Service Customization", href: "/crm/services?tab=customization"  },
  { label: "Provider Assignments",  href: "/crm/services?tab=providers"      },
  { label: "Readiness Issues",      href: "/crm/services?tab=issues"         },
];

export const DISPATCH_TABS: CrmTabItem[] = [
  { label: "Dispatch Queue", href: "/crm/dispatch"        },
  { label: "Live Map",       href: "/crm/live-operations" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function CrmTabNav({
  tabs,
  activeHref,
}: {
  tabs: CrmTabItem[];
  activeHref: string;
}) {
  return (
    <nav
      style={{
        display: "flex",
        gap: "0.375rem",
        marginBottom: "1.25rem",
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.href === activeHref;

        if (tab.disabled || !tab.href) {
          return (
            <span
              key={i}
              title="Coming soon"
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text-muted)",
                fontSize: "0.8125rem",
                opacity: 0.4,
                cursor: "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: `1px solid ${isActive ? "var(--cs-sand)" : "var(--cs-border)"}`,
              backgroundColor: isActive ? "var(--cs-sand-mist)" : "var(--cs-surface)",
              color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
              fontSize: "0.8125rem",
              fontWeight: isActive ? 600 : 400,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
