"use client";

import useSWR from "swr";
import { SchedulePanel } from "../workspace/schedule-panel";
import { ScheduleEmptyState } from "../workspace/schedule-empty-state";
import { Loader2, Users } from "lucide-react";
import { StaffSchedulePageClient } from "@/components/features/staff-schedule/staff-schedule-page-client";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

type StaffScheduleData = {
  items: StaffScheduleItem[];
  rulesByGroup: Record<string, StaffGroupScheduleRule[]>;
};

async function fetcher(url: string): Promise<StaffScheduleData> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Staff schedule fetch failed: ${res.status}`);
  return res.json();
}

export function StaffScheduleTab({
  branchId,
  branchName,
  initialItems,
}: {
  branchId: string;
  branchName: string;
  initialItems: StaffScheduleItem[];
}) {
  const { data, isLoading, mutate } = useSWR<StaffScheduleData>(
    `/api/crm/staff-schedule/overview?branchId=${branchId}`,
    fetcher,
    {
      fallbackData: { items: initialItems, rulesByGroup: {} },
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  if (isLoading) {
    return (
      <SchedulePanel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "3rem 1rem" }}>
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--cs-text-muted)" }} />
          <span style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>Loading staff schedules…</span>
        </div>
      </SchedulePanel>
    );
  }

  if (!data) {
    return (
      <ScheduleEmptyState
        title="Unable to load staff schedules"
        description="There was a problem fetching staff schedule data. Please try again."
        icon={<Users size={18} />}
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <ScheduleEmptyState
        title="No staff members found"
        description="No staff are configured for this branch. Add staff in Settings to begin scheduling."
        icon={<Users size={18} />}
      />
    );
  }

  return (
    <StaffSchedulePageClient
      branchId={branchId}
      branchName={branchName}
      items={data.items}
      rulesByGroup={data.rulesByGroup}
      onDataRefresh={() => {
        void mutate();
      }}
    />
  );
}
