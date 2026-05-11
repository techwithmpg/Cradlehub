"use client";

import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  MoreHorizontal,
} from "lucide-react";
import type { MobileTab } from "./types";

const TABS: { key: MobileTab; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { key: "today", label: "Today", icon: LayoutDashboard },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "Bookings", icon: ClipboardList },
  { key: "staff", label: "Staff", icon: Users },
  { key: "more", label: "More", icon: MoreHorizontal },
];

export function ManagerBottomNav({
  active,
  onChange,
}: {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{
        background: "var(--cs-surface)",
        borderColor: "var(--cs-border-soft)",
        boxShadow: "0 -2px 12px rgba(30,25,22,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Manager mobile navigation"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "4px 0 6px",
          maxWidth: 430,
          margin: "0 auto",
        }}
      >
        {TABS.map((t) => {
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-label={t.label}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "5px 8px",
                borderRadius: 10,
                border: "none",
                background: isActive ? "var(--cs-sand-tint)" : "transparent",
                color: isActive ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
                cursor: "pointer",
                transition: "background-color 150ms ease, color 150ms ease",
                minWidth: 52,
                flex: 1,
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "0.01em",
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
