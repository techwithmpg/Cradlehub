"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  unwrapWorkspaceSWRKey,
  useWorkspaceSWRKey,
  type WorkspaceScopedSWRKey,
} from "@/components/features/dashboard/workspace-swr-cache";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { DailyCashSummary } from "@/components/features/dashboard/daily-cash-summary";
import { ReportDateFilter } from "./report-date-filter";
import { ReportKpiCards } from "./report-kpi-cards";
import { RevenueByBranchCard } from "./revenue-by-branch-card";
import { StaffProductivityCard } from "./staff-productivity-card";
import { BookingTrendCard } from "./booking-trend-card";
import { ReportsEmptyState } from "./reports-empty-state";
import {
  getOwnerReportsDataAction,
  type OwnerReportsData,
  type OwnerReportsRequest,
} from "@/app/(dashboard)/owner/bookings/actions";
import { useWorkspaceReactivationRefresh } from "@/components/features/dashboard/use-workspace-visibility";

interface OwnerReportsPageProps {
  initialData: OwnerReportsData;
  initialRequest: OwnerReportsRequest;
}

export function OwnerReportsPage({ 
  initialData,
  initialRequest,
}: OwnerReportsPageProps) {
  const searchParams = useSearchParams();
  const request = useMemo<OwnerReportsRequest>(() => ({
    preset: searchParams.get("preset") || "last7",
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  }), [searchParams]);
  const key = useMemo(
    () => ["owner-reports", request.preset, request.from ?? "", request.to ?? ""] as const,
    [request.from, request.preset, request.to]
  );
  const initialKey = [
    "owner-reports",
    initialRequest.preset ?? "last7",
    initialRequest.from ?? "",
    initialRequest.to ?? "",
  ] as const;
  const isInitialKey = key.every((part, index) => part === initialKey[index]);
  const swrKey = useWorkspaceSWRKey(key);
  const { data, error, isValidating, mutate } = useSWR(
    swrKey,
    async (scopedKey: WorkspaceScopedSWRKey<typeof key>) => {
      const [, preset, from, to] = unwrapWorkspaceSWRKey(scopedKey);
      const result = await getOwnerReportsDataAction({
        preset,
        from: from || undefined,
        to: to || undefined,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    {
      fallbackData: isInitialKey ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnMount: !isInitialKey,
    }
  );
  const report = data ?? initialData;
  const refreshReports = useWorkspaceReactivationRefresh(async () => {
    await mutate();
  });
  const revenueData = report.revenueData;
  const staffData = report.staffData;
  const trendData = report.trendData;
  const hasData = revenueData.length > 0 || staffData.length > 0 || trendData.length > 0;

  const handlePresetChange = useCallback((preset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", preset);
    params.delete("from");
    params.delete("to");
    window.history.pushState(null, "", `/owner/reports?${params.toString()}`);
  }, [searchParams]);

  return (
    <div style={{ paddingBottom: "3rem" }}>
      <PageHeader
        title="Reports"
        description="Track revenue, bookings, branch performance, and staff productivity."
        icon="📊"
      />

      <ReportDateFilter
        currentPreset={request.preset ?? "last7"}
        from={report.from}
        to={report.to}
        isRefreshing={isValidating}
        onPresetChange={handlePresetChange}
        onRefresh={() => { void refreshReports().catch(() => undefined); }}
      />

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Report refresh failed. The last successful results are still shown.
        </div>
      ) : null}

      <div aria-live="polite" className="mb-3 min-h-4 text-xs text-[var(--cs-text-muted)]">
        {isValidating ? "Updating report data…" : `Updated ${new Date(report.generatedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`}
      </div>

      <DailyCashSummary data={report.cashSummary} label={report.dateRangeLabel} />

      {!hasData ? (
        <ReportsEmptyState />
      ) : (
        <>
          <ReportKpiCards 
            revenueData={revenueData} 
            staffData={staffData} 
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "1.5rem",
              alignItems: "start",
            }}
          >
            {/* Charts section - 2 columns on desktop */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
                gap: "1.5rem",
              }}
            >
              <RevenueByBranchCard data={revenueData} />
              <BookingTrendCard data={trendData} />
            </div>

            {/* Staff list - usually more rows, so full width or separate section */}
            <StaffProductivityCard data={staffData} />
          </div>
        </>
      )}

      {/* Footer info */}
      <div
        style={{
          marginTop: "2.5rem",
          padding: "1rem",
          borderRadius: "var(--cs-r-md)",
          backgroundColor: "rgba(122, 90, 138, 0.05)",
          border: "1px solid rgba(122, 90, 138, 0.1)",
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>ℹ️</span>
        Analytics are based on completed bookings. Data may take a few minutes to reflect recent updates.
      </div>
    </div>
  );
}
