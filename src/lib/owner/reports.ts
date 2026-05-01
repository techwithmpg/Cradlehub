/**
 * Helper utilities for Owner Reports & Analytics
 */

export interface RevenueByBranchData {
  name: string;
  revenue: number;
  count: number;
}

export interface StaffProductivityData {
  staffId: string;
  name: string;
  tier: string;
  total: number;
  completed: number;
  revenue: number;
}

export interface BookingTrendData {
  date: string;
  count: number;
}

/**
 * Calculate total revenue from branch data
 */
export function calculateTotalRevenue(data: RevenueByBranchData[]): number {
  return data.reduce((sum, item) => sum + item.revenue, 0);
}

/**
 * Calculate total completed bookings from branch data
 */
export function calculateTotalBookings(data: RevenueByBranchData[]): number {
  return data.reduce((sum, item) => sum + item.count, 0);
}

/**
 * Find the top performing branch by revenue
 */
export function getTopBranch(data: RevenueByBranchData[]): string {
  if (data.length === 0) return "No data yet";
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
  return sorted[0]?.name ?? "No data yet";
}

/**
 * Find the top performing staff member by completed bookings
 */
export function getTopStaff(data: StaffProductivityData[]): string {
  if (data.length === 0) return "No data yet";
  const sorted = [...data].sort((a, b) => b.completed - a.completed);
  return sorted[0]?.name ?? "No data yet";
}

/**
 * Calculate percentage share of revenue for each branch
 */
export function calculateRevenueShare(data: RevenueByBranchData[]): (RevenueByBranchData & { share: number })[] {
  const total = calculateTotalRevenue(data);
  if (total === 0) return data.map(item => ({ ...item, share: 0 }));
  
  return data.map(item => ({
    ...item,
    share: Math.round((item.revenue / total) * 100)
  }));
}

/**
 * Get the date range for presets
 */
export function getDateRangeFromPreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0]!;
  let from = to;

  switch (preset) {
    case "today":
      from = to;
      break;
    case "last7": {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      from = d.toISOString().split("T")[0]!;
      break;
    }
    case "last30": {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      from = d.toISOString().split("T")[0]!;
      break;
    }
    case "thisMonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      from = d.toISOString().split("T")[0]!;
      break;
    }
    default:
      from = to;
  }

  return { from, to };
}
