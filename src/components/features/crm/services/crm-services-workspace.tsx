"use client";

/**
 * CrmServicesWorkspace
 *
 * Tab shell for /crm/services. Receives all server-fetched data as props
 * and manages tab state client-side.
 *
 * Tabs:
 *   1. Active Services       — existing ServicesOfferedTab
 *   2. Therapist Assignments — new CrmTherapistAssignmentTab
 *
 * Visiting /crm/services#therapist-assignments auto-selects Tab 2 on mount.
 */

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ServicesOfferedTab } from "@/components/features/manager-settings/services-offered-tab";
import type {
  GlobalService,
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { CrmTherapistAssignmentTab } from "./crm-therapist-assignment-tab";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "active_services" | "therapist_assignments";

const TABS: { id: TabId; label: string }[] = [
  { id: "active_services",      label: "Active Services"      },
  { id: "therapist_assignments", label: "Therapist Assignments" },
];

export interface CrmServicesWorkspaceProps {
  branchId: string;
  services: ServiceLite[];
  allServices: GlobalService[];
  loadError: string | null;
  activeServices: ActiveBranchService[];
  providerStaff: StaffForServicePanel[];
  providerAssignments: ServiceAssignmentRow[];
  /** Pre-selected tab — passed from page via ?tab= search param. */
  initialTab?: TabId;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CrmServicesWorkspace({
  branchId,
  services,
  allServices,
  loadError,
  activeServices,
  providerStaff,
  providerAssignments,
  initialTab = "active_services",
}: CrmServicesWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <div>
      {/* ── Tab bar ── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--cs-border)",
          marginBottom: "1.5rem",
          gap: 0,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0.75rem 1.25rem",
                fontSize: "0.9375rem",
                fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap",
                background: "none",
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--cs-sand)"
                  : "2px solid transparent",
                marginBottom: -1,
                color: isActive ? "var(--cs-text)" : "var(--cs-text-secondary)",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "active_services" && (
        <ServicesOfferedTab
          branchId={branchId}
          services={services}
          allServices={allServices}
          loadError={loadError}
        />
      )}

      {activeTab === "therapist_assignments" && (
        loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load provider data</AlertTitle>
            <AlertDescription>
              Branch services failed to load so provider assignments cannot be shown. Refresh the
              page to try again.
            </AlertDescription>
          </Alert>
        ) : (
          <CrmTherapistAssignmentTab
            branchId={branchId}
            services={activeServices}
            staff={providerStaff}
            assignments={providerAssignments}
          />
        )
      )}
    </div>
  );
}
