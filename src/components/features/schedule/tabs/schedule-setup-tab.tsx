"use client";

import useSWR from "swr";
import { SchedulePanel } from "../workspace/schedule-panel";
import { ScheduleEmptyState } from "../workspace/schedule-empty-state";
import { Loader2, Settings } from "lucide-react";
import { ScheduleSetupWorkspace } from "@/components/features/staff-schedule/schedule-setup-workspace";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import type { StaffScheduleGroup, StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

type SetupData = {
  items: StaffScheduleItem[];
  groups: StaffScheduleGroup[];
  rulesByGroup: Record<string, StaffGroupScheduleRule[]>;
};

async function fetcher(url: string): Promise<SetupData> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Schedule setup fetch failed: ${res.status}`);
  return res.json();
}

export function ScheduleSetupTab({ branchId }: { branchId: string }) {
  const { data, isLoading } = useSWR<SetupData>(
    `/api/crm/staff-schedule/overview?branchId=${branchId}`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );

  if (isLoading) {
    return (
      <SchedulePanel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "3rem 1rem" }}>
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--cs-text-muted)" }} />
          <span style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>Loading schedule setup…</span>
        </div>
      </SchedulePanel>
    );
  }

  if (!data) {
    return (
      <ScheduleEmptyState
        title="Unable to load schedule setup"
        description="There was a problem fetching schedule configuration. Please try again."
        icon={<Settings size={18} />}
      />
    );
  }

  return (
    <ScheduleSetupWorkspace
      items={data.items}
      groups={data.groups}
      rulesByGroup={data.rulesByGroup}
      branchId={branchId}
    />
  );
}
