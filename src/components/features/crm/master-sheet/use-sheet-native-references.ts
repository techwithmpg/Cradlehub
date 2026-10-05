"use client";

import useSWR from "swr";
import type { SheetNativeReferencesState } from "@/lib/integrations/google-sheets/sheet-native-types";

async function fetchReferences(url: string): Promise<SheetNativeReferencesState> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (response.status === 403) return { status: "forbidden", observedAt: new Date().toISOString() };
  if (!response.ok) return { status: "unavailable", observedAt: new Date().toISOString() };
  return response.json() as Promise<SheetNativeReferencesState>;
}

export function useSheetNativeReferences(date: string, enabled = true) {
  const key = enabled ? `/api/crm/master-sheet/references?date=${encodeURIComponent(date)}` : null;
  const { data, error, isLoading } = useSWR<SheetNativeReferencesState>(key, fetchReferences, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: false,
  });
  return {
    state: error ? { status: "unavailable" as const, observedAt: new Date().toISOString() } : data,
    isLoading,
  };
}
