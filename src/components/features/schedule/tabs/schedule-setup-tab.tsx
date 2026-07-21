"use client";

import useSWR from "swr";
import { SchedulePanel } from "../workspace/schedule-panel";
import { ScheduleEmptyState } from "../workspace/schedule-empty-state";
import { Loader2, Settings } from "lucide-react";
import { ScheduleSetupWorkspace } from "@/components/features/staff-schedule/schedule-setup-workspace";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import {
  unwrapWorkspaceSWRKey,
  useWorkspaceSWRKey,
  type WorkspaceScopedSWRKey,
} from "@/components/features/dashboard/workspace-swr-cache";

type SetupData = {
  items: StaffScheduleItem[];
};

async function fetcher(key: WorkspaceScopedSWRKey<string>): Promise<SetupData> {
  const url = unwrapWorkspaceSWRKey(key);
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Schedule setup fetch failed: ${res.status}`);
  return res.json();
}

export function ScheduleSetupTab({
  branchId,
  onScheduleChanged,
}: {
  branchId: string;
  onScheduleChanged?: () => void | Promise<void>;
}) {
  const setupKey = useWorkspaceSWRKey(
    `/api/crm/staff-schedule/overview?branchId=${branchId}`
  );
  const { data, isLoading, mutate } = useSWR<SetupData>(
    setupKey,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );

  function handleDataRefresh() {
    void mutate();
    void onScheduleChanged?.();
  }

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
      branchId={branchId}
      onDataRefresh={handleDataRefresh}
    />
  );
}
