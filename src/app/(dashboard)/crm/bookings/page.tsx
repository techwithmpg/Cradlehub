import {
  getCrmBookingsCommandCenterRows,
  getCrmUpcomingBookings,
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
      .select("booking_date, branch_id")
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
  let selectedOutsideWindow = false;
  if (upcoming && bookingId && date > upcomingBookingEndDate(today)) {
    const exact = (await getCrmBookingsCommandCenterRows(branchId, date)).find(
      (row) =>
        row.id === bookingId &&
        isCrmOperationalBookingStatus(row.status) &&
        !["completed", "no_show"].includes(String(row.booking_progress_status ?? ""))
    );
    if (!exact) throw new Error("Booking is unavailable for this branch.");
    if (!bookings.some((row) => row.id === bookingId)) bookings.push(exact);
    selectedOutsideWindow = true;
  }

  const initialData = {
    branchId,
    branchName,
    role,
    date,
    businessDate: today,
    selectedOutsideWindow,
    // Cast: getTodaysSchedule returns metadata as unknown; WorkspaceBookingRow
    // expects Record<string,unknown>|null|undefined. The values are compatible.
    bookings: bookings as WorkspaceBookingRow[],
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
