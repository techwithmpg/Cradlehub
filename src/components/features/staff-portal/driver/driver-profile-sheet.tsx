"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StaffProfilePhotoUploader } from "@/components/features/staff-portal/staff-profile-photo-uploader";
import {
  updateMyProfileDetailsAction,
  type StaffProfileDetailsActionState,
} from "@/app/(dashboard)/staff-portal/actions";
import { STAFF_TYPE_LABELS, SYSTEM_ROLE_LABELS } from "@/constants/staff";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import { Lock, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type DriverProfileSheetProps = {
  staff: StaffPortalStaff;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialState: StaffProfileDetailsActionState = {};

function titleCaseToken(value: string | null | undefined, fallback = "Unassigned"): string {
  if (!value) return fallback;
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function branchLabel(staff: StaffPortalStaff): string {
  const relation = staff.branches;
  if (Array.isArray(relation)) return relation[0]?.name ?? "Assigned branch";
  return relation?.name ?? (staff.branch_id ? "Assigned branch" : "No branch assigned");
}

function SaveProfileButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="h-10 w-full gap-2 bg-[var(--cs-staff-accent)] text-white hover:bg-[var(--cs-staff-accent)]/90">
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      {pending ? "Saving" : "Save Changes"}
    </Button>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
        <Lock size={12} />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--cs-text)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--cs-text-muted)]">Managed by admin</div>
    </div>
  );
}

export function DriverProfileSheet({ staff, open, onOpenChange }: DriverProfileSheetProps) {
  const router = useRouter();
  const displayName = getStaffDisplayName(staff);
  const [state, formAction, pending] = useActionState(updateMyProfileDetailsAction, initialState);
  const [fullName, setFullName] = useState(staff.full_name);
  const [nickname, setNickname] = useState(staff.nickname ?? "");
  const systemRole = SYSTEM_ROLE_LABELS[staff.system_role as keyof typeof SYSTEM_ROLE_LABELS] ?? titleCaseToken(staff.system_role);
  const staffType = staff.staff_type
    ? STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? titleCaseToken(staff.staff_type)
    : "Driver";
  const tier = titleCaseToken(staff.tier, "Not assigned");

  useEffect(() => {
    if (state.success) {
      toast.success("Profile details updated.");
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] rounded-t-3xl border-[#eadfce] bg-[#fffaf4] p-0 shadow-2xl md:hidden"
        showCloseButton
      >
        <SheetHeader className="border-b border-[var(--cs-border-soft)] px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-bold text-[var(--cs-text)]">{displayName}</SheetTitle>
              <SheetDescription className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--cs-staff-accent)]">
                Staff · Driver
              </SheetDescription>
            </div>
            <Badge variant="outline" className="shrink-0 border-[rgba(90,138,106,0.25)] bg-[var(--cs-success-bg)] text-[var(--cs-success)]">
              Driver
            </Badge>
          </div>
        </SheetHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <StaffProfilePhotoUploader
              staffId={staff.id}
              fullName={displayName}
              initialAvatarUrl={staff.avatar_url}
            />

            <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--cs-text)]">Personal Information</h3>
              <form action={formAction} className="mt-3 space-y-3">
                {state.error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {state.error}
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="driverFullName" className="text-xs font-semibold text-[var(--cs-text-muted)]">
                    Full Name
                  </Label>
                  <Input
                    id="driverFullName"
                    name="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    disabled={pending}
                    required
                    aria-invalid={state.fieldErrors?.fullName ? "true" : undefined}
                    className="h-10 border-[var(--cs-border-soft)] bg-[var(--cs-surface)]"
                  />
                  {state.fieldErrors?.fullName?.[0] ? (
                    <p className="text-xs text-red-700">{state.fieldErrors.fullName[0]}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="driverNickname" className="text-xs font-semibold text-[var(--cs-text-muted)]">
                    Nickname
                  </Label>
                  <Input
                    id="driverNickname"
                    name="nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    disabled={pending}
                    aria-invalid={state.fieldErrors?.nickname ? "true" : undefined}
                    className="h-10 border-[var(--cs-border-soft)] bg-[var(--cs-surface)]"
                  />
                  {state.fieldErrors?.nickname?.[0] ? (
                    <p className="text-xs text-red-700">{state.fieldErrors.nickname[0]}</p>
                  ) : null}
                </div>

                <SaveProfileButton />
              </form>
            </section>

            <section className="space-y-3 rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--cs-text)]">Work Information</h3>
              <ReadOnlyRow label="Staff Role" value={staffType} />
              <ReadOnlyRow label="System Role" value={systemRole} />
              <ReadOnlyRow label="Tier" value={tier} />
              <ReadOnlyRow label="Branch" value={branchLabel(staff)} />
              <ReadOnlyRow label="Active Status" value="Active" />
              <ReadOnlyRow label="Permissions" value="Driver portal access" />
            </section>

            <Link
              href="/staff-portal/profile"
              onClick={() => onOpenChange(false)}
              className="flex h-10 items-center justify-center rounded-xl border border-[var(--cs-border-soft)] bg-white text-sm font-semibold text-[var(--cs-text)] shadow-xs"
            >
              Open Full Profile
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
