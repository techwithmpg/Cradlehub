import "server-only";

import {
  getCrmBookingsCommandCenterRows,
  getCrmUpcomingBookings,
  getCrmOrderServiceLines,
  getDailyPaymentSummary,
} from "@/lib/queries/bookings";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { upcomingBookingEndDate } from "@/lib/bookings/upcoming-bookings";
import { isCrmOperationalBookingStatus } from "@/lib/bookings/crm-booking-status";
import { getWaitlistAction } from "@/app/(dashboard)/crm/waitlist/actions";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import type { DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type CrmBookingsOperationalData = {
  branchId: string;
  branchName: string;
  role: string;
  date: string;
  businessDate: string;
  selectedOutsideWindow: boolean;
  bookings: WorkspaceBookingRow[];
  waitlistRows: WaitlistRow[];
  cashSummary: DailyCashSummaryData | null;
};

export type CrmBookingsOperationalInput = {
  branchId: string;
  branchName: string;
  role: string;
  date?: string;
  upcoming?: boolean;
  bookingId?: string;
  client?: SupabaseClient<Database>;
};

export async function getCrmBookingsOperationalData({
  branchId,
  branchName,
  role,
  date: requestedDate,
  upcoming = false,
  bookingId,
  client,
}: CrmBookingsOperationalInput): Promise<CrmBookingsOperationalData> {
  const today = getBranchBusinessDate();
  let date = requestedDate ?? today;

  const supabase = client ?? createAdminClient();
  if (bookingId) {
    const { data: ref, error } = await supabase
      .from("bookings")
      .select("booking_date, branch_id, order_id")
      .eq("id", bookingId)
      .eq("branch_id", branchId)
      .maybeSingle();

    if (error) throw new Error("Could not resolve booking date.");
    if (!ref?.booking_date || (ref.branch_id != null && ref.branch_id !== branchId)) {
      throw new Error("Booking is unavailable for this branch.");
    }
    date = ref.booking_date;
  }

  const [rawBookings, cashSummary, waitlistResult] = await Promise.all([
    upcoming
      ? getCrmUpcomingBookings(branchId, today)
      : getCrmBookingsCommandCenterRows(branchId, date),
    getDailyPaymentSummary(branchId, date),
    getWaitlistAction(branchId),
  ]);

  const bookings = [...rawBookings];

  if (upcoming) {
    const orderIds = bookings.flatMap((row) => (row.order_id ? [row.order_id] : []));
    if (orderIds.length > 0) {
      const lines = client
        ? await getCrmOrderServiceLines(branchId, orderIds, client)
        : await getCrmOrderServiceLines(branchId, orderIds);
      for (const line of lines) {
        if (!bookings.some((loaded) => loaded.id === line.id)) {
          bookings.push(line);
        }
      }
    }
  }

  let selectedOutsideWindow = false;
  if (upcoming && bookingId && date > upcomingBookingEndDate(today)) {
    const dateRows = await getCrmBookingsCommandCenterRows(branchId, date);
    const exact = dateRows.find(
      (row) =>
        row.id === bookingId &&
        isCrmOperationalBookingStatus(row.status) &&
        !["completed", "no_show"].includes(String(row.booking_progress_status ?? ""))
    );
    if (!exact) {
      throw new Error("Booking is unavailable for this branch.");
    }
    for (const row of dateRows) {
      if (
        (exact.order_id ? row.order_id === exact.order_id : row.id === exact.id) &&
        !bookings.some((loaded) => loaded.id === row.id)
      ) {
        bookings.push(row);
      }
    }
    selectedOutsideWindow = true;
  }

  const orderIds = [
    ...new Set(bookings.flatMap((booking) => (booking.order_id ? [booking.order_id] : []))),
  ];
  const orderFinancials = new Map<string, { status: string; paid: number; total: number }>();

  if (orderIds.length > 0) {
    const admin = (client ?? createAdminClient()) as ReturnType<typeof createAdminClient>;
    const [{ data: summaries, error: summaryError }, { data: orders, error: ordersError }] =
      await Promise.all([
        admin
          .from("v_booking_order_financial_summaries")
          .select("order_id, total_payable, net_allocated, payment_state")
          .in("order_id", orderIds),
        admin.from("booking_orders").select("id, metadata").in("id", orderIds),
      ]);

    if (summaryError || ordersError) {
      throw new Error("Could not load order payment status.");
    }

    const rawOrders = (orders ?? []) as Array<{ id: string; metadata: unknown }>;
    const quotes = new Map<string, number>(
      rawOrders.map((order) => [
        order.id,
        Number((order.metadata as Record<string, unknown> | null)?.total_amount) || 0,
      ])
    );

    const rawSummaries = (summaries ?? []) as Array<{
      order_id: string | null;
      total_payable: number | null;
      net_allocated: number | null;
      payment_state: string | null;
    }>;

    for (const summary of rawSummaries) {
      if (!summary.order_id) continue;
      const payable = Number(summary.total_payable) || 0;
      const total = payable > 0 ? payable : (quotes.get(summary.order_id) ?? 0);
      orderFinancials.set(summary.order_id, {
        status: payable > 0 || total === 0 ? (summary.payment_state ?? "unpaid") : "unpaid",
        paid: Number(summary.net_allocated) || 0,
        total,
      });
    }
  }

  const displayBookings: WorkspaceBookingRow[] = bookings.map((booking) => ({
    ...booking,
    order_payment_status: booking.order_id
      ? (orderFinancials.get(booking.order_id)?.status ?? null)
      : null,
    order_amount_paid: booking.order_id
      ? (orderFinancials.get(booking.order_id)?.paid ?? null)
      : null,
    order_total_amount: booking.order_id
      ? (orderFinancials.get(booking.order_id)?.total ?? null)
      : null,
  })) as WorkspaceBookingRow[];

  return {
    branchId,
    branchName,
    role,
    date,
    businessDate: today,
    selectedOutsideWindow,
    bookings: displayBookings,
    waitlistRows: (waitlistResult.ok ? waitlistResult.data : []) as WaitlistRow[],
    cashSummary,
  };
}
