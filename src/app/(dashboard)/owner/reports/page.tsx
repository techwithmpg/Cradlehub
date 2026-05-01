import { Suspense } from "react";
import { OwnerReportsPage } from "@/components/features/owner/reports/owner-reports-page";
import { 
  getRevenueByBranchAction, 
  getStaffProductivityAction, 
  getBookingTrendAction 
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
  
  // Resolve dates
  const { from, to } = params.from && params.to 
    ? { from: params.from, to: params.to } 
    : getDateRangeFromPreset(preset);

  // Map preset to days for trend action
  let trendDays = 7;
  if (preset === "last30") trendDays = 30;
  if (preset === "thisMonth") {
    const today = new Date();
    trendDays = today.getDate();
  }
  if (preset === "today") trendDays = 0;

  // Fetch data
  const [revenueRes, staffRes, trendRes] = await Promise.all([
    getRevenueByBranchAction(from, to),
    getStaffProductivityAction(from, to),
    getBookingTrendAction(trendDays),
  ]);

  // Handle unauthorized or error (actions return objects with error key)
  if ("error" in revenueRes || "error" in staffRes || "error" in trendRes) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: "0.5rem" }}>
          Unable to load reports
        </h2>
        <p style={{ color: "var(--cs-text-muted)", marginBottom: "1.5rem" }}>
          There was an issue fetching the analytics data. This could be due to permission issues or a temporary server problem.
        </p>
        <a 
          href="/owner/reports" 
          style={{ 
            color: "var(--cs-sand)", 
            fontWeight: 600, 
            textDecoration: "underline" 
          }}
        >
          Try again
        </a>
      </div>
    );
  }

  return (
    <Suspense fallback={<ReportsLoading />}>
      <OwnerReportsPage 
        revenueData={revenueRes} 
        staffData={staffRes} 
        trendData={trendRes} 
      />
    </Suspense>
  );
}
