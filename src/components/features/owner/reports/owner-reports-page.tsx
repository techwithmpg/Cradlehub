"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  unwrapWorkspaceSWRKey,
  useWorkspaceSWRKey,
  type WorkspaceScopedSWRKey,
} from "@/components/features/dashboard/workspace-swr-cache";
import { useWorkspaceReactivationRefresh } from "@/components/features/dashboard/use-workspace-visibility";
import {
  getOwnerReportsDataAction,
  getOwnerReportSheetEvidenceAction,
} from "@/app/(dashboard)/owner/bookings/actions";
import type { OwnerReportsData, OwnerReportsRequest, ReportTab } from "@/lib/owner/reports-types";
import { ReportsHeader } from "./reports-header";
import { ReportsTabBar } from "./reports-tab-bar";
import { SharedReportingControls } from "./shared-reporting-controls";
import { OverviewPanel } from "./panels/overview-panel";
import { BranchReportsPanel } from "./panels/branch-reports-panel";
import { FinancialReportsPanel } from "./panels/financial-reports-panel";
import { ServiceReportsPanel } from "./panels/service-reports-panel";
import { StaffReportsPanel } from "./panels/staff-reports-panel";
import { SheetEvidencePanel } from "./panels/sheet-evidence-panel";
import { AlertCircle } from "lucide-react";

export interface OwnerReportsPageProps {
  initialData: OwnerReportsData;
  initialRequest: OwnerReportsRequest;
}

