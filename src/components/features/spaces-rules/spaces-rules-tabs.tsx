import type { SpacesRulesTab, CrmSpacesTab } from "./spaces-rules-utils";
import { LayoutGrid, Building2, ClipboardList, AlertTriangle } from "lucide-react";

// ── Original Tabs (Owner/Manager) ──────────────────────────────────────────────

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

// ── CRM Tabs ───────────────────────────────────────────────────────────────────

const CRM_TABS: { id: CrmSpacesTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "spaces", label: "Spaces", icon: Building2 },
  { id: "conflicts", label: "Conflicts", icon: AlertTriangle },
];

export function CrmSpacesTabs({
  activeTab,
  onTabChange,
  conflictCount = 0,
}: {
  activeTab: CrmSpacesTab;
  onTabChange: (tab: CrmSpacesTab) => void;
  conflictCount?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--cs-border)",
      }}
    >
      {CRM_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const showBadge = tab.id === "conflicts" && conflictCount > 0;

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
              color: isActive
                ? tab.id === "conflicts" && conflictCount > 0
                  ? "#DC2626"
                  : "#4A7C59"
                : "var(--cs-text-muted)",
              backgroundColor: isActive
                ? tab.id === "conflicts" && conflictCount > 0
                  ? "rgba(220, 38, 38, 0.06)"
                  : "rgba(74, 124, 89, 0.06)"
                : "transparent",
              border: "none",
              borderBottom: isActive
                ? `2px solid ${tab.id === "conflicts" && conflictCount > 0 ? "#DC2626" : "#4A7C59"}`
                : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
              borderRadius: "6px 6px 0 0",
            }}
          >
            <Icon size={14} />
            {tab.label}
            {showBadge && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 9,
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  backgroundColor: "#DC2626",
                  color: "#fff",
                }}
              >
                {conflictCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
