"use client";

/**
 * CrmServicesWorkspace
 *
 * Tab shell for /crm/services. Receives all server-fetched data as props
 * and manages tab state client-side.
 *
 * Tabs:
 *   1. Services             — service-first workflow (CrmTherapistAssignmentTab)
 *   2. Service Customization — per-service customization (ServiceCustomizationTab)
 *   3. Provider Assignments  — staff-first summary (CrmStaffCapabilitiesTab)
 *   4. Readiness Issues      — service readiness check (CrmServiceReadinessTab)
 *
 * The CrmEditStaffProfileModal is lifted here so it is mounted once and can
 * be opened from CrmStaffCapabilitiesTab via the onEditProfile callback.
 * This is the same pattern used by CrmStaffManagementTab.
 */

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  GlobalService,
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type { StaffProfileBranch } from "@/components/features/crm/staff/edit-staff-profile-types";
import { CrmEditStaffProfileModal } from "@/components/features/crm/staff/crm-edit-staff-profile-modal";
import { toCrmStaffServiceRows } from "@/components/features/crm/staff/service-row-adapter";
import { CrmSegmentTabs } from "@/components/features/crm/premium/crm-segment-tabs";
import type { CrmSegmentTab } from "@/components/features/crm/premium/crm-segment-tabs";
import { CrmTherapistAssignmentTab } from "./crm-therapist-assignment-tab";
import { CrmStaffCapabilitiesTab } from "./crm-staff-capabilities-tab";
import { CrmServiceReadinessTab } from "./crm-service-readiness-tab";
import { ServiceCustomizationTab } from "./service-customization-tab";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "services" | "customization" | "providers" | "readiness_issues";

/**
 * Maps each internal TabId to the canonical ?tab= URL param value so that
 * window.history.replaceState stays consistent with what the server page reads.
 * Mirrors the aliases in page.tsx's initialTab resolver.
 */
const TAB_URL_PARAM: Record<TabId, string> = {
  services:         "services",
  customization:    "customization",
  providers:        "providers",
  readiness_issues: "issues",
};

const SEGMENT_TABS: CrmSegmentTab[] = [
  { key: "services",         label: "Services"              },
  { key: "customization",    label: "Service Customization"  },
  { key: "providers",        label: "Provider Assignments"   },
  { key: "readiness_issues", label: "Readiness Issues"       },
];

