"use client";

import { Building2, CalendarCheck2, Clock3 } from "lucide-react";
import { CrmStatCard } from "@/components/features/crm/shared/crm-cards";
import { getStatusLabel, getWeeklySummary } from "./edit-availability-utils";
import type { EditAvailabilityStaffItem } from "./edit-availability-types";

export function EditAvailabilitySummary({
  item,
  branchName,
}: {
  item: EditAvailabilityStaffItem;
  branchName: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <CrmStatCard
        icon={<Clock3 className="size-4" />}
        title="Current Weekly Hours"
        value={getWeeklySummary(item)}
        tone="info"
        compact
        decorative={false}
      />
      <CrmStatCard
        icon={<Building2 className="size-4" />}
        title="Branch"
        value={branchName || "Assigned branch"}
        tone="neutral"
        compact
        decorative={false}
      />
      <CrmStatCard
        icon={<CalendarCheck2 className="size-4" />}
        title="Status"
        value={getStatusLabel(item)}
        tone="success"
        compact
        decorative={false}
      />
    </div>
  );
}
