export type DriverTripsTab = "today" | "upcoming" | "history";

type DriverTripsTabsProps = {
  activeTab: DriverTripsTab;
  counts: Record<DriverTripsTab, number>;
  onTabChange: (tab: DriverTripsTab) => void;
};

const TABS: { key: DriverTripsTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "history", label: "History" },
];

export function DriverTripsTabs({ activeTab, counts, onTabChange }: DriverTripsTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Trip filters"
      style={{
        backgroundColor: "#fff",
        borderBottom: "1px solid var(--cs-border-soft)",
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        padding: "0 1rem",
        position: "sticky",
        top: 68,
        zIndex: 29,
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key];

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            style={{
              alignItems: "center",
              background: "none",
              border: "none",
              borderBottom: isActive ? "2px solid var(--cs-staff-accent)" : "2px solid transparent",
              color: isActive ? "var(--cs-staff-accent)" : "var(--cs-text-muted)",
              cursor: "pointer",
              display: "flex",
              fontSize: 13,
              fontWeight: isActive ? 800 : 600,
              gap: 6,
              justifyContent: "center",
              minHeight: 44,
              padding: "0.625rem 0 0.5rem",
              transition: "color 120ms ease, border-color 120ms ease",
            }}
          >
            <span>{tab.label}</span>
            <span
              style={{
                backgroundColor: isActive ? "var(--cs-staff-accent)" : "var(--cs-surface-warm)",
                borderRadius: 999,
                color: isActive ? "#fff" : "var(--cs-text-muted)",
                fontSize: 10,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 800,
                lineHeight: 1,
                minWidth: 18,
                padding: "4px 5px",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
