"use client";

import { BriefcaseBusiness, CheckCircle2, Phone } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  getStaffDisplayMeta,
  readBranchName,
} from "@/components/features/staff/staff-management-utils";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

export function EditStaffProfileIdentityCard({
  staffMember,
  serviceCount,
}: {
  staffMember: StaffMember;
  serviceCount: number;
}) {
  const meta = getStaffDisplayMeta(staffMember);
  const branchName = readBranchName(staffMember.branches);
  const statusLabel = staffMember.is_active ? "Active" : "Inactive";
  const roleLine = [
    meta.staffTypeLabel,
    meta.tierLabel,
    staffMember.is_active ? "Active" : "Inactive",
  ].filter(Boolean);

  return (
    <div className="shrink-0 border-b border-[var(--cs-border)] bg-[var(--cs-surface)] px-6 py-4">
      <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <UserAvatar
                name={staffMember.full_name}
                imageUrl={staffMember.avatar_url}
                size="lg"
                className="size-14 border border-[#bdd7c2] bg-[#e5f4ea] text-base text-[#276143]"
              />
              <span
                className={cn(
                  "absolute bottom-1 right-0 size-3 rounded-full border-2 border-[var(--cs-surface-warm)]",
                  staffMember.is_active ? "bg-[#2f8f57]" : "bg-[var(--cs-text-muted)]"
                )}
                aria-label={statusLabel}
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-[var(--cs-text)]">
                {staffMember.full_name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--cs-text-secondary)]">
                <span>{roleLine.join(" · ") || meta.roleLabel}</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold",
                    staffMember.is_active
                      ? "border-[#bdd7c2] bg-[#e8f5e9] text-[#276143]"
                      : "border-[var(--cs-border-soft)] bg-white text-[var(--cs-text-muted)]"
                  )}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-[var(--cs-text-muted)]">
                {branchName}
              </p>
              {staffMember.phone ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--cs-text-muted)]">
                  <Phone className="size-3" />
                  {staffMember.phone}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-44">
            <div className="rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 py-2">
              <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-[var(--cs-text-muted)]">
                <BriefcaseBusiness className="size-3" />
                Services
              </div>
              <p className="mt-1 text-sm font-bold text-[var(--cs-text)]">
                {serviceCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 py-2">
              <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-[var(--cs-text-muted)]">
                <CheckCircle2 className="size-3" />
                Status
              </div>
              <p className="mt-1 text-sm font-bold text-[var(--cs-text)]">
                {statusLabel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
