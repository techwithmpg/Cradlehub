import { describe, it, expect } from "vitest";
import { 
  calculateTotalRevenue, 
  calculateTotalBookings, 
  getTopBranch, 
  getTopStaff,
  calculateRevenueShare,
  RevenueByBranchData,
  StaffProductivityData
} from "../../../src/lib/owner/reports";

describe("Owner Reports Helpers", () => {
  const mockRevenueData: RevenueByBranchData[] = [
    { name: "Branch A", revenue: 1000, count: 10 },
    { name: "Branch B", revenue: 2000, count: 20 },
    { name: "Branch C", revenue: 500, count: 5 },
  ];

  const mockStaffData: StaffProductivityData[] = [
    { staffId: "1", name: "Staff A", tier: "senior", total: 10, completed: 8, revenue: 1000 },
    { staffId: "2", name: "Staff B", tier: "junior", total: 15, completed: 12, revenue: 1500 },
    { staffId: "3", name: "Staff C", tier: "mid", total: 5, completed: 3, revenue: 500 },
  ];

  it("calculates total revenue correctly", () => {
    expect(calculateTotalRevenue(mockRevenueData)).toBe(3500);
    expect(calculateTotalRevenue([])).toBe(0);
  });

  it("calculates total bookings correctly", () => {
    expect(calculateTotalBookings(mockRevenueData)).toBe(35);
    expect(calculateTotalBookings([])).toBe(0);
  });

  it("identifies the top branch correctly", () => {
    expect(getTopBranch(mockRevenueData)).toBe("Branch B");
    expect(getTopBranch([])).toBe("No data yet");
  });

  it("identifies the top staff correctly", () => {
    expect(getTopStaff(mockStaffData)).toBe("Staff B");
    expect(getTopStaff([])).toBe("No data yet");
  });

  it("calculates revenue share correctly", () => {
    const shareData = calculateRevenueShare(mockRevenueData);
    expect(shareData[0]?.share).toBe(29); // 1000/3500 * 100 = 28.57 -> 29
    expect(shareData[1]?.share).toBe(57); // 2000/3500 * 100 = 57.14 -> 57
    expect(shareData[2]?.share).toBe(14); // 500/3500 * 100 = 14.28 -> 14
    
    // Check total share is roughly 100
    expect(shareData.reduce((sum: number, item) => sum + item.share, 0)).toBe(100);
  });

  it("handles zero revenue when calculating share", () => {
    const zeroData: RevenueByBranchData[] = [
      { name: "Branch A", revenue: 0, count: 0 },
    ];
    const shareData = calculateRevenueShare(zeroData);
    expect(shareData[0]?.share).toBe(0);
  });
});
