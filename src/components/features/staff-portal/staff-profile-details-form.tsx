"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { updateMyProfileDetailsAction, type StaffProfileDetailsActionState } from "@/app/(dashboard)/staff-portal/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STAFF_TYPE_OPTIONS, SYSTEM_ROLE_OPTIONS, isStaffType, isSystemRole } from "@/constants/staff";

type StaffProfileDetailsFormProps = {
  fullName: string;
  nickname: string | null;
  systemRole: string;
  staffType: string | null;
  tierLabel: string;
};

const initialState: StaffProfileDetailsActionState = {};

export function StaffProfileDetailsForm({
  fullName,
  nickname,
  systemRole,
  staffType,
  tierLabel,
}: StaffProfileDetailsFormProps) {
  const normalizedSystemRole = isSystemRole(systemRole) ? systemRole : "";
  const normalizedStaffType = staffType && isStaffType(staffType) ? staffType : "";
  const formKey = [fullName, nickname ?? "", normalizedSystemRole, normalizedStaffType, tierLabel].join("|");

  return (
    <StaffProfileDetailsFormFields
      key={formKey}
      fullName={fullName}
      nickname={nickname}
      normalizedSystemRole={normalizedSystemRole}
      normalizedStaffType={normalizedStaffType}
      tierLabel={tierLabel}
    />
  );
}

function StaffProfileDetailsFormFields({
  fullName,
  nickname,
  normalizedSystemRole,
  normalizedStaffType,
  tierLabel,
}: {
  fullName: string;
  nickname: string | null;
  normalizedSystemRole: string;
  normalizedStaffType: string;
  tierLabel: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateMyProfileDetailsAction, initialState);
  const [fullNameValue, setFullNameValue] = useState(fullName);
  const [nicknameValue, setNicknameValue] = useState(nickname ?? "");
  const [systemRoleValue, setSystemRoleValue] = useState(normalizedSystemRole);
  const [staffTypeValue, setStaffTypeValue] = useState(normalizedStaffType);

  useEffect(() => {
    if (state.success) {
      toast.success("Profile details updated.");
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <section className="cs-card p-6">
      <form action={formAction} className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text">Account Details</h3>
            <p className="mt-1 text-sm text-text-muted">Update your profile details and supported role labels.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Badge variant="outline" className="w-fit gap-1 border-border-soft text-text-muted">
              <Lock size={12} />
              Tier managed
            </Badge>
            <SaveProfileButton />
          </div>
        </div>

        {state.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <EditableField
            id="fullName"
            name="fullName"
            label="Full Name"
            value={fullNameValue}
            onChange={setFullNameValue}
            disabled={pending}
            error={state.fieldErrors?.fullName?.[0]}
            required
          />
          <EditableField
            id="nickname"
            name="nickname"
            label="Nickname"
            value={nicknameValue}
            onChange={setNicknameValue}
            disabled={pending}
            error={state.fieldErrors?.nickname?.[0]}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-border-soft pt-5 md:grid-cols-3">
          <SelectField
            id="systemRole"
            name="systemRole"
            label="System Role"
            value={systemRoleValue}
            onChange={setSystemRoleValue}
            disabled={pending}
            error={state.fieldErrors?.systemRole?.[0]}
            options={SYSTEM_ROLE_OPTIONS}
          />
          <SelectField
            id="staffType"
            name="staffType"
            label="Staff Role"
            value={staffTypeValue}
            onChange={setStaffTypeValue}
            disabled={pending}
            error={state.fieldErrors?.staffType?.[0]}
            options={STAFF_TYPE_OPTIONS}
          />
          <LockedField label="Tier" value={tierLabel} />
        </div>
      </form>
    </section>
  );
}

function SaveProfileButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full gap-2 bg-sand text-white hover:bg-sand-dark sm:w-auto"
      aria-live="polite"
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      <span>{pending ? "Saving" : "Save Changes"}</span>
    </Button>
  );
}

function EditableField({
  id,
  name,
  label,
  value,
  onChange,
  disabled,
  error,
  required,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-text-muted">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="h-10 border-border-soft bg-surface"
      />
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  disabled,
  error,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-text-muted">
        {label}
      </Label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        className="h-10 w-full rounded-lg border border-border-soft bg-surface px-2.5 py-1 text-sm text-text outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        required
      >
        <option value="" disabled>
          Select {label.toLowerCase()}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
        <Lock size={12} />
        {label}
      </div>
      <div className="min-h-10 rounded-lg border border-border-soft bg-surface-warm px-3 py-2 text-sm font-medium text-text">
        {value}
      </div>
    </div>
  );
}
