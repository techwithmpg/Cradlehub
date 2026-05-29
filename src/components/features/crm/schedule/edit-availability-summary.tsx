"use client";

import { Building2, CalendarCheck2, Clock3 } from "lucide-react";
import { getStatusLabel, getWeeklySummary } from "./edit-availability-utils";
import type { EditAvailabilityStaffItem } from "./edit-availability-types";

type SummaryCardProps = {
  label: string;
  value: string;
  caption?: string;
  icon: React.ReactNode;
};

function SummaryCard({ label, value, caption, icon }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-[var(--cs-text-muted)]">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--cs-text)]">
            {value}
          </p>
          {caption ? (
            <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--cs-text-muted)]">
              {caption}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EditAvailabilitySummary({
  item,
  branchName,
}: {
  item: EditAvailabilityStaffItem;
  branchName: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <SummaryCard
        icon={<Clock3 className="size-4" />}
        label="Current Weekly Hours"
        value={getWeeklySummary(item)}
      />
      <SummaryCard
        icon={<Building2 className="size-4" />}
        label="Branch"
        value={branchName || "Assigned branch"}
      />
      <SummaryCard
        icon={<CalendarCheck2 className="size-4" />}
        label="Status"
        value={getStatusLabel(item)}
      />
    </div>
  );
}
