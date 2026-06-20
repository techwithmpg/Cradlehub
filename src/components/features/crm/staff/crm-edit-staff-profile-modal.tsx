"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
  ConfirmUnsavedChangesDialog,
} from "@/components/shared/overlays";
import { updateStaffAction } from "@/app/(dashboard)/owner/staff/actions";
import {
  getSystemRoleOptionsForAssigner,
  isSensitiveSystemRole,
} from "@/constants/staff";
import { getSystemRoleLabel } from "@/components/features/staff/staff-management-utils";
import { EditStaffProfileFooter } from "./edit-staff-profile-footer";
import { EditStaffProfileIdentityCard } from "./edit-staff-profile-identity-card";
import { EditStaffProfileTabs } from "./edit-staff-profile-tabs";
import {
  countStaffProfileChanges,
  createStaffProfileDraft,
  type StaffProfileBranch,
  type StaffProfileDraft,
  type StaffProfileService,
  type StaffProfileTab,
} from "./edit-staff-profile-types";
import { EditStaffAccessStatusTab } from "./tabs/edit-staff-access-status-tab";
import { EditStaffProfileInfoTab } from "./tabs/edit-staff-profile-info-tab";
import { EditStaffServiceCapabilitiesTab } from "./tabs/edit-staff-service-capabilities-tab";
import { EditStaffWorkSetupTab } from "./tabs/edit-staff-work-setup-tab";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: StaffMember | null;
  branches: StaffProfileBranch[];
  services: StaffProfileService[];
  staffServiceIds: string[];
  serviceAssignmentsError?: string | null;
  reviewerSystemRole: string;
  onEditServices: () => void;
  onSuccess: () => void;
};

const BRANCH_EDIT_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
]);

export function CrmEditStaffProfileModal({
  open,
  onOpenChange,
  staffMember,
  branches,
  services,
  staffServiceIds,
  serviceAssignmentsError,
  reviewerSystemRole,
  onEditServices,
  onSuccess,
}: Props) {
  if (!staffMember) return null;

  return (
    <ModalContent
      key={staffMember.id}
      open={open}
      onOpenChange={onOpenChange}
      staffMember={staffMember}
      branches={branches}
      services={services}
      staffServiceIds={staffServiceIds}
      serviceAssignmentsError={serviceAssignmentsError}
      reviewerSystemRole={reviewerSystemRole}
      onEditServices={onEditServices}
      onSuccess={onSuccess}
    />
  );
}

