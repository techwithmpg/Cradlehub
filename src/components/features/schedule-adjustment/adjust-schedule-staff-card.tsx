"use client";

import { CheckCircle2, CircleAlert, MapPin, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdjustScheduleStaffItem } from "./adjust-schedule-types";

type AdjustScheduleStaffCardProps = {
  item: AdjustScheduleStaffItem;
  branchName: string;
  statusLabel: string;
  validationLabel: string;
  hasErrors: boolean;
  lastUpdatedLabel: string | null;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function labelize(value: string | null | undefined): string {
  if (!value) return "Staff";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdjustScheduleStaffCard({
  item,
  branchName,
  statusLabel,
  validationLabel,
  hasErrors,
  lastUpdatedLabel,
}: AdjustScheduleStaffCardProps) {
  const staff = item.staff;
  const titleBits = [
    labelize(staff.staff_type),
    staff.tier ? labelize(staff.tier) : null,
    staff.is_head ? "Head" : null,
  ].filter(Boolean);

  return (
    <section className="grid shrink-0 gap-4 rounded-lg border border-[#e3dccf] bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,1.1fr)_minmax(160px,0.7fr)_minmax(160px,0.7fr)] lg:items-center">
      <div className="flex min-w-0 items-center gap-4">
        {staff.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staff.avatar_url}
            alt=""
            className="size-16 shrink-0 rounded-full border border-[#d9e8dd] object-cover"
          />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-[#b7d5c2] bg-[#ecf7ef] text-sm font-bold text-[#0f6b43]">
            {initials(staff.full_name) || <UserRound className="size-5" />}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-[#181713] sm:text-base">{staff.full_name}</h3>
            {staff.nickname ? (
              <span className="rounded-full bg-[#f4efe4] px-2 py-0.5 text-[0.68rem] font-semibold text-[#6a4f1e]">
                {staff.nickname}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {titleBits.map((bit) => (
              <span
                key={bit}
                className="rounded-md border border-[#cce5d5] bg-[#eaf7ef] px-2 py-1 text-[0.68rem] font-semibold text-[#0f6b43]"
              >
                {bit}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#615c52]">Staff ID: {staff.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      <div className="border-t border-[#eee8dc] pt-3 text-xs lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
        <p className="font-bold text-[#181713]">Branch</p>
        <p className="mt-2 flex items-center gap-1.5 text-[#3a352d]">
          <MapPin className="size-3.5 text-[#0f6b43]" />
          {branchName}
        </p>
        <p className="mt-1 text-[#615c52]">{labelize(staff.system_role ?? staff.staff_type)}</p>
      </div>

      <div className="border-t border-[#eee8dc] pt-3 text-xs lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
        <p className="font-bold text-[#181713]">Schedule Status</p>
        <p className="mt-2 font-semibold text-[#0b57d0]">{statusLabel}</p>
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.68rem] font-semibold",
            hasErrors ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
          )}
        >
          {hasErrors ? <CircleAlert className="size-3" /> : <CheckCircle2 className="size-3" />}
          {validationLabel}
        </p>
        {lastUpdatedLabel ? <p className="mt-2 text-[#615c52]">Last updated: {lastUpdatedLabel}</p> : null}
      </div>
    </section>
  );
}
