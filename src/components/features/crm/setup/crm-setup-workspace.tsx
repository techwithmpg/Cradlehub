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

import { useState, useCallback } from "react";
import { CrmSegmentTabs } from "@/components/features/crm/premium/crm-segment-tabs";
import type { CrmSegmentTab } from "@/components/features/crm/premium/crm-segment-tabs";
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

const TABS: CrmSegmentTab[] = [
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
  const [activeTab, setActiveTab] = useState<SetupTab>(initialTab);

  const handleTabChange = useCallback((next: string) => {
    const tab = next as SetupTab;
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  return (
    <div>
      {/* ── Tab bar ── */}
      <CrmSegmentTabs
        tabs={TABS}
        activeKey={activeTab}
        onSelect={handleTabChange}
        variant="underline"
        className="mb-6"
      />

      {/* ── Tab panels ── */}

      {activeTab === "health" && (
        <div>{healthSlot}</div>
      )}

      {activeTab === "services" && (
        <CrmServicesWorkspace
          key="services"
          {...servicesData}
          initialTab="services"
        />
      )}

      {activeTab === "providers" && (
        <CrmServicesWorkspace
          key="providers"
          {...servicesData}
          initialTab="providers"
        />
      )}

      {activeTab === "spaces" && (
        <SpacesRulesWorkspace
          key="spaces"
          {...spacesData}
          initialTab="spaces"
        />
      )}

      {activeTab === "booking_rules" && (
        <SpacesRulesWorkspace
          key="booking_rules"
          {...spacesData}
          initialTab="rules"
        />
      )}

      {activeTab === "staff_readiness" && (
        <CrmStaffReadinessPanel data={health} />
      )}

      {activeTab === "public_readiness" && (
        <CrmServicesWorkspace
          key="public_readiness"
          {...servicesData}
          initialTab="readiness_issues"
        />
      )}
    </div>
  );
}
