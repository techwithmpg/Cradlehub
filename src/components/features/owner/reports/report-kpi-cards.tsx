"use client";

import { StatCard } from "@/components/features/dashboard/stat-card";
import { formatCurrency } from "@/lib/utils";
import { 
  RevenueByBranchData, 
  StaffProductivityData,
  calculateTotalRevenue,
  calculateTotalBookings,
  getTopBranch,
  getTopStaff
} from "@/lib/owner/reports";

interface ReportKpiCardsProps {
  revenueData: RevenueByBranchData[];
  staffData: StaffProductivityData[];
}

export function ReportKpiCards({ revenueData, staffData }: ReportKpiCardsProps) {
  const totalRevenue = calculateTotalRevenue(revenueData);
  const totalBookings = calculateTotalBookings(revenueData);
  const topBranch = getTopBranch(revenueData);
  const topStaff = getTopStaff(staffData);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "1rem",
        marginBottom: "2rem",
      }}
    >
      <StatCard
        label="Total Revenue"
        value={formatCurrency(totalRevenue)}
        sub="For selected period"
        accent
        accentColor="var(--cs-owner-accent)"
      />
      <StatCard
        label="Total Bookings"
        value={totalBookings}
        sub="Completed sessions"
        accentColor="var(--cs-owner-accent)"
      />
      <StatCard
        label="Top Branch"
        value={topBranch}
        sub="By revenue share"
        accentColor="var(--cs-owner-accent)"
      />
      <StatCard
        label="Top Staff"
        value={topStaff}
        sub="By session volume"
        accentColor="var(--cs-owner-accent)"
      />
    </div>
  );
}
