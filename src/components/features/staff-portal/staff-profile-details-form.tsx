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
import { STAFF_TYPE_LABELS, SYSTEM_ROLE_LABELS } from "@/constants/staff";

type StaffProfileDetailsFormProps = {
  fullName: string;
  nickname: string | null;
  systemRole: string;
  staffType: string | null;
  tierLabel: string;
};

const initialState: StaffProfileDetailsActionState = {};

function formatManagedLabel(
  value: string | null | undefined,
  labels: Partial<Record<string, string>>,
  fallback = "Unassigned"
): string {
  if (!value) return fallback;
  return (
    labels[value] ??
    value
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function StaffProfileDetailsForm({
  fullName,
  nickname,
  systemRole,
  staffType,
  tierLabel,
}: StaffProfileDetailsFormProps) {
  const systemRoleLabel = formatManagedLabel(systemRole, SYSTEM_ROLE_LABELS);
  const staffRoleLabel = formatManagedLabel(staffType, STAFF_TYPE_LABELS);
  const formKey = [fullName, nickname ?? "", systemRoleLabel, staffRoleLabel, tierLabel].join("|");

  return (
    <StaffProfileDetailsFormFields
      key={formKey}
      fullName={fullName}
      nickname={nickname}
      systemRoleLabel={systemRoleLabel}
      staffRoleLabel={staffRoleLabel}
      tierLabel={tierLabel}
    />
  );
}

function StaffProfileDetailsFormFields({
  fullName,
  nickname,
  systemRoleLabel,
  staffRoleLabel,
  tierLabel,
}: {
  fullName: string;
  nickname: string | null;
  systemRoleLabel: string;
  staffRoleLabel: string;
  tierLabel: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateMyProfileDetailsAction, initialState);
  const [fullNameValue, setFullNameValue] = useState(fullName);
  const [nicknameValue, setNicknameValue] = useState(nickname ?? "");

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
            <p className="mt-1 text-sm text-text-muted">Update your profile name and nickname.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Badge variant="outline" className="w-fit gap-1 border-border-soft text-text-muted">
              <Lock size={12} />
              Admin managed roles
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
          <LockedField label="System Role" value={systemRoleLabel} helperText="Managed by admin" />
          <LockedField label="Staff Role" value={staffRoleLabel} helperText="Managed by admin" />
          <LockedField label="Tier" value={tierLabel} helperText="Managed by admin" />
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

function LockedField({ label, value, helperText }: { label: string; value: string; helperText: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
        <Lock size={12} />
        {label}
      </div>
      <div className="min-h-10 rounded-lg border border-border-soft bg-surface-warm px-3 py-2 text-sm font-medium text-text">
        {value}
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{helperText}</p>
    </div>
  );
}
