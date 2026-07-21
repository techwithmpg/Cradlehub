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
import { useSearchParams } from "next/navigation";
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
    is_cross_branch: false,
    avatar_url:   s.avatar_url ?? null,
    avatar_path:  null,
    auth_user_id: null,
    created_at:   "",
    updated_at:   "",
    metadata:     {},
    access_notes: null,
    archive_reason: null,
    archived_at: null,
    identity_verified_at: null,
    merged_into_staff_id: null,
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
  providerStaff,
  providerAssignments,
  reviewerSystemRole,
  initialTab = "services",
}: CrmServicesWorkspaceProps) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: TabId = rawTab === "customization"
    ? "customization"
    : ["providers", "staff", "capabilities"].includes(rawTab ?? "")
      ? "providers"
      : ["issues", "readiness_issues", "readiness", "public_readiness", "public"].includes(rawTab ?? "")
        ? "readiness_issues"
        : ["services", "assignments"].includes(rawTab ?? "")
          ? "services"
          : initialTab;
  const [editingStaff, setEditingStaff] = useState<StaffForServicePanel | null>(null);
  const [workspaceServices, setWorkspaceServices] = useState<ServiceLite[]>(services);
  const [workspaceAssignments, setWorkspaceAssignments] = useState<ServiceAssignmentRow[]>(providerAssignments);
  const [workspaceProviderStaff, setWorkspaceProviderStaff] = useState(providerStaff);

  const workspaceActiveServices = useMemo(
    () => workspaceServices.filter(
      (service): service is ActiveBranchService => service.is_active && service.services !== null
    ),
    [workspaceServices]
  );

  const handleServicePatch = useCallback(
    (serviceId: string, patch: Partial<ServiceLite>) => {
      setWorkspaceServices((current) => current.map((service) => {
        const currentServiceId = service.service_id ?? service.services?.id ?? service.id;
        return currentServiceId === serviceId ? { ...service, ...patch } : service;
      }));
    },
    []
  );

  const handleAssignmentChange = useCallback(
    (assignment: ServiceAssignmentRow, assigned: boolean) => {
      setWorkspaceAssignments((current) => {
        const without = current.filter(
          (row) => row.staff_id !== assignment.staff_id || row.service_id !== assignment.service_id
        );
        return assigned ? [...without, assignment] : without;
      });
    },
    []
  );

  /**
   * Switch active tab instantly (no full page reload) and update the URL
   * search param so deep links, browser back, and sharing all work.
   *
   * window.history.replaceState is used instead of router.replace to avoid
   * triggering Next.js soft-navigation, which would refetch server data.
   */
  const handleTabChange = useCallback((nextTab: string) => {
    const tab = nextTab as TabId;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", TAB_URL_PARAM[tab]);
      window.history.pushState(null, "", url.toString());
    }
  }, []);

  // Service rows for the modal (same adapter used by CrmStaffManagementTab)
  const serviceRows = useMemo(
    () => toCrmStaffServiceRows(workspaceActiveServices),
    [workspaceActiveServices]
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
        ? workspaceAssignments
            .filter((a) => a.staff_id === editingStaff.id)
            .map((a) => a.service_id)
        : [],
    [editingStaff, workspaceAssignments]
  );

  const handleEditProfile = useCallback((member: StaffForServicePanel) => {
    setEditingStaff(member);
  }, []);

  const handleEditSuccess = useCallback((updatedStaff: Partial<StaffMember> & { id: string }) => {
    setWorkspaceProviderStaff((current) => current.map((member) =>
      member.id === updatedStaff.id
        ? {
            ...member,
            full_name: updatedStaff.full_name ?? member.full_name,
            nickname: updatedStaff.nickname ?? member.nickname,
            phone: updatedStaff.phone ?? member.phone,
            tier: updatedStaff.tier ?? member.tier,
            system_role: updatedStaff.system_role ?? member.system_role,
            staff_type: updatedStaff.staff_type ?? member.staff_type,
            is_head: updatedStaff.is_head ?? member.is_head,
            branch_id: updatedStaff.branch_id ?? member.branch_id,
            is_active: updatedStaff.is_active ?? member.is_active,
          }
        : member
    ));
    toast.success("Staff profile updated.");
    setEditingStaff(null);
  }, []);

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
            services={workspaceActiveServices}
            staff={workspaceProviderStaff}
            assignments={workspaceAssignments}
            onServicePatch={handleServicePatch}
            onAssignmentChange={handleAssignmentChange}
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
            services={workspaceServices}
            activeServices={workspaceActiveServices}
            staff={workspaceProviderStaff}
            assignments={workspaceAssignments}
            onServicePatch={handleServicePatch}
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
            services={workspaceActiveServices}
            staff={workspaceProviderStaff}
            assignments={workspaceAssignments}
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
            services={workspaceActiveServices}
            staff={workspaceProviderStaff}
            assignments={workspaceAssignments}
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
