"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { StaffManagementWorkspace } from "@/components/features/staff/staff-management-workspace";
import { StaffServiceEditorSheet } from "@/components/features/staff/staff-service-editor-sheet";
import { CrmEditStaffProfileModal } from "./crm-edit-staff-profile-modal";
import { toggleStaffActiveAction } from "@/app/(dashboard)/owner/staff/actions";
import { updateStaffServicesFromCrmAction } from "@/lib/actions/crm-staff-services";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { toCrmStaffServiceRows } from "./service-row-adapter";
import { getStaffAdminName } from "@/lib/staff/display-name";

type BranchLite = { id: string; name: string };

type Props = {
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
  branches: BranchLite[];
  activeServices: ServiceLite[];
  providerAssignments: ServiceAssignmentRow[];
  providerAssignmentsError: string | null;
  reviewerSystemRole: string;
  onStaffServicesSaved: (staffId: string, serviceIds: string[]) => void;
  onStaffChanged: (patch: Partial<StaffMember> & { id: string }) => void;
};

export function CrmStaffManagementTab({
  allStaff,
  pendingStaff,
  branches,
  activeServices,
  providerAssignments,
  providerAssignmentsError,
  reviewerSystemRole,
  onStaffServicesSaved,
  onStaffChanged,
}: Props) {
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [servicesStaff, setServicesStaff] = useState<StaffMember | null>(null);
  const [servicesDraft, setServicesDraft] = useState<string[]>([]);
  const [isSaving, startSaving] = useTransition();

  const serviceRows = useMemo(
    () => toCrmStaffServiceRows(activeServices),
    [activeServices]
  );

  const getCurrentServiceIds = useCallback(
    (staffId: string): string[] =>
      providerAssignments
        .filter((a) => a.staff_id === staffId)
        .map((a) => a.service_id),
    [providerAssignments]
  );

  const handleEditStaff = useCallback((staff: StaffMember) => {
    setEditingStaff(staff);
  }, []);

  const handleManageServices = useCallback(
    (staff: StaffMember) => {
      if (providerAssignmentsError) {
        toast.error(providerAssignmentsError);
        return;
      }
      const ids = getCurrentServiceIds(staff.id);
      setServicesDraft(ids);
      setServicesStaff(staff);
    },
    [getCurrentServiceIds, providerAssignmentsError]
  );

  const handleToggleActive = useCallback(
    (staff: StaffMember) => {
      const optimistic = { id: staff.id, is_active: !staff.is_active };
      onStaffChanged(optimistic);
      startSaving(async () => {
        const result = await toggleStaffActiveAction({
          staffId: staff.id,
          isActive: optimistic.is_active,
        });
        if (result.success) {
          onStaffChanged(result.staff);
          toast.success("Staff status updated.");
        } else {
          onStaffChanged({ id: staff.id, is_active: staff.is_active });
          toast.error(result.error ?? "Failed to update status.");
        }
      });
    },
    [onStaffChanged]
  );

  const handleToggleServiceId = useCallback((id: string) => {
    setServicesDraft((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const handleSaveServices = useCallback(
    (ids: string[]) => {
      if (!servicesStaff) return;
      startSaving(async () => {
        const result = await updateStaffServicesFromCrmAction({
          staffId: servicesStaff.id,
          serviceIds: ids,
        });
        if (result.ok) {
          toast.success("Service capabilities updated.");
          onStaffServicesSaved(servicesStaff.id, result.serviceIds);
          setServicesDraft(result.serviceIds);
          setServicesStaff(null);
        } else {
          toast.error(result.message ?? "Could not update service capabilities.");
        }
      });
    },
    [onStaffServicesSaved, servicesStaff]
  );

  const handleEditSuccess = useCallback((updatedStaff: Partial<StaffMember> & { id: string }) => {
    onStaffChanged(updatedStaff);
    toast.success("Staff profile updated.");
    setEditingStaff(null);
  }, [onStaffChanged]);

  return (
    <>
      <StaffManagementWorkspace
        allStaff={allStaff}
        pendingStaff={pendingStaff}
        initialTab="active"
        workspaceContext="crm"
        onEditStaff={handleEditStaff}
        onManageServices={handleManageServices}
        onToggleActive={handleToggleActive}
      />

      <CrmEditStaffProfileModal
        open={editingStaff !== null}
        onOpenChange={(open) => {
          if (!open) setEditingStaff(null);
        }}
        staffMember={editingStaff}
        branches={branches}
        services={serviceRows}
        staffServiceIds={editingStaff ? getCurrentServiceIds(editingStaff.id) : []}
        serviceAssignmentsError={providerAssignmentsError}
        reviewerSystemRole={reviewerSystemRole}
        onEditServices={() => {
          if (editingStaff) {
            handleManageServices(editingStaff);
            setEditingStaff(null);
          }
        }}
        onSuccess={handleEditSuccess}
      />

      <StaffServiceEditorSheet
        open={servicesStaff !== null}
        services={serviceRows}
        selectedIds={servicesDraft}
        onToggle={handleToggleServiceId}
        onClose={() => setServicesStaff(null)}
        onSave={handleSaveServices}
        saving={isSaving}
        staffName={servicesStaff ? getStaffAdminName(servicesStaff) : undefined}
      />

    </>
  );
}
