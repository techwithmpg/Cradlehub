import { createClient } from "@/lib/supabase/server";
import { getDailyPaymentSummary, getManagerDashboardStats } from "./bookings";
import { getCrmAvailabilitySnapshot, type CrmAvailabilitySummary } from "./crm-availability";
import { getDispatchData, type DispatchStats } from "./dispatch-queries";

// ── Re-exports so callers only need one import ─────────────────────────────────

export type { CrmAvailabilitySummary } from "./crm-availability";
export type { DispatchStats } from "./dispatch-queries";

// ── Canonical types ────────────────────────────────────────────────────────────

export type CrmTodayPayment = Awaited<ReturnType<typeof getDailyPaymentSummary>>;

export type CrmTodayBookingSummary = {
  total: number;
  pending: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
  /** Confirmed bookings with no staff_id assigned */
  unassigned: number;
};

export type CrmTodaySnapshot = {
  date: string;
  branchId: string;
  bookingSummary: CrmTodayBookingSummary;
  staffReadiness: CrmAvailabilitySummary;
  dispatchStats: DispatchStats;
  payment: CrmTodayPayment | null;
};

// ── Defaults (used when sub-queries fail gracefully) ──────────────────────────

const DEFAULT_STAFF_READINESS: CrmAvailabilitySummary = {
  total: 0,
  scheduledToday: 0,
  checkedIn: 0,
  notCheckedIn: 0,
  availableNow: 0,
  busyNow: 0,
  checkedOut: 0,
  offToday: 0,
  noSchedule: 0,
  driversReady: 0,
  driversTotal: 0,
  needsAttention: 0,
  serviceStaffNoSchedule: 0,
  pendingOnlineBookings: 0,
};

const DEFAULT_DISPATCH_STATS: DispatchStats = {
  totalToday: 0,
  awaitingDispatch: 0,
  activeTrips: 0,
  completedToday: 0,
  cancelledToday: 0,
};

// ── Main aggregator ────────────────────────────────────────────────────────────

export async function getCrmTodaySnapshot(params: {
  branchId: string;
  date: string;
}): Promise<CrmTodaySnapshot> {
  const { branchId, date } = params;
  const supabase = await createClient();

  const [dashStats, availSnapshot, dispatchData, payment, unassignedRes] = await Promise.all([
    getManagerDashboardStats(branchId, date),
    getCrmAvailabilitySnapshot({ branchId, date }).catch(() => null),
    getDispatchData({ branchId, date }).catch(() => null),
    getDailyPaymentSummary(branchId, date).catch(() => null),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("booking_date", date)
      .eq("status", "confirmed")
      .is("staff_id", null),
  ]);

  return {
    date,
    branchId,
    bookingSummary: {
      ...dashStats,
      unassigned: unassignedRes.count ?? 0,
    },
    staffReadiness: availSnapshot?.summary ?? DEFAULT_STAFF_READINESS,
    dispatchStats: dispatchData?.stats ?? DEFAULT_DISPATCH_STATS,
    payment: payment ?? null,
  };
}
