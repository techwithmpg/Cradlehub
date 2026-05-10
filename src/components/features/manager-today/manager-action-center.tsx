"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, CalendarDays, Users, Building2, ChevronRight } from "lucide-react";
import { WalkinDialog } from "./walkin-dialog";

const ACTIONS = [
  {
    id: "walkin",
    label: "New Walk-in",
    desc: "Create a walk-in booking",
    icon: Plus,
    href: null,
    color: "var(--cs-sand)",
  },
  {
    id: "booking",
    label: "New Booking",
    desc: "Schedule a new appointment",
    icon: CalendarDays,
    href: "/crm/bookings/new",
    color: "var(--cs-sand)",
  },
  {
    id: "schedule",
    label: "View Schedule",
    desc: "Full day timeline",
    icon: CalendarDays,
    href: "/manager/schedule",
    color: "var(--cs-manager-accent)",
  },
  {
    id: "bookings",
    label: "View Bookings",
    desc: "All bookings list",
    icon: CalendarDays,
    href: "/manager/bookings",
    color: "var(--cs-manager-accent)",
  },
  {
    id: "spaces",
    label: "Assign Room",
    desc: "Manage spaces & rules",
    icon: Building2,
    href: "/manager/spaces-rules",
    color: "var(--cs-manager-accent)",
  },
  {
    id: "staff",
    label: "Manage Staff",
    desc: "Staff schedules",
    icon: Users,
    href: "/manager/staff",
    color: "var(--cs-manager-accent)",
  },
];

export function ManagerActionCenter() {
  const [walkinOpen, setWalkinOpen] = useState(false);

  return (
    <div className="cs-card" style={{ padding: "1.25rem" }}>
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "1rem",
        }}
      >
        Action Center
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const content = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--cs-r-sm)",
                backgroundColor: "var(--cs-surface-warm)",
                cursor: action.href ? "pointer" : "pointer",
                transition: "var(--cs-trans)",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: `${action.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={14} style={{ color: action.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--cs-text)",
                    lineHeight: 1.3,
                  }}
                >
                  {action.label}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                  {action.desc}
                </div>
              </div>
              <ChevronRight size={14} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
            </div>
          );

          if (action.id === "walkin") {
            return (
              <button
                key={action.id}
                onClick={() => setWalkinOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={action.id}
              href={action.href!}
              style={{ textDecoration: "none", display: "block" }}
            >
              {content}
            </Link>
          );
        })}
      </div>

      <WalkinDialog open={walkinOpen} onOpenChange={setWalkinOpen} />
    </div>
  );
}
