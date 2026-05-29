"use client";

import { STAFF_TYPE_OPTIONS } from "@/constants/staff";
import { cn } from "@/lib/utils";
import {
  StaffProfileField,
  StaffProfileSection,
  staffProfileCheckboxClass,
  staffProfileInputClass,
} from "../edit-staff-profile-form-parts";
import type {
  StaffProfileBranch,
  StaffProfileDraft,
} from "../edit-staff-profile-types";

const TIER_OPTIONS = [
  { value: "senior", label: "Senior" },
  { value: "mid", label: "Mid" },
  { value: "junior", label: "Junior" },
  { value: "head", label: "Head" },
  { value: "n/a", label: "N/A" },
] as const;

export function EditStaffWorkSetupTab({
  draft,
  branches,
  disabled,
  canEditBranch,
  onChange,
}: {
  draft: StaffProfileDraft;
  branches: StaffProfileBranch[];
  disabled: boolean;
  canEditBranch: boolean;
  onChange: <Field extends keyof StaffProfileDraft>(
    field: Field,
    value: StaffProfileDraft[Field]
  ) => void;
}) {
  const branchLocked = disabled || !canEditBranch;

  return (
    <StaffProfileSection
      title="Work Setup"
      description="Set the staff member's operational branch, job function, and service tier."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StaffProfileField
          label="Branch"
          htmlFor="staff-branch"
          required
          helper={branchLocked ? "Only owner/manager can change branch." : undefined}
        >
          <select
            id="staff-branch"
            value={draft.branchId}
            onChange={(event) => onChange("branchId", event.target.value)}
            disabled={branchLocked}
            className={cn(staffProfileInputClass, branchLocked && "opacity-70")}
          >
            <option value="">Assigned branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </StaffProfileField>

        <StaffProfileField label="Job function" htmlFor="staff-type" required>
          <select
            id="staff-type"
            value={draft.staffType}
            onChange={(event) => onChange("staffType", event.target.value)}
            disabled={disabled}
            className={staffProfileInputClass}
          >
            {STAFF_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </StaffProfileField>

        <StaffProfileField label="Tier" htmlFor="staff-tier" required>
          <select
            id="staff-tier"
            value={draft.tier}
            onChange={(event) => onChange("tier", event.target.value)}
            disabled={disabled}
            className={staffProfileInputClass}
          >
            {TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </StaffProfileField>

        <div className="flex items-end">
          <label className="flex min-h-9 items-center gap-2 text-sm font-medium text-[var(--cs-text)]">
            <input
              type="checkbox"
              checked={draft.isHead}
              onChange={(event) => onChange("isHead", event.target.checked)}
              disabled={disabled}
              className={staffProfileCheckboxClass}
            />
            Department head / supervisor
          </label>
        </div>
      </div>
    </StaffProfileSection>
  );
}
