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
import { useRouter, useSearchParams } from "next/navigation";
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

const PRIMARY_TABS: { key: SetupTab; label: string }[] = [
  { key: "health", label: "Overview" },
  { key: "services", label: "Services & Providers" },
  { key: "spaces", label: "Rooms & Resources" },
  { key: "booking_rules", label: "Booking Rules" },
];

// Keep the original deep links available. These are supporting views, not
// separate primary workspaces competing for a staff member's attention.
const MORE_TABS: { key: SetupTab; label: string }[] = [
  { key: "providers", label: "Providers by staff" },
  { key: "staff_readiness", label: "Staff readiness" },
  { key: "public_readiness", label: "Public booking readiness" },
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
  const router = useRouter();
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
  const activeTabIndex = PRIMARY_TABS.findIndex((tab) => tab.key === activeTab);

  const handleTabChange = useCallback((next: string) => {
    const tab = next as SetupTab;
    if (tab === "services") {
      router.push("/crm/services");
      return;
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState(null, "", url.toString());
    }
  }, [router]);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const lastIndex = PRIMARY_TABS.length - 1;
      let nextIndex = activeTabIndex < 0 ? 0 : activeTabIndex;

      if (event.key === "ArrowRight") nextIndex = activeTabIndex === lastIndex ? 0 : activeTabIndex + 1;
      else if (event.key === "ArrowLeft") nextIndex = activeTabIndex === 0 ? lastIndex : activeTabIndex - 1;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = lastIndex;
      else return;

      event.preventDefault();
      const nextTab = PRIMARY_TABS[nextIndex];
      if (nextTab) handleTabChange(nextTab.key);
    },
    [activeTabIndex, handleTabChange]
  );

  return (
    <div>
      {activeTab !== "services" && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2" aria-label="Setup navigation">
        <div role="tablist" aria-label="Primary setup sections" onKeyDown={handleTabKeyDown} className="flex min-w-0 flex-1 flex-wrap gap-1">
          {PRIMARY_TABS.map((tab) => {
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
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]",
                  active
                    ? "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]"
                    : "text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
          <span className="sr-only">Additional setup tools</span>
          <select
            aria-label="Additional setup tools"
            value={MORE_TABS.some((tab) => tab.key === activeTab) ? activeTab : ""}
            onChange={(event) => handleTabChange(event.target.value)}
            className="h-9 min-w-[148px] max-w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-xs font-medium text-[var(--cs-text-secondary)]"
          >
            <option value="" disabled>Other setup tools</option>
            {MORE_TABS.map((tab) => <option key={tab.key} value={tab.key}>{tab.label}</option>)}
          </select>
        </label>
      </div>}
      <span className="sr-only" id="setup-tab-providers">Providers by staff</span>
      <span className="sr-only" id="setup-tab-staff_readiness">Staff readiness</span>
      <span className="sr-only" id="setup-tab-public_readiness">Public booking readiness</span>

      <AttendanceTabPanel id="setup-panel-health" labelledBy="setup-tab-health" active={activeTab === "health"}>
        {healthSlot}
      </AttendanceTabPanel>

      <AttendanceTabPanel id="setup-panel-services" labelledBy="setup-tab-services" active={activeTab === "services"}>
        <CrmServicesWorkspace {...servicesData} initialTab="services" compactNavigation />
      </AttendanceTabPanel>

      <AttendanceTabPanel id="setup-panel-providers" labelledBy="setup-tab-providers" active={activeTab === "providers"}>
        <CrmServicesWorkspace {...servicesData} initialTab="providers" compactNavigation />
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
        <CrmServicesWorkspace {...servicesData} initialTab="readiness_issues" compactNavigation />
      </AttendanceTabPanel>
    </div>
  );
}
