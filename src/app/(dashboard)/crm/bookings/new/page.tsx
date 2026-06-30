import { QuickBookingForm, type QuickBookingCustomerOption, type QuickBookingMode } from "@/components/features/bookings/quick-booking-form";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import {
  getQuickBookingContext,
  getQuickBookingCustomerPrefill,
} from "@/lib/queries/quick-booking-options";

type SearchParams = {
  customerId?: string;
  serviceId?: string;
  staffId?: string;
  date?: string;
  time?: string;
  mode?: string;
  type?: string;
  name?: string;
  phone?: string;
};

function normalizeQuickBookingMode(params: SearchParams): QuickBookingMode {
  const raw = params.mode ?? params.type ?? "walkin";
  if (raw === "phone") return "phone";
  if (raw === "future" || raw === "standard_future") return "standard_future";
  if (raw === "home_service") return "home_service";
  return "walkin";
}

async function getCustomerPrefill(customerId: string | undefined): Promise<QuickBookingCustomerOption | null> {
  return getQuickBookingCustomerPrefill(customerId);
}

export default async function CrmBookingWizardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { branchId, branchName } = await getFrontDeskContext();
  const [customerPrefill, bookingContext] = await Promise.all([
    getCustomerPrefill(params.customerId),
    getQuickBookingContext(branchId),
  ]);

  return (
    <QuickBookingForm
      branchId={branchId}
      branchName={branchName}
      bookingRules={bookingContext.bookingRules}
      initialMode={normalizeQuickBookingMode(params)}
      initialCustomer={customerPrefill}
      initialName={params.name ?? ""}
      initialPhone={params.phone ?? ""}
      initialServiceId={params.serviceId}
      initialStaffId={params.staffId}
      initialDate={params.date}
      initialTime={params.time}
      services={bookingContext.services}
      staff={bookingContext.staff}
      resources={bookingContext.resources}
    />
  );
}
