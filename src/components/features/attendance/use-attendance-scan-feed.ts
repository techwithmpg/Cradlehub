"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { useAttendanceScanRealtime } from "@/components/features/attendance/use-attendance-scan-realtime";
import type {
  AttendanceScanFeedData,
  AttendanceScanFeedWorkspace,
} from "@/lib/attendance/types";
import {
  unwrapWorkspaceSWRKey,
  useWorkspaceSWRKey,
  type WorkspaceScopedSWRKey,
} from "@/components/features/dashboard/workspace-swr-cache";

const REFRESH_ERROR = "Attendance activity could not be refreshed.";

async function fetchAttendanceFeed(
  key: WorkspaceScopedSWRKey<string>
): Promise<AttendanceScanFeedData> {
  const url = unwrapWorkspaceSWRKey(key);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(REFRESH_ERROR);
  return (await response.json()) as AttendanceScanFeedData;
}

function buildFeedKey({
  workspace,
  selectedDate,
  branchId,
  maxItems,
}: {
  workspace: AttendanceScanFeedWorkspace;
  selectedDate: string;
  branchId: string | null;
  maxItems: number;
}): string {
  const params = new URLSearchParams({
    workspace,
    selectedDate,
    maxItems: String(maxItems),
  });
  if (branchId) params.set("branchId", branchId);
  return `/api/attendance/recent-scans?${params.toString()}`;
}

export function useAttendanceScanFeed({
  workspace,
  selectedDate,
  branchId,
  initialFeed,
  maxItems,
}: {
  workspace: AttendanceScanFeedWorkspace;
  selectedDate: string;
  branchId: string | null;
  initialFeed: AttendanceScanFeedData;
  maxItems: number;
}) {
  const feedKey = useMemo(
    () => buildFeedKey({ workspace, selectedDate, branchId, maxItems }),
    [branchId, maxItems, selectedDate, workspace]
  );
  const swrKey = useWorkspaceSWRKey(feedKey);
  const { data, error, isValidating, mutate } = useSWR(
    swrKey,
    fetchAttendanceFeed,
    {
      fallbackData: initialFeed,
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );
  const refreshFeed = useCallback(() => {
    void mutate();
  }, [mutate]);

  useAttendanceScanRealtime({ branchId, selectedDate, onRefresh: refreshFeed });

  return {
    feed: data ?? initialFeed,
    error: error ? REFRESH_ERROR : null,
    isValidating,
    refreshFeed,
  };
}
