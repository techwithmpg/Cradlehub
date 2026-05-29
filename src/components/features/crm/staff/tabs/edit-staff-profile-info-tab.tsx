"use client";

import {
  StaffProfileField,
  StaffProfileSection,
  staffProfileInputClass,
} from "../edit-staff-profile-form-parts";
import type { StaffProfileDraft } from "../edit-staff-profile-types";

export function EditStaffProfileInfoTab({
  draft,
  disabled,
  onChange,
}: {
  draft: StaffProfileDraft;
  disabled: boolean;
  onChange: <Field extends keyof StaffProfileDraft>(
    field: Field,
    value: StaffProfileDraft[Field]
  ) => void;
}) {
  return (
    <StaffProfileSection
      title="Basic Information"
      description="Keep client-facing staff details accurate for booking and CRM workflows."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StaffProfileField label="Full name" htmlFor="staff-full-name" required>
          <input
            id="staff-full-name"
            type="text"
            value={draft.fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
            disabled={disabled}
            className={staffProfileInputClass}
          />
        </StaffProfileField>

        <StaffProfileField
          label="Nickname"
          htmlFor="staff-nickname"
          helper="Optional. This is the name clients may recognize during booking."
        >
          <input
            id="staff-nickname"
            type="text"
            value={draft.nickname}
            onChange={(event) => onChange("nickname", event.target.value)}
            placeholder="Example: Mia, Joy, Ate Rose"
            disabled={disabled}
            className={staffProfileInputClass}
          />
        </StaffProfileField>

        <StaffProfileField label="Phone" htmlFor="staff-phone">
          <input
            id="staff-phone"
            type="tel"
            value={draft.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            disabled={disabled}
            className={staffProfileInputClass}
          />
        </StaffProfileField>
      </div>
    </StaffProfileSection>
  );
}
