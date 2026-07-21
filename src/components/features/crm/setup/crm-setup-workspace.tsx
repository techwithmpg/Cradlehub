"use client";

/**
 * CrmSetupWorkspace
 *
 * Unified client-side tab shell for /crm/setup.
 *
 * Tabs:
 *   health          — Setup Health (server-rendered slot)
 *   services        — Services & Customization
 *   providers       — Provider Assignment
 *   spaces          — Spaces & Rules
 *   booking_rules   — Booking Rules
 *   staff_readiness — Staff Readiness
 *   public_readiness — Public Booking Readiness
 *
 * Tab switching is instant (client state) with window.history.replaceState
 * URL sync. No full page reload. Deep links preserved via initialTab prop.
 */

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AttendanceTabPanel } from "@/components/features/attendance/attendance-ui";
import { CrmServicesWorkspace } from "@/components/features/crm/services/crm-services-workspace";
import { SpacesRulesWorkspace } from "@/components/features/spaces-rules/spaces-rules-workspace";
import { CrmStaffReadinessPanel } from "./crm-staff-readiness-panel";
import type { CrmServicesWorkspaceProps } from "@/components/features/crm/services/crm-services-workspace";
import type { SpacesRulesWorkspaceProps } from "@/components/features/spaces-rules/spaces-rules-workspace";
import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

// ── Tab types ─────────────────────────────────────────────────────────────────

export type SetupTab =
  | "health"
  | "services"
  | "providers"
  | "spaces"
  | "booking_rules"
  | "staff_readiness"
  | "public_readiness";

const TABS: { key: SetupTab; label: string }[] = [
  { key: "health",          label: "Setup Health"    },
  { key: "services",        label: "Services"        },
  { key: "providers",       label: "Providers"       },
  { key: "spaces",          label: "Spaces & Rules"  },
  { key: "booking_rules",   label: "Booking Rules"   },
  { key: "staff_readiness", label: "Staff Readiness" },
  { key: "public_readiness",label: "Public Booking"  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

type ServicesData = Omit<CrmServicesWorkspaceProps, "initialTab">;
type SpacesData   = Omit<SpacesRulesWorkspaceProps, "initialTab">;

export type CrmSetupWorkspaceProps = {
  initialTab: SetupTab;
  /** Setup health stats — used by health tab and staff_readiness panel */
  health: CrmSetupHealthData;
  /** Server-rendered SetupHealthContent — passed as a slot to avoid RSC import restrictions */
  healthSlot: React.ReactNode;
  /** Services workspace data */
  servicesData: ServicesData;
  /** Spaces & Rules workspace data */
  spacesData: SpacesData;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CrmSetupWorkspace({
  initialTab,
  health,
  healthSlot,
  servicesData,
  spacesData,
}: CrmSetupWorkspaceProps) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: SetupTab = rawTab === "health"
    ? "health"
    : ["services", "customization", "assignments"].includes(rawTab ?? "")
      ? "services"
      : ["providers", "staff", "capabilities"].includes(rawTab ?? "")
        ? "providers"
        : ["spaces", "spaces-rules", "overview"].includes(rawTab ?? "")
          ? "spaces"
          : ["booking_rules", "rules"].includes(rawTab ?? "")
            ? "booking_rules"
            : rawTab === "staff_readiness"
              ? "staff_readiness"
              : ["public_readiness", "readiness", "issues", "public"].includes(rawTab ?? "")
                ? "public_readiness"
                : initialTab;
  const activeTabIndex = TABS.findIndex((tab) => tab.key === activeTab);

  const handleTabChange = useCallback((next: string) => {
    const tab = next as SetupTab;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState(null, "", url.toString());
    }
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const lastIndex = TABS.length - 1;
      let nextIndex = activeTabIndex;

      if (event.key === "ArrowRight") nextIndex = activeTabIndex === lastIndex ? 0 : activeTabIndex + 1;
      else if (event.key === "ArrowLeft") nextIndex = activeTabIndex === 0 ? lastIndex : activeTabIndex - 1;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = lastIndex;
      else return;

      event.preventDefault();
      const nextTab = TABS[nextIndex];
      if (nextTab) handleTabChange(nextTab.key);
    },
    [activeTabIndex, handleTabChange]
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Setup sections"
        onKeyDown={handleTabKeyDown}
        className="mb-6 flex gap-0 overflow-x-auto border-b border-[var(--cs-border-soft)]"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`setup-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`setup-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => handleTabChange(tab.key)}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)] ${
                active
                  ? "text-[var(--cs-text)] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-[var(--cs-sand)]"
                  : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text-secondary)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <AttendanceTabPanel id="setup-panel-health" labelledBy="setup-tab-health" active={activeTab === "health"}>
        {healthSlot}
      </AttendanceTabPanel>

      <AttendanceTabPanel id="setup-panel-services" labelledBy="setup-tab-services" active={activeTab === "services"}>
        <CrmServicesWorkspace {...servicesData} initialTab="services" />
      </AttendanceTabPanel>

      <AttendanceTabPanel id="setup-panel-providers" labelledBy="setup-tab-providers" active={activeTab === "providers"}>
        <CrmServicesWorkspace {...servicesData} initialTab="providers" />
      </AttendanceTabPanel>

      <AttendanceTabPanel id="setup-panel-spaces" labelledBy="setup-tab-spaces" active={activeTab === "spaces"}>
        <SpacesRulesWorkspace {...spacesData} initialTab="spaces" />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="setup-panel-booking_rules"
        labelledBy="setup-tab-booking_rules"
        active={activeTab === "booking_rules"}
      >
        <SpacesRulesWorkspace {...spacesData} initialTab="rules" />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="setup-panel-staff_readiness"
        labelledBy="setup-tab-staff_readiness"
        active={activeTab === "staff_readiness"}
      >
        <CrmStaffReadinessPanel data={health} />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="setup-panel-public_readiness"
        labelledBy="setup-tab-public_readiness"
        active={activeTab === "public_readiness"}
      >
        <CrmServicesWorkspace {...servicesData} initialTab="readiness_issues" />
      </AttendanceTabPanel>
    </div>
  );
}