export interface CrmServicesWorkspaceProps {
  branchId: string;
  branchName: string;
  services: ServiceLite[];
  allServices: GlobalService[];
  loadError: string | null;
  activeServices: ActiveBranchService[];
  providerStaff: StaffForServicePanel[];
  providerAssignments: ServiceAssignmentRow[];
  /** System role of the logged-in CRM/CSR user — passed to the edit modal. */
  reviewerSystemRole: string;
  /** Pre-selected tab — passed from page via ?tab= search param. */
  initialTab?: TabId;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

/**
 * Convert a StaffForServicePanel (fetched with the extended select) into the
 * StaffMember shape expected by CrmEditStaffProfileModal.
 *
 * Fields not available in the services-panel query (auth_user_id, created_at,
 * updated_at, avatar_path, email, job_title) are set to safe null/empty values.
 * The modal either doesn't read them or handles null gracefully.
 */
function toStaffMember(s: StaffForServicePanel): StaffMember {
  return {
    id:           s.id,
    full_name:    s.full_name,
    system_role:  s.system_role,
    staff_type:   s.staff_type ?? "therapist",
    nickname:     s.nickname ?? null,
    phone:        s.phone ?? null,
    branch_id:    s.branch_id ?? null,
    tier:         s.tier ?? "n/a",
    is_head:      s.is_head ?? false,
    is_active:    s.is_active ?? true,
    avatar_url:   s.avatar_url ?? null,
    avatar_path:  null,
    auth_user_id: null,
    created_at:   "",
    updated_at:   "",
    metadata:     {},
    access_notes: null,
    temporary_access_expires_at: null,
    workspace_access: [],
    // branches — identity card uses this to display branch name
    branches: s.branches ?? null,
    // optional StaffMember fields
    email:     null,
    job_title: null,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CrmServicesWorkspace({
  branchId,
  branchName,
  loadError,
  services,
  activeServices,
  providerStaff,
  providerAssignments,
  reviewerSystemRole,
  initialTab = "services",
}: CrmServicesWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [editingStaff, setEditingStaff] = useState<StaffForServicePanel | null>(null);

  /**
   * Switch active tab instantly (no full page reload) and update the URL
   * search param so deep links, browser back, and sharing all work.
   *
   * window.history.replaceState is used instead of router.replace to avoid
   * triggering Next.js soft-navigation, which would refetch server data.
   */
  const handleTabChange = useCallback((nextTab: string) => {
    const tab = nextTab as TabId;
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", TAB_URL_PARAM[tab]);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  // Service rows for the modal (same adapter used by CrmStaffManagementTab)
  const serviceRows = useMemo(
    () => toCrmStaffServiceRows(activeServices),
    [activeServices]
  );

  // Single branch entry — CRM users cannot change branches (the modal hides
  // the branch dropdown for non-owner/manager reviewers)
  const branchOptions = useMemo<StaffProfileBranch[]>(
    () => [{ id: branchId, name: branchName }],
    [branchId, branchName]
  );

  // Service IDs currently assigned to the staff member being edited
  const editingStaffServiceIds = useMemo(
    () =>
      editingStaff
        ? providerAssignments
            .filter((a) => a.staff_id === editingStaff.id)
            .map((a) => a.service_id)
        : [],
    [editingStaff, providerAssignments]
  );

  const handleEditProfile = useCallback((member: StaffForServicePanel) => {
    setEditingStaff(member);
  }, []);

  const handleEditSuccess = useCallback(() => {
    toast.success("Staff profile updated.");
    setEditingStaff(null);
    router.refresh();
  }, [router]);

  return (
    <div>
      {/* ── Tab bar — instant switching, URL sync via replaceState ── */}
      <CrmSegmentTabs
        tabs={SEGMENT_TABS}
        activeKey={activeTab}
        onSelect={handleTabChange}
        variant="underline"
        className="mb-6"
      />

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

      {activeTab === "customization" && (
        loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load service data</AlertTitle>
            <AlertDescription>
              Branch services failed to load so service customization cannot be shown. Refresh the
              page to try again.
            </AlertDescription>
          </Alert>
        ) : (
          <ServiceCustomizationTab
            branchId={branchId}
            branchName={branchName}
            services={services}
            activeServices={activeServices}
            staff={providerStaff}
            assignments={providerAssignments}
          />
        )
      )}

      {activeTab === "providers" && (
        loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load staff data</AlertTitle>
            <AlertDescription>
              Branch services failed to load so provider assignments cannot be shown. Refresh the
              page to try again.
            </AlertDescription>
          </Alert>
        ) : (
          <CrmStaffCapabilitiesTab
            branchId={branchId}
            services={activeServices}
            staff={providerStaff}
            assignments={providerAssignments}
            onEditProfile={handleEditProfile}
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

      {/* ── Edit Staff Profile modal — reuses the same modal as Staff Management ── */}
      <CrmEditStaffProfileModal
        open={editingStaff !== null}
        onOpenChange={(open) => {
          if (!open) setEditingStaff(null);
        }}
        staffMember={editingStaff !== null ? toStaffMember(editingStaff) : null}
        branches={branchOptions}
        services={serviceRows}
        staffServiceIds={editingStaffServiceIds}
        reviewerSystemRole={reviewerSystemRole}
        onEditServices={() => {
          // Close the profile modal — the user can manage service assignments
          // directly on this page using the Services and Provider Assignments tabs.
          setEditingStaff(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
