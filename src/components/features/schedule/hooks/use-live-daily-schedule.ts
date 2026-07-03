"use client";

import useSWR from "swr";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";
import type { ReadinessResult } from "@/types/readiness";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

export type ScheduleStats = {
  total: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
};

export type DailyScheduleApiResponse = {
  branchId: string;
  branchName: string;
  staffRows: DailyScheduleStaffRow[];
  branchResources: ResourceRow[];
  stats: ScheduleStats;
  readiness: ReadinessResult | null;
};

export class DailyScheduleFetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DailyScheduleFetchError";
    this.status = status;
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    const message = body.error ?? body.message;
    if (typeof message === "string" && message.trim()) return message;
  } catch {
    // Fall through to the generic status message.
  }
  return `Schedule refresh failed (${response.status}).`;
}

export async function scheduleFetcher(url: string): Promise<DailyScheduleApiResponse> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new DailyScheduleFetchError(await getErrorMessage(response), response.status);
  }

  return response.json() as Promise<DailyScheduleApiResponse>;
}

export function useLiveDailySchedule(params: {
  date: string;
  fallbackData: DailyScheduleApiResponse;
}) {
  const key = `/api/crm/schedule?date=${encodeURIComponent(params.date)}`;

  return useSWR<DailyScheduleApiResponse>(key, scheduleFetcher, {
    fallbackData: params.fallbackData,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1_000,
    keepPreviousData: true,
  });
}