export function OwnerReportsPage({ initialData, initialRequest }: OwnerReportsPageProps) {
  const searchParams = useSearchParams();

  // 1. Initial State from searchParams or initialRequest
  const urlPreset = searchParams.get("preset") || initialRequest.preset || "last7";
  const urlFrom = searchParams.get("from") || initialRequest.from;
  const urlTo = searchParams.get("to") || initialRequest.to;
  const urlBranchId = searchParams.get("branchId") || initialRequest.branchId || "all";
  const urlTab = (searchParams.get("view") as ReportTab) || initialRequest.tab || "overview";

  const [activeTab, setActiveTab] = useState<ReportTab>(urlTab);

  // Sync state if URL changes externally (e.g. browser back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const view = (currentParams.get("view") as ReportTab) || "overview";
      setActiveTab(view);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update tab in URL without triggering Next.js full page route reload
  const handleTabChange = useCallback((tab: ReportTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "overview") {
      params.delete("view");
    } else {
      params.set("view", tab);
    }
    const newQuery = params.toString();
    const newUrl = newQuery ? `/owner/reports?${newQuery}` : "/owner/reports";
    window.history.pushState(null, "", newUrl);
  }, []);

  // 2. Request object for SWR
  const request = useMemo<OwnerReportsRequest>(() => {
    const params = new URLSearchParams(searchParams.toString());
    return {
      preset: params.get("preset") || urlPreset,
      from: params.get("from") || urlFrom || undefined,
      to: params.get("to") || urlTo || undefined,
      branchId: params.get("branchId") || urlBranchId,
    };
  }, [searchParams, urlPreset, urlFrom, urlTo, urlBranchId]);

  // SWR Cache Key
  const key = useMemo(
    () =>
      [
        "owner-reports",
        request.branchId ?? "all",
        request.preset ?? "last7",
        request.from ?? "",
        request.to ?? "",
      ] as const,
    [request.branchId, request.preset, request.from, request.to]
  );

  const initialKey = [
    "owner-reports",
    initialRequest.branchId ?? "all",
    initialRequest.preset ?? "last7",
    initialRequest.from ?? "",
    initialRequest.to ?? "",
  ] as const;

  const isInitialKey = key.every((part, index) => part === initialKey[index]);
  const swrKey = useWorkspaceSWRKey(key);

  const { data, error, isValidating, mutate } = useSWR(
    swrKey,
    async (scopedKey: WorkspaceScopedSWRKey<typeof key>) => {
      const [, branchId, preset, from, to] = unwrapWorkspaceSWRKey(scopedKey);
      const result = await getOwnerReportsDataAction({
        branchId: branchId === "all" ? undefined : branchId,
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
  const sheetKey = useWorkspaceSWRKey([
    "owner-report-sheet",
    report.branchId ?? "all",
    report.from,
    report.to,
  ] as const);
  const { data: sheetEvidence, mutate: refreshSheet } = useSWR(
    sheetKey,
    async (
      scopedKey: WorkspaceScopedSWRKey<readonly ["owner-report-sheet", string, string, string]>
    ) => {
      const [, branchId, from, to] = unwrapWorkspaceSWRKey(scopedKey);
      return getOwnerReportSheetEvidenceAction({ branchId, from, to });
    },
    { revalidateOnFocus: false }
  );
  const reportWithSheet = { ...report, sheetEvidence };

  const refreshReports = useWorkspaceReactivationRefresh(async () => {
    await mutate();
    await refreshSheet();
  });

  // Filter change handlers (pushState into URL history)
  const handleScopeChange = useCallback((newBranchId: string) => {
    const params = new URLSearchParams(window.location.search);
    if (newBranchId === "all") {
      params.delete("branchId");
    } else {
      params.set("branchId", newBranchId);
    }
    window.history.pushState(null, "", `/owner/reports?${params.toString()}`);
  }, []);

  const handlePresetChange = useCallback((newPreset: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("preset", newPreset);
    params.delete("from");
    params.delete("to");
    window.history.pushState(null, "", `/owner/reports?${params.toString()}`);
  }, []);

  const handleCustomRangeChange = useCallback((from: string, to: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("preset", "custom");
    params.set("from", from);
    params.set("to", to);
    window.history.pushState(null, "", `/owner/reports?${params.toString()}`);
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16 pt-2">
      {/* ── Header with Data Sources indicators ───────────────────── */}
      <ReportsHeader />

      {/* ── Report Tab Navigation (Immediate Client-Side Workspace Switch) ── */}
      <ReportsTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Shared Reporting Controls (Scope + Date Range) ────────── */}
      <SharedReportingControls
        branchId={request.branchId ?? "all"}
        branches={report.branches ?? []}
        preset={request.preset ?? "last7"}
        from={report.from}
        to={report.to}
        dateRangeLabel={report.dateRangeLabel}
        isPending={isValidating}
        onScopeChange={handleScopeChange}
        onPresetChange={handlePresetChange}
        onCustomRangeChange={handleCustomRangeChange}
        onRefresh={() => {
          void refreshReports().catch(() => undefined);
        }}
      />

      {/* ── Background Revalidation Status & Non-destructive Error Banner ── */}
      <div className="flex flex-col gap-2">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 shadow-2xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>Report refresh failed. The last successful results are still shown.</span>
          </div>
        )}

        <div aria-live="polite" className="min-h-4 text-right text-[11px] font-mono text-stone-600">
          {isValidating
            ? "Updating report data…"
            : `Updated ${new Date(report.generatedAt).toLocaleTimeString("en-PH", {
                hour: "numeric",
                minute: "2-digit",
              })}`}
        </div>
      </div>

      {/* ── Active Report Panel Content ────────────────────────────── */}
      <main
        role="tabpanel"
        id={`reports-panel-${activeTab}`}
        aria-labelledby={`reports-tab-${activeTab}`}
        className="focus:outline-hidden"
      >
        {activeTab === "overview" && (
          <OverviewPanel data={reportWithSheet} onNavigateToTab={handleTabChange} />
        )}
        {activeTab === "branch" && (
          <BranchReportsPanel data={report} onNavigateToTab={handleTabChange} />
        )}
        {activeTab === "financial" && (
          <FinancialReportsPanel data={reportWithSheet} onNavigateToTab={handleTabChange} />
        )}
        {activeTab === "service" && (
          <ServiceReportsPanel data={report} onNavigateToTab={handleTabChange} />
        )}
        {activeTab === "staff" && (
          <StaffReportsPanel data={report} onNavigateToTab={handleTabChange} />
        )}
        {activeTab === "sheet" && (
          <SheetEvidencePanel data={reportWithSheet} onNavigateToTab={handleTabChange} />
        )}
      </main>
    </div>
  );
}
