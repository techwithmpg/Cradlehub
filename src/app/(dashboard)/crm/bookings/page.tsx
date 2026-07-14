import { getCrmBookingsCommandCenterRows, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { CrmBookingsView } from "@/components/features/bookings/crm-bookings-view";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { confirmBookingPaymentAction } from "./actions";
import { getWaitlistAction } from "@/app/(dashboard)/crm/waitlist/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

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
  const today  = getBranchBusinessDate();

  // When navigating from a notification link, resolve the booking's date
  const bookingId = params.bookingId ?? params.highlight;
  let date = params.date ?? today;

  if (bookingId && !params.date) {
    const admin = createAdminClient();
    const { data: ref } = await admin
      .from("bookings")
      .select("booking_date, branch_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (ref?.booking_date && ref.branch_id === branchId) date = ref.booking_date;
  }

  const [bookings, cashSummary, waitlistResult] = await Promise.all([
    getCrmBookingsCommandCenterRows(branchId, date),
    getDailyPaymentSummary(branchId, date),
    getWaitlistAction(branchId),
  ]);

  const initialData = {
    branchId,
    branchName,
    role,
    date,
    // Cast: getTodaysSchedule returns metadata as unknown; WorkspaceBookingRow
    // expects Record<string,unknown>|null|undefined. The values are compatible.
    bookings: bookings as WorkspaceBookingRow[],
    waitlistRows: (waitlistResult.ok ? waitlistResult.data : []) as WaitlistRow[],
    cashSummary,
  };

  return (
    <CrmBookingsView
      initialData={initialData}
      paymentAction={updateBookingPaymentAction}
      confirmPaymentAction={confirmBookingPaymentAction}
    />
  );
}
