"use client";

import { UserRound } from "lucide-react";
import { AdminOverlayHeader } from "@/components/shared/overlays";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import { cn } from "@/lib/utils";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { getStatusLabel } from "./edit-availability-utils";
import type { EditAvailabilityStaffItem } from "./edit-availability-types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function EditAvailabilityHeader({
  item,
}: {
  item: EditAvailabilityStaffItem;
}) {
  const displayName = getStaffAdminName(item.staff);
  const roleLabel =
    STAFF_TYPE_LABELS[item.staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ??
    item.staff.staff_type ??
    "Staff";
  const status = getStatusLabel(item);
  const isScheduled = status === "Scheduled";

  return (
    <div className="shrink-0 border-b border-[var(--cs-border)] bg-[var(--cs-surface)] pb-4">
      <AdminOverlayHeader
        title="Edit Availability"
        className="border-b-0 pb-0 pr-14"
      />

      <div className="mx-5 mt-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#dfeedd] text-sm font-bold text-[#4a7c59]">
            {displayName ? initials(displayName) : <UserRound className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--cs-text)]">
              {displayName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              {roleLabel}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.staff.tier ? (
                <span className="rounded-full border border-[var(--cs-border-soft)] bg-white px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--cs-text-secondary)]">
                  {titleCase(item.staff.tier)}
                </span>
              ) : null}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                  isScheduled
                    ? "bg-[#e8f5e9] text-[#2f6f3e]"
                    : "bg-[var(--cs-surface)] text-[var(--cs-text-muted)]"
                )}
              >
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
