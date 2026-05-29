"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
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

type BranchLite = { id: string; name: string };

type Props = {
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
  branches: BranchLite[];
  activeServices: ServiceLite[];
  providerAssignments: ServiceAssignmentRow[];
  reviewerSystemRole: string;
};

export function CrmStaffManagementTab({
  allStaff,
  pendingStaff,
  branches,
  activeServices,
  providerAssignments,
  reviewerSystemRole,
}: Props) {
  const router = useRouter();
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
      const ids = getCurrentServiceIds(staff.id);
      setServicesDraft(ids);
      setServicesStaff(staff);
    },
    [getCurrentServiceIds]
  );

  const handleToggleActive = useCallback(
    (staff: StaffMember) => {
      startSaving(async () => {
        const result = await toggleStaffActiveAction({
          staffId: staff.id,
          isActive: !staff.is_active,
        });
        if (result.success) {
          toast.success("Staff status updated.");
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to update status.");
        }
      });
    },
    [router]
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
          router.refresh();
          setTimeout(() => setServicesStaff(null), 1200);
        } else {
          toast.error(result.message ?? "Could not update service capabilities.");
        }
      });
    },
    [servicesStaff, router]
  );

  const handleEditSuccess = useCallback(() => {
    toast.success("Staff profile updated.");
    setEditingStaff(null);
    router.refresh();
  }, [router]);

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
        staffName={servicesStaff?.full_name}
      />

    </>
  );
}
