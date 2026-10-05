/**
 * Helper utilities for Owner Reports & Analytics
 */

export * from "./reports-types";

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
export function calculateRevenueShare(
  data: RevenueByBranchData[]
): (RevenueByBranchData & { share: number })[] {
  const total = calculateTotalRevenue(data);
  if (total === 0) return data.map((item) => ({ ...item, share: 0 }));

  return data.map((item) => ({
    ...item,
    share: Math.round((item.revenue / total) * 100),
  }));
}

/**
 * Get the date range for presets
 */
export function getDateRangeFromPreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  let from = to;

  switch (preset) {
    case "today":
      from = to;
      break;
    case "last7": {
      const d = new Date(`${to}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - 6);
      from = d.toISOString().split("T")[0]!;
      break;
    }
    case "last30": {
      const d = new Date(`${to}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - 29);
      from = d.toISOString().split("T")[0]!;
      break;
    }
    case "thisMonth": {
      from = `${to.slice(0, 7)}-01`;
      break;
    }
    default:
      from = to;
  }

  return { from, to };
}

/**
 * Format currency amount in Philippine Pesos (₱)
 */
export function formatPeso(amount: number): string {
  if (!Number.isFinite(amount)) return "₱0.00";
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format integer currency amount in Philippine Pesos without decimals (for charts and compact cards)
 */
export function formatPesoCompact(amount: number): string {
  if (!Number.isFinite(amount)) return "₱0";
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}

/**
 * Format human-readable date range label
 */
export function formatReportDateRange(from: string, to: string): string {
  if (!from || !to) return "";
  if (from === to) {
    const d = new Date(`${from}T00:00:00`);
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const start = new Date(`${from}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(`${to}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} – ${end}`;
}
