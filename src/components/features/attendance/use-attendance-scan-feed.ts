"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useAttendanceScanRealtime } from "@/components/features/attendance/use-attendance-scan-realtime";
import {
  mergeAttendanceScanFeed,
  pruneAttendanceLastHourOperations,
} from "@/lib/attendance/attendance-scan-feed-state";
import {
  mapStoredAttendanceScan,
  type AttendanceRealtimeScanRow,
} from "@/lib/attendance/recent-scan-event";
import { rootAttendanceOperationId } from "@/lib/attendance/recent-scan-grouping";
import type { AttendanceScanFeedData, AttendanceScanFeedWorkspace } from "@/lib/attendance/types";
import {
  unwrapWorkspaceSWRKey,
  useWorkspaceSWRKey,
  type WorkspaceScopedSWRKey,
} from "@/components/features/dashboard/workspace-swr-cache";

const REFRESH_ERROR = "Attendance activity could not be refreshed.";
const ONE_HOUR_MS = 60 * 60 * 1000;

async function fetchAttendanceFeedUrl(url: string): Promise<AttendanceScanFeedData> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(REFRESH_ERROR);
  return (await response.json()) as AttendanceScanFeedData;
}

async function fetchAttendanceFeed(
  key: WorkspaceScopedSWRKey<string>
): Promise<AttendanceScanFeedData> {
  return fetchAttendanceFeedUrl(unwrapWorkspaceSWRKey(key));
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
  const { data, error, isValidating, mutate } = useSWR(swrKey, fetchAttendanceFeed, {
    fallbackData: initialFeed,
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: false,
  });
  const feedRef = useRef(data ?? initialFeed);
  const deltaRequestRef = useRef<Promise<void> | null>(null);
  const [deltaError, setDeltaError] = useState(false);

  useEffect(() => {
    feedRef.current = data ?? initialFeed;
  }, [data, initialFeed]);

  const reconcileDelta = useCallback(() => {
    if (deltaRequestRef.current) return deltaRequestRef.current;
    const cursor = feedRef.current.nextCursor;
    if (!cursor) return Promise.resolve();

    const request = (async () => {
      try {
        const separator = feedKey.includes("?") ? "&" : "?";
        const delta = await fetchAttendanceFeedUrl(
          `${feedKey}${separator}after=${encodeURIComponent(cursor)}`
        );
        await mutate(
          (current) =>
            mergeAttendanceScanFeed(
              current ?? feedRef.current,
              delta.items,
              delta.lastHourOperations,
              maxItems,
              Date.now(),
              delta.nextCursor
            ),
          { revalidate: false }
        );
        setDeltaError(false);
      } catch {
        setDeltaError(true);
      } finally {
        deltaRequestRef.current = null;
      }
    })();
    deltaRequestRef.current = request;
    return request;
  }, [feedKey, maxItems, mutate]);

  const handleScanEvent = useCallback(
    (row: AttendanceRealtimeScanRow) => {
      const current = feedRef.current;
      const scan = mapStoredAttendanceScan(row, {
        branchId: current.branchId,
        branchName: current.branchName,
        timezone: current.timezone,
      });
      if (!scan) {
        void reconcileDelta();
        return;
      }

      const operationId = rootAttendanceOperationId(row.operation_id, row.request_id, row.id);
      void mutate(
        (value) =>
          mergeAttendanceScanFeed(
            value ?? current,
            [scan],
            [{ operationId, occurredAt: row.created_at }],
            maxItems
          ),
        { revalidate: false }
      );
    },
    [maxItems, mutate, reconcileDelta]
  );

  const realtimeStatus = useAttendanceScanRealtime({
    branchId,
    selectedDate,
    onScanEvent: handleScanEvent,
    onReconcile: reconcileDelta,
  });

  const lastHourOperations = (data ?? initialFeed).lastHourOperations;
  useEffect(() => {
    const pruned = pruneAttendanceLastHourOperations(lastHourOperations);
    const nextExpiry = pruned[0]
      ? new Date(pruned[0].occurredAt).getTime() + ONE_HOUR_MS - Date.now()
      : null;
    if (nextExpiry === null) return;
    const timer = window.setTimeout(
      () => {
        void mutate(
          (current) =>
            current ? mergeAttendanceScanFeed(current, [], [], maxItems, Date.now()) : current,
          { revalidate: false }
        );
      },
      Math.max(1, nextExpiry + 25)
    );
    return () => window.clearTimeout(timer);
  }, [lastHourOperations, maxItems, mutate]);

  const refreshFeed = useCallback(() => {
    setDeltaError(false);
    void mutate();
  }, [mutate]);
  const effectiveRealtimeStatus =
    (error || deltaError) && realtimeStatus === "live" ? "delayed" : realtimeStatus;

  return {
    feed: data ?? initialFeed,
    error: error || deltaError ? REFRESH_ERROR : null,
    isValidating,
    realtimeStatus: effectiveRealtimeStatus,
    refreshFeed,
  };
}