function ModalContent({
  open,
  onOpenChange,
  staffMember,
  branches,
  services,
  staffServiceIds,
  serviceAssignmentsError,
  reviewerSystemRole,
  onEditServices,
  onSuccess,
}: Props & { staffMember: StaffMember }) {
  const initialDraft = useMemo(
    () => createStaffProfileDraft(staffMember),
    [staffMember]
  );
  const [draft, setDraft] = useState<StaffProfileDraft>(initialDraft);
  const [activeTab, setActiveTab] = useState<StaffProfileTab>("profile");
  const [feedback, setFeedback] = useState<{ type: "error"; message: string } | null>(
    null
  );
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingEditServices, setPendingEditServices] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const assignedServices = useMemo(
    () => services.filter((service) => staffServiceIds.includes(service.id)),
    [services, staffServiceIds]
  );
  const changeCount = countStaffProfileChanges(initialDraft, draft);
  const hasUnsavedChanges = changeCount > 0;
  const isProtected = isSensitiveSystemRole(staffMember.system_role);
  const assignableRoleOptions = getSystemRoleOptionsForAssigner(
    reviewerSystemRole
  ).map((option) => ({
    value: option.value,
    label: option.label,
  }));
  const roleOptions = assignableRoleOptions.some(
    (option) => option.value === draft.systemRole
  )
    ? assignableRoleOptions
    : [
        {
          value: draft.systemRole,
          label: getSystemRoleLabel(draft.systemRole),
        },
        ...assignableRoleOptions,
      ];
  const canEditSystemRole = !isProtected && assignableRoleOptions.length > 0;
  const canEditBranch =
    !isProtected && BRANCH_EDIT_ROLES.has(reviewerSystemRole);
  const saveDisabled =
    isSaving ||
    isProtected ||
    !hasUnsavedChanges ||
    draft.fullName.trim().length < 2;

  const updateDraft = useCallback(
    <Field extends keyof StaffProfileDraft>(
      field: Field,
      value: StaffProfileDraft[Field]
    ) => {
      setFeedback(null);
      setDraft((current) => ({ ...current, [field]: value }));
    },
    []
  );

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingEditServices(false);
      setShowDiscardDialog(true);
      return;
    }

    onOpenChange(false);
  }, [hasUnsavedChanges, onOpenChange]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }

      requestClose();
    },
    [onOpenChange, requestClose]
  );

  const requestEditServices = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingEditServices(true);
      setShowDiscardDialog(true);
      return;
    }

    onEditServices();
  }, [hasUnsavedChanges, onEditServices]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardDialog(false);

    if (pendingEditServices) {
      setPendingEditServices(false);
      onEditServices();
      return;
    }

    onOpenChange(false);
  }, [pendingEditServices, onEditServices, onOpenChange]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fullName = draft.fullName.trim();
      const phone = draft.phone.trim();

      if (fullName.length < 2) {
        setFeedback({
          type: "error",
          message: "Full name must be at least 2 characters.",
        });
        return;
      }

      if (phone.length > 0 && (phone.length < 7 || phone.length > 20)) {
        setFeedback({
          type: "error",
          message: "Phone must be between 7 and 20 characters.",
        });
        return;
      }

      if (canEditBranch && draft.branchId.trim().length === 0) {
        setFeedback({
          type: "error",
          message: "Branch is required.",
        });
        return;
      }

      startSaving(async () => {
        const result = await updateStaffAction({
          staffId: staffMember.id,
          fullName,
          nickname: nullableString(draft.nickname),
          phone: phone.length > 0 ? phone : undefined,
          tier: draft.tier,
          staffType: draft.staffType,
          isHead: draft.isHead,
          isActive: draft.isActive,
          ...(canEditBranch ? { branchId: draft.branchId } : {}),
          ...(canEditSystemRole ? { systemRole: draft.systemRole } : {}),
        });

        if (!result.success) {
          setFeedback({
            type: "error",
            message: result.error ?? "Staff profile could not be updated.",
          });
          return;
        }

        onSuccess();
      });
    },
    [
      canEditBranch,
      canEditSystemRole,
      draft,
      onSuccess,
      staffMember.id,
      startSaving,
    ]
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={handleDialogOpenChange}
      size="xl"
      placement="center"
      className="max-w-[calc(100vw-48px)] bg-[var(--cs-surface)]"
    >
      <AdminOverlayHeader
        title="Edit Staff Profile"
        description="Update operational profile fields. Changes take effect immediately."
        className="px-6 py-5"
      />

      <EditStaffProfileIdentityCard
        staffMember={staffMember}
        serviceCount={assignedServices.length}
      />

      <EditStaffProfileTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <AdminOverlayBody
        className="bg-[var(--cs-surface-warm)] px-6 py-5"
        padded={false}
      >
        <form
          id="crm-staff-edit-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {isProtected ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              This staff member has a protected system role. Editing requires
              owner approval.
            </div>
          ) : null}

          {feedback ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {feedback.message}
            </div>
          ) : null}

          <ActiveTabContent
            activeTab={activeTab}
            draft={draft}
            branches={branches}
            assignedServices={assignedServices}
            serviceAssignmentsError={serviceAssignmentsError}
            disabled={isProtected || isSaving}
            canEditBranch={canEditBranch}
            canEditSystemRole={canEditSystemRole}
            roleOptions={roleOptions}
            onChange={updateDraft}
            onEditServices={requestEditServices}
          />
        </form>
      </AdminOverlayBody>

      <AdminOverlayFooter className="bg-[var(--cs-surface)] px-6 py-4">
        <EditStaffProfileFooter
          changeCount={changeCount}
          isSaving={isSaving}
          saveDisabled={saveDisabled}
          onCancel={requestClose}
        />
      </AdminOverlayFooter>

      <ConfirmUnsavedChangesDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onConfirm={confirmDiscard}
        title="Discard staff profile changes?"
        description="You have unsaved staff profile changes. Discard changes or keep editing?"
      />
    </AdminDialog>
  );
}

function ActiveTabContent({
  activeTab,
  draft,
  branches,
  assignedServices,
  serviceAssignmentsError,
  disabled,
  canEditBranch,
  canEditSystemRole,
  roleOptions,
  onChange,
  onEditServices,
}: {
  activeTab: StaffProfileTab;
  draft: StaffProfileDraft;
  branches: StaffProfileBranch[];
  assignedServices: StaffProfileService[];
  serviceAssignmentsError?: string | null;
  disabled: boolean;
  canEditBranch: boolean;
  canEditSystemRole: boolean;
  roleOptions: Array<{ value: string; label: string }>;
  onChange: <Field extends keyof StaffProfileDraft>(
    field: Field,
    value: StaffProfileDraft[Field]
  ) => void;
  onEditServices: () => void;
}) {
  if (activeTab === "work") {
    return (
      <EditStaffWorkSetupTab
        draft={draft}
        branches={branches}
        disabled={disabled}
        canEditBranch={canEditBranch}
        onChange={onChange}
      />
    );
  }

  if (activeTab === "access") {
    return (
      <EditStaffAccessStatusTab
        draft={draft}
        disabled={disabled}
        canEditSystemRole={canEditSystemRole}
        roleOptions={roleOptions}
        roleLockMessage="Only owner/manager can change system access role."
        onChange={onChange}
      />
    );
  }

  if (activeTab === "services") {
    return (
      <EditStaffServiceCapabilitiesTab
        services={assignedServices}
        onEditServices={onEditServices}
        loadError={serviceAssignmentsError}
        disabled={disabled}
      />
    );
  }

  return (
    <EditStaffProfileInfoTab
      draft={draft}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

function nullableString(value: string): string | null {
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}
