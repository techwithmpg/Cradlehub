"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  updateMyProfileDetailsAction,
  type StaffProfileDetailsActionState,
} from "@/app/(dashboard)/staff-portal/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import { DriverProfilePhotoField } from "./driver-profile-photo-field";

type DriverProfileEditFormProps = {
  staff: StaffPortalStaff;
  onCancel: () => void;
  onSaved: () => void;
};

const initialState: StaffProfileDetailsActionState = {};

export function DriverProfileEditForm({ staff, onCancel, onSaved }: DriverProfileEditFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateMyProfileDetailsAction, initialState);
  const [fullName, setFullName] = useState(staff.full_name);
  const [nickname, setNickname] = useState(staff.nickname ?? "");
  const [phone, setPhone] = useState(staff.phone ?? "");

  useEffect(() => {
    if (!state.success) return;
    toast.success("Profile details updated.");
    router.refresh();
    onSaved();
  }, [onSaved, router, state.success]);

  return (
    <div className="space-y-4">
      <div>
        <h2 id="driver-profile-edit-title" className="text-3xl font-black leading-tight text-stone-950">
          Edit Profile
        </h2>
        <p className="mt-1 text-sm font-semibold text-stone-500">Update your profile information</p>
      </div>

      <DriverProfilePhotoField staff={staff} />

      <form action={formAction} className="space-y-4">
        {state.error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {state.error}
          </div>
        ) : null}

        <ProfileInputField
          id="driver-profile-full-name"
          name="fullName"
          label="Full Name"
          value={fullName}
          onChange={setFullName}
          disabled={pending}
          required
          error={state.fieldErrors?.fullName?.[0]}
        />

        <ProfileInputField
          id="driver-profile-nickname"
          name="nickname"
          label="Nickname"
          value={nickname}
          onChange={setNickname}
          disabled={pending}
          error={state.fieldErrors?.nickname?.[0]}
        />

        <ProfileInputField
          id="driver-profile-phone"
          name="phone"
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          disabled={pending}
          error={state.fieldErrors?.phone?.[0]}
        />

        <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-stone-200/80 bg-[#fffaf4]/95 px-5 py-4 backdrop-blur-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-12 flex-1 rounded-2xl border border-stone-200 bg-white text-sm font-black text-stone-700 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-emerald-800 text-sm font-black text-white shadow-lg shadow-emerald-950/15 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? "Saving" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

type ProfileInputFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  type?: string;
  required?: boolean;
};

function ProfileInputField({
  id,
  name,
  label,
  value,
  onChange,
  disabled,
  error,
  type = "text",
  required = false,
}: ProfileInputFieldProps) {
  return (
    <div className="space-y-2 rounded-3xl border border-stone-200/90 bg-white/95 p-4 shadow-sm">
      <Label htmlFor={id} className="text-sm font-black text-stone-950">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="h-12 rounded-2xl border-stone-200 bg-[#fbf8f2] text-base font-semibold text-stone-950"
      />
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
