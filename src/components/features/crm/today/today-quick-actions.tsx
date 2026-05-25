"use client";

import Link from "next/link";

type Action = {
  label: string;
  description: string;
  href: string;
  primary?: boolean;
};

const ACTIONS: Action[] = [
  {
    label: "New Walk-in",
    description: "Create an in-spa booking for a customer at the front desk.",
    href: "/crm/bookings/new?type=walkin",
    primary: true,
  },
  {
    label: "New Home Service",
    description: "Start a home-service booking with address and dispatch details.",
    href: "/crm/bookings/new?type=home_service",
  },
  {
    label: "Online Requests",
    description: "Review online bookings that need CRM attention.",
    href: "/crm/bookings?status=pending",
  },
  {
    label: "Search Customer",
    description: "Find customer records, repeat clients, and history.",
    href: "/crm/customers",
  },
  {
    label: "Live Availability",
    description: "See who is checked in, busy, missing, or available now.",
    href: "/crm/availability",
  },
];

export function TodayQuickActions() {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
      }}
    >
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          title={action.description}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            backgroundColor: action.primary
              ? "var(--cs-sand)"
              : "var(--cs-surface)",
            color: action.primary ? "#fff" : "var(--cs-text)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: action.primary ? "none" : "1px solid var(--cs-border)",
            transition: "all 0.15s",
          }}
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
