"use client";

import Link from "next/link";

const ACTIONS = [
  { label: "New In-House Booking", href: "/crm/bookings/new", primary: true },
  { label: "Search Customer", href: "/crm/customers" },
  { label: "Schedule", href: "/crm/schedule" },
  { label: "All Bookings", href: "/crm/bookings" },
];

export function TodayQuickActions() {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
      }}
    >
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
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
