import { Suspense } from "react";
import { OwnerReportsPage } from "@/components/features/owner/reports/owner-reports-page";
import { DailyCashSummary, type DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";
import {
  getRevenueByBranchAction,
  getStaffProductivityAction,
  getBookingTrendAction,
  getCashSummaryAction,
} from "../bookings/actions";
import { getDateRangeFromPreset } from "@/lib/owner/reports";
import ReportsLoading from "./loading";

interface ReportsPageProps {
  searchParams: Promise<{
    preset?: string;
    from?:   string;
    to?:     string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const preset = params.preset || "last7";

  const { from, to } = params.from && params.to
    ? { from: params.from, to: params.to }
    : getDateRangeFromPreset(preset);

  let trendDays = 7;
  if (preset === "last30") trendDays = 30;
  if (preset === "thisMonth") trendDays = new Date().getDate();
  if (preset === "today") trendDays = 0;

  const [revenueRes, staffRes, trendRes, cashRes] = await Promise.all([
    getRevenueByBranchAction(from, to),
    getStaffProductivityAction(from, to),
    getBookingTrendAction(trendDays),
    getCashSummaryAction(from, to),
  ]);

  if ("error" in revenueRes || "error" in staffRes || "error" in trendRes) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: "0.5rem" }}>
          Unable to load reports
        </h2>
        <p style={{ color: "var(--cs-text-muted)", marginBottom: "1.5rem" }}>
          There was an issue fetching the analytics data.
        </p>
        <a href="/owner/reports" style={{ color: "var(--cs-sand)", fontWeight: 600, textDecoration: "underline" }}>
          Try again
        </a>
      </div>
    );
  }

  const dateRangeLabel = from === to
    ? new Date(from + "T00:00:00").toLocaleDateString("en-PH", {
        weekday: "long", month: "long", day: "numeric",
      })
    : `${new Date(from + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${new Date(to + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;

  const cashSummary = !("error" in cashRes) ? (cashRes as DailyCashSummaryData) : null;

  return (
    <Suspense fallback={<ReportsLoading />}>
      {/* Cash summary pinned above analytics charts for operational visibility */}
      {cashSummary && (
        <DailyCashSummary data={cashSummary} label={dateRangeLabel} />
      )}
      <OwnerReportsPage
        revenueData={revenueRes}
        staffData={staffRes}
        trendData={trendRes}
      />
    </Suspense>
  );
}
