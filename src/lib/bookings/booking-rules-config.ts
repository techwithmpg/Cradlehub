export const DEFAULT_BRANCH_BOOKING_RULES = {
  inSpaStartTime: "10:00",
  inSpaEndTime: "22:30",
  homeServiceEnabled: true,
  homeServiceStartTime: "14:30",
  homeServiceEndTime: "22:00",
  travelBufferMins: 30,
  maxAdvanceBookingDays: 30,
  homeServiceDriverCapacity: 1,
  homeServiceFreeKm: 5,
  homeServiceExtraKmFee: 100,
} as const;

export type BranchBookingRules = {
  id?: string;
  branchId: string;
  inSpaStartTime: string;
  inSpaEndTime: string;
  homeServiceEnabled: boolean;
  homeServiceStartTime: string;
  homeServiceEndTime: string;
  travelBufferMins: number;
  maxAdvanceBookingDays: number;
  homeServiceDriverCapacity: number;
  homeServiceFreeKm: number;
  homeServiceExtraKmFee: number;
  createdAt?: string;
  updatedAt?: string;
};
