"use client";

import { useRef, useEffect, useState } from "react";

export type ScheduleTabKey =
  | "daily"
  | "availability"
  | "setup"
  | "coverage"
  | "staff";

const TABS: { key: ScheduleTabKey; label: string; badge?: number }[] = [
  { key: "daily", label: "Daily Timeline" },
  { key: "availability", label: "Live Availability" },
  { key: "setup", label: "Schedule Setup" },
  { key: "coverage", label: "Coverage Issues" },
  { key: "staff", label: "Staff Schedule" },
];

export function ScheduleWorkspaceTabs({
  activeTab,
  onTabChange,
  tabBadges,
}: {
  activeTab: ScheduleTabKey;
  onTabChange: (tab: ScheduleTabKey) => void;
  tabBadges?: Partial<Record<ScheduleTabKey, number>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
    if (!activeBtn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - containerRect.left + container.scrollLeft,
      width: btnRect.width,
    });
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        gap: "0.125rem",
        marginBottom: "1rem",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>

      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const badge = tabBadges?.[tab.key];
        return (
          <button
            key={tab.key}
            data-tab={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: "8px 16px",
              fontSize: "0.875rem",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--cs-crm-accent)" : "var(--cs-text-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "color 180ms ease, background 180ms ease",
              position: "relative",
              zIndex: 1,
              borderRadius: "var(--cs-r-sm) var(--cs-r-sm) 0 0",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "var(--cs-surface-warm)";
                (e.currentTarget as HTMLElement).style.color = "var(--cs-text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--cs-text-muted)";
              }
            }}
          >
            {tab.label}
            {typeof badge === "number" && badge > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: "var(--cs-r-pill)",
                  background: "var(--cs-error)",
                  color: "#fff",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Animated underline */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: indicator.left,
          width: indicator.width,
          height: 2,
          background: "var(--cs-crm-accent)",
          borderRadius: 2,
          transition: "left 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94), width 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          zIndex: 2,
        }}
      />

      {/* Static bottom border */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: "var(--cs-border-soft)",
          zIndex: 0,
        }}
      />
    </div>
  );
}
