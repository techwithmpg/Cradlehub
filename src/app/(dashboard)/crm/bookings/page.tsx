import {
  getCrmBookingsCommandCenterRows,
  getCrmUpcomingBookings,
  getCrmOrderServiceLines,
  getDailyPaymentSummary,
} from "@/lib/queries/bookings";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { CrmBookingsView } from "@/components/features/bookings/crm-bookings-view";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { confirmBookingPaymentAction } from "./actions";
import { getWaitlistAction } from "@/app/(dashboard)/crm/waitlist/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { upcomingBookingEndDate } from "@/lib/bookings/upcoming-bookings";
import { isCrmOperationalBookingStatus } from "@/lib/bookings/crm-booking-status";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

export default async function CrmBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    status?: string;
    type?: string;
    delivery?: string;
    payment?: string;
    assignment?: string;
    page?: string;
    branchId?: string;
    highlight?: string;
    search?: string;
    bookingId?: string;
    tab?: string;
    openRoomAssignment?: string;
  }>;
}) {
  const { branchId, branchName, role } = await getFrontDeskContext();
  const params = await searchParams;
  const today = getBranchBusinessDate();
  const upcoming = params.tab === "upcoming";

  // When navigating from a notification link, resolve the booking's date
  const bookingId = params.bookingId ?? params.highlight;
  let date = params.date ?? today;

  if (bookingId) {
    const admin = createAdminClient();
    const { data: ref, error } = await admin
      .from("bookings")
      .select("booking_date, branch_id, order_id")
      .eq("id", bookingId)
      .eq("branch_id", branchId)
      .maybeSingle();
    if (error) throw new Error("Could not resolve booking date.");
    if (!ref?.booking_date || ref.branch_id !== branchId)
      throw new Error("Booking is unavailable for this branch.");
    date = ref.booking_date;
  }

  const [bookings, cashSummary, waitlistResult] = await Promise.all([
    upcoming
      ? getCrmUpcomingBookings(branchId, today)
      : getCrmBookingsCommandCenterRows(branchId, date),
    getDailyPaymentSummary(branchId, date),
    getWaitlistAction(branchId),
  ]);
  if (upcoming) {
    const orderIds = bookings.flatMap((row) => (row.order_id ? [row.order_id] : []));
    if (orderIds.length > 0) {
      for (const line of await getCrmOrderServiceLines(branchId, orderIds)) {
        if (!bookings.some((loaded) => loaded.id === line.id)) bookings.push(line);
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
    if (!exact) throw new Error("Booking is unavailable for this branch.");
    for (const row of dateRows) {
      if (
        (exact.order_id ? row.order_id === exact.order_id : row.id === exact.id) &&
        !bookings.some((loaded) => loaded.id === row.id)
      )
        bookings.push(row);
    }
    selectedOutsideWindow = true;
  }

  const orderIds = [
    ...new Set(bookings.flatMap((booking) => (booking.order_id ? [booking.order_id] : []))),
  ];
  const orderFinancials = new Map<string, { status: string; paid: number; total: number }>();
  if (orderIds.length > 0) {
    const admin = createAdminClient();
    const [{ data: summaries, error: summaryError }, { data: orders, error: ordersError }] =
      await Promise.all([
        admin
          .from("v_booking_order_financial_summaries")
          .select("order_id, total_payable, net_allocated, payment_state")
          .in("order_id", orderIds),
        admin.from("booking_orders").select("id, metadata").in("id", orderIds),
      ]);
    if (summaryError || ordersError) throw new Error("Could not load order payment status.");
    const quotes = new Map(
      (orders ?? []).map((order) => [
        order.id,
        Number((order.metadata as Record<string, unknown> | null)?.total_amount) || 0,
      ])
    );
    for (const summary of summaries ?? []) {
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
  const displayBookings = bookings.map((booking) => ({
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
  }));

  const initialData = {
    branchId,
    branchName,
    role,
    date,
    businessDate: today,
    selectedOutsideWindow,
    // Cast: getTodaysSchedule returns metadata as unknown; WorkspaceBookingRow
    // expects Record<string,unknown>|null|undefined. The values are compatible.
    bookings: displayBookings as WorkspaceBookingRow[],
    waitlistRows: (waitlistResult.ok ? waitlistResult.data : []) as WaitlistRow[],
    cashSummary,
  };

  return (
    <RetainedWorkspaceModule moduleId="crm-bookings">
      <CrmBookingsView
        initialData={initialData}
        paymentAction={updateBookingPaymentAction}
        confirmPaymentAction={confirmBookingPaymentAction}
      />
    </RetainedWorkspaceModule>
  );
}
