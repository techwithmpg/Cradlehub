"use client";

/**
 * CrmScheduleView
 *
 * Client shell that wraps ScheduleWorkspace with SWR.
 * - On first load: renders immediately from `initialData` (server-fetched)
 * - On return navigation: renders from SWR in-memory cache INSTANTLY
 * - Silently revalidates in background after `dedupingInterval`
 * - keepPreviousData: shows last date's data while new date loads (no flicker)
 */

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { ScheduleWorkspace } from "./schedule-workspace";
import { SystemReadinessBar } from "@/components/shared/system-readiness-bar";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";
import type { ReadinessResult } from "@/types/readiness";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];
type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type ScheduleApiPayload = {
  branchId: string;
  branchName: string;
  staffRows: DailyScheduleStaffRow[];
  branchResources: ResourceRow[];
  stats: {
    total: number;
    confirmed: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    no_show: number;
  };
  readiness: ReadinessResult | null;
};

type CrmScheduleViewProps = {
  initialData: ScheduleApiPayload;
  paymentAction?: ActionFn;
};

async function fetcher(url: string): Promise<ScheduleApiPayload> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Schedule fetch failed: ${res.status}`);
  return res.json() as Promise<ScheduleApiPayload>;
}

export function CrmScheduleView({ initialData, paymentAction }: CrmScheduleViewProps) {
  const searchParams = useSearchParams();
  const today = new Date().toISOString().split("T")[0]!;
  const date = searchParams.get("date") ?? today;

  const { data } = useSWR<ScheduleApiPayload>(
    `/api/crm/schedule?date=${date}`,
    fetcher,
    {
      fallbackData: initialData,
      // Keep showing previous date's data while the new date loads
      keepPreviousData: true,
      // Don't re-fetch if data is less than 30 s old
      dedupingInterval: 30_000,
      // Refresh when user tabs back in (catches changes from other windows)
      revalidateOnFocus: true,
      // Don't refetch on reconnect (realtime subscription handles live updates)
      revalidateOnReconnect: false,
    }
  );

  const payload = data ?? initialData;
  const readiness = payload.readiness;

  return (
    <>
      {readiness && (
        <SystemReadinessBar
          issues={readiness.issues}
          status={readiness.status}
        />
      )}
      <ScheduleWorkspace
        workspaceContext="crm"
        viewerRole="crm"
        branchId={payload.branchId}
        branchName={payload.branchName}
        date={date}
        branches={[{ id: payload.branchId, name: payload.branchName }]}
        staffRows={payload.staffRows}
        branchResources={payload.branchResources}
        stats={payload.stats}
        viewBookingsHref="/crm/bookings"
        paymentAction={paymentAction}
      />
    </>
  );
}
