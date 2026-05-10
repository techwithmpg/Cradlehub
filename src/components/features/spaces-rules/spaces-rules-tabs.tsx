import type { SpacesRulesTab } from "./spaces-rules-utils";
import { LayoutGrid, Building2, ClipboardList, AlertTriangle } from "lucide-react";

const ALL_TABS: { id: SpacesRulesTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "spaces", label: "Spaces", icon: Building2 },
  { id: "rules", label: "Booking Rules", icon: ClipboardList },
  { id: "conflicts", label: "Conflicts", icon: AlertTriangle },
];

export function SpacesRulesTabs({
  activeTab,
  onTabChange,
  canViewBookingRules = true,
}: {
  activeTab: SpacesRulesTab;
  onTabChange: (tab: SpacesRulesTab) => void;
  canViewBookingRules?: boolean;
}) {
  const tabs = canViewBookingRules
    ? ALL_TABS
    : ALL_TABS.filter((t) => t.id !== "rules");

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--cs-border)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              fontSize: "0.8125rem",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
              backgroundColor: isActive ? "var(--cs-sand-mist)" : "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid var(--cs-sand)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
              borderRadius: "6px 6px 0 0",
            }}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
