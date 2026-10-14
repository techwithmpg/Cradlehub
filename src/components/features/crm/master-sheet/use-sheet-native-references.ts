"use client";

import useSWR from "swr";
import type { SheetNativeReferencesState } from "@/lib/integrations/google-sheets/sheet-native-types";

async function fetchReferences(url: string): Promise<SheetNativeReferencesState> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (response.status === 403) return { status: "forbidden", observedAt: new Date().toISOString() };
  if (!response.ok) return { status: "unavailable", observedAt: new Date().toISOString() };
  return response.json() as Promise<SheetNativeReferencesState>;
}

export function useSheetNativeReferences(date: string, enabled = true, live = false) {
  const key = enabled ? `/api/crm/master-sheet/references?date=${encodeURIComponent(date)}` : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<SheetNativeReferencesState>(
    key,
    fetchReferences,
    {
      dedupingInterval: live ? 2_000 : 60_000,
      // Google metadata plus two tab reads can take up to 30s at the reader's timeouts.
      refreshInterval: live ? 60_000 : 0,
      refreshWhenHidden: false,
      revalidateOnFocus: live,
      revalidateOnReconnect: live,
      // SWR retains the current key's data during a background revalidation.
      // A different selected date must not briefly display the old date's rows.
      keepPreviousData: false,
    }
  );
  return {
    state: error ? { status: "unavailable" as const, observedAt: new Date().toISOString() } : data,
    isLoading,
    isRefreshing: isValidating,
    refresh: () => mutate(),
  };
}
