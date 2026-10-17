import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { CrmBookingsView } from "@/components/features/bookings/crm-bookings-view";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { confirmBookingPaymentAction } from "./actions";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { getCrmBookingsOperationalData } from "@/lib/queries/crm-bookings-operational";

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
  const upcoming = params.tab === "upcoming";
  const bookingId = params.bookingId ?? params.highlight;

  const initialData = await getCrmBookingsOperationalData({
    branchId,
    branchName,
    role,
    date: params.date,
    upcoming,
    bookingId,
  });

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
