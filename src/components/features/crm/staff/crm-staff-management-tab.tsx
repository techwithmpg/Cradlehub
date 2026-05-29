"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AdminDrawer,
  AdminOverlayHeader,
  AdminOverlayBody,
  AdminOverlayFooter,
  ConfirmUnsavedChangesDialog,
} from "@/components/shared/overlays";
import { StaffManagementWorkspace } from "@/components/features/staff/staff-management-workspace";
import { StaffEditForm } from "@/components/features/staff/staff-edit-form";
import { StaffServiceEditorSheet } from "@/components/features/staff/staff-service-editor-sheet";
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
};

const STAFF_EDIT_FORM_ID = "staff-edit-form";

export function CrmStaffManagementTab({
  allStaff,
  pendingStaff,
  branches,
  activeServices,
  providerAssignments,
}: Props) {
  const router = useRouter();
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [servicesStaff, setServicesStaff] = useState<StaffMember | null>(null);
  const [servicesDraft, setServicesDraft] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState<(() => void) | null>(null);
  const [editSheetDirty, setEditSheetDirty] = useState(false);

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
    setEditSheetDirty(false);
  }, []);

  const handleManageServices = useCallback(
    (staff: StaffMember) => {
      const ids = getCurrentServiceIds(staff.id);
      setServicesDraft(ids);
      setServicesStaff(staff);
      setSaveStatus(null);
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
          router.refresh();
        } else {
          setSaveStatus(result.error ?? "Failed to update status.");
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
        setSaveStatus(result.message);
        if (result.ok) {
          router.refresh();
          setTimeout(() => {
            setServicesStaff(null);
            setSaveStatus(null);
          }, 1200);
        }
      });
    },
    [servicesStaff, router]
  );

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

      {/* Staff Edit Drawer */}
      <AdminDrawer
        open={editingStaff !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (editSheetDirty) {
              setPendingCloseAction(() => () => {
                setEditingStaff(null);
                setEditSheetDirty(false);
              });
              setShowDiscardDialog(true);
              return;
            }
            setEditingStaff(null);
          }
        }}
        size="md"
      >
        <AdminOverlayHeader
          title="Edit Staff Profile"
          description="Update operational profile fields. Changes take effect immediately."
        />

        <AdminOverlayBody>
          {editingStaff && (
            <StaffEditForm
              staffMember={editingStaff}
              branches={branches}
              services={serviceRows}
              staffServiceIds={getCurrentServiceIds(editingStaff.id)}
              workspaceContext="crm"
              onEditServices={() => {
                if (editingStaff) {
                  handleManageServices(editingStaff);
                }
              }}
              formId={STAFF_EDIT_FORM_ID}
              compact
              onDirtyChange={setEditSheetDirty}
              onSuccess={() => {
                setEditSheetDirty(false);
                router.refresh();
              }}
            />
          )}
        </AdminOverlayBody>

        <AdminOverlayFooter className="flex flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              if (editSheetDirty) {
                setPendingCloseAction(() => () => {
                  setEditingStaff(null);
                  setEditSheetDirty(false);
                });
                setShowDiscardDialog(true);
                return;
              }
              setEditingStaff(null);
            }}
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--cs-border)] bg-transparent cursor-pointer"
            style={{ color: "var(--cs-text)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={STAFF_EDIT_FORM_ID}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: "var(--cs-sand)", color: "#fff" }}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </AdminOverlayFooter>
      </AdminDrawer>

      <ConfirmUnsavedChangesDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onConfirm={() => {
          pendingCloseAction?.();
          setPendingCloseAction(null);
        }}
      />

      {/* Service Capabilities Sheet */}
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

      {saveStatus && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 text-sm shadow-lg">
          {saveStatus}
        </div>
      )}
    </>
  );
}
