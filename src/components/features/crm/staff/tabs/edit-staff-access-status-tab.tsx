"use client";

import { AlertTriangle } from "lucide-react";
import {
  StaffProfileField,
  StaffProfileSection,
  staffProfileCheckboxClass,
  staffProfileInputClass,
} from "../edit-staff-profile-form-parts";
import type { StaffProfileDraft } from "../edit-staff-profile-types";

export type AccessRoleOption = {
  value: string;
  label: string;
};

export function EditStaffAccessStatusTab({
  draft,
  disabled,
  canEditSystemRole,
  roleOptions,
  roleLockMessage,
  onChange,
}: {
  draft: StaffProfileDraft;
  disabled: boolean;
  canEditSystemRole: boolean;
  roleOptions: AccessRoleOption[];
  roleLockMessage: string;
  onChange: <Field extends keyof StaffProfileDraft>(
    field: Field,
    value: StaffProfileDraft[Field]
  ) => void;
}) {
  const roleLocked = disabled || !canEditSystemRole;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <StaffProfileSection
        title="Access Role"
        description="System access controls which workspace the staff member can open."
      >
        <StaffProfileField
          label="System access role"
          htmlFor="staff-system-role"
          required
          helper={roleLocked ? roleLockMessage : undefined}
        >
          <select
            id="staff-system-role"
            value={draft.systemRole}
            onChange={(event) => onChange("systemRole", event.target.value)}
            disabled={roleLocked}
            className={staffProfileInputClass}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </StaffProfileField>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Access changes can affect which workspace the user can open.</span>
          </div>
        </div>
      </StaffProfileSection>

      <StaffProfileSection
        title="Operational Status"
        description="Inactive staff will not appear in scheduling or booking flows."
      >
        <label className="flex items-start gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-3 text-sm text-[var(--cs-text)]">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => onChange("isActive", event.target.checked)}
            disabled={disabled}
            className={staffProfileCheckboxClass}
          />
          <span>
            <span className="block font-semibold">Active staff member</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--cs-text-muted)]">
              Active staff can be scheduled and assigned operational work.
            </span>
          </span>
        </label>
      </StaffProfileSection>
    </div>
  );
}
