"use client";

import { useCallback } from "react";
import { refreshDispatchDataAction } from "@/lib/actions/dispatch-data-actions";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";

async function loadCrmDispatchData(params: {
  date: string;
  upcoming: boolean;
  selectedBookingId?: string;
}): Promise<DispatchData> {
  const result = await refreshDispatchDataAction(params.date, { upcoming: params.upcoming });
  if (!result.success) throw new Error(result.error);

  if (
    params.selectedBookingId &&
    !result.data.items.some((item) => item.id === params.selectedBookingId)
  ) {
    const exact = await refreshDispatchDataAction(params.date, {
      bookingId: params.selectedBookingId,
    });
    if (!exact.success) throw new Error(exact.error);
    return {
      ...result.data,
      items: [...result.data.items, ...exact.data.items],
    };
  }

  return result.data;
}

export function useLiveCrmDispatchData(params: {
  date: string;
  upcoming: boolean;
  selectedBookingId?: string;
  fallbackData: DispatchData;
}) {
  const requestKey = `/crm/dispatch?date=${encodeURIComponent(params.date)}&tab=${
    params.upcoming ? "upcoming" : "today"
  }&bookingId=${encodeURIComponent(params.selectedBookingId ?? "")}`;
  const fetcher = useCallback(
    () =>
      loadCrmDispatchData({
        date: params.date,
        upcoming: params.upcoming,
        selectedBookingId: params.selectedBookingId,
      }),
    [params.date, params.selectedBookingId, params.upcoming]
  );

  return useGenerationAwareWorkspaceSWR<DispatchData>(
    "crm-dispatch",
    requestKey,
    fetcher,
    params.fallbackData
  );
}
