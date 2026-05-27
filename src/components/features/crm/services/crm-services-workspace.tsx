"use client";

/**
 * CrmServicesWorkspace
 *
 * Tab shell for /crm/services. Receives all server-fetched data as props
 * and manages tab state client-side.
 *
 * Tabs:
 *   1. Services         — service-first workflow (CrmTherapistAssignmentTab)
 *   2. Staff Capabilities — staff-first summary (CrmStaffCapabilitiesTab)
 *   3. Readiness Issues — service readiness check (CrmServiceReadinessTab)
 */

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  GlobalService,
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { CrmTherapistAssignmentTab } from "./crm-therapist-assignment-tab";
import { CrmStaffCapabilitiesTab } from "./crm-staff-capabilities-tab";
import { CrmServiceReadinessTab } from "./crm-service-readiness-tab";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "services" | "staff_capabilities" | "readiness_issues";

const TABS: { id: TabId; label: string }[] = [
  { id: "services",            label: "Services"            },
  { id: "staff_capabilities",  label: "Staff Capabilities"  },
  { id: "readiness_issues",    label: "Readiness Issues"    },
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
  loadError,
  activeServices,
  providerStaff,
  providerAssignments,
  initialTab = "services",
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
      {activeTab === "services" && (
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

      {activeTab === "staff_capabilities" && (
        loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load staff data</AlertTitle>
            <AlertDescription>
              Branch services failed to load so staff capabilities cannot be shown. Refresh the
              page to try again.
            </AlertDescription>
          </Alert>
        ) : (
          <CrmStaffCapabilitiesTab
            branchId={branchId}
            services={activeServices}
            staff={providerStaff}
            assignments={providerAssignments}
          />
        )
      )}

      {activeTab === "readiness_issues" && (
        loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load service data</AlertTitle>
            <AlertDescription>
              Branch services failed to load so readiness issues cannot be shown. Refresh the
              page to try again.
            </AlertDescription>
          </Alert>
        ) : (
          <CrmServiceReadinessTab
            services={activeServices}
            staff={providerStaff}
            assignments={providerAssignments}
          />
        )
      )}
    </div>
  );
}
