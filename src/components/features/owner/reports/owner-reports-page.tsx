"use client";

import { PageHeader } from "@/components/features/dashboard/page-header";
import { ReportDateFilter } from "./report-date-filter";
import { ReportKpiCards } from "./report-kpi-cards";
import { RevenueByBranchCard } from "./revenue-by-branch-card";
import { StaffProductivityCard } from "./staff-productivity-card";
import { BookingTrendCard } from "./booking-trend-card";
import { ReportsEmptyState } from "./reports-empty-state";
import { 
  RevenueByBranchData, 
  StaffProductivityData, 
  BookingTrendData 
} from "@/lib/owner/reports";

interface OwnerReportsPageProps {
  revenueData: RevenueByBranchData[];
  staffData: StaffProductivityData[];
  trendData: BookingTrendData[];
}

export function OwnerReportsPage({ 
  revenueData, 
  staffData, 
  trendData 
}: OwnerReportsPageProps) {
  const hasData = revenueData.length > 0 || staffData.length > 0 || trendData.length > 0;

  return (
    <div style={{ paddingBottom: "3rem" }}>
      <PageHeader
        title="Reports"
        description="Track revenue, bookings, branch performance, and staff productivity."
        icon="📊"
      />

      <ReportDateFilter />

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
