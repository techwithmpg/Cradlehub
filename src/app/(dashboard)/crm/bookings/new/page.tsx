import { QuickBookingForm, type QuickBookingCustomerOption, type QuickBookingMode } from "@/components/features/bookings/quick-booking-form";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchServices } from "@/lib/queries/branches";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";

type SearchParams = {
  customerId?: string;
  mode?: string;
  type?: string;
  name?: string;
  phone?: string;
};

type ServiceRelation = {
  id?: string;
  name?: string;
  is_active?: boolean;
  price?: number | string | null;
  duration_minutes?: number | null;
} | Array<{
  id?: string;
  name?: string;
  is_active?: boolean;
  price?: number | string | null;
  duration_minutes?: number | null;
}> | null;

type BranchServiceRow = {
  custom_price?: number | string | null;
  available_in_spa?: boolean;
  available_home_service?: boolean;
  services?: ServiceRelation;
};

type StaffRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  is_active: boolean | null;
  staff_type: string | null;
  system_role: string | null;
  staff_services: { service_id: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeQuickBookingMode(params: SearchParams): QuickBookingMode {
  const raw = params.mode ?? params.type ?? "walkin";
  if (raw === "phone") return "phone";
  if (raw === "future" || raw === "standard_future") return "standard_future";
  if (raw === "home_service") return "home_service";
  return "walkin";
}

async function getCustomerPrefill(customerId: string | undefined): Promise<QuickBookingCustomerOption | null> {
  if (!customerId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id, full_name, phone, email")
    .eq("id", customerId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    email: data.email,
  };
}

async function getQuickBookingOptions(branchId: string) {
  const admin = createAdminClient();
  const [branchServices, staffResult, resourcesResult] = await Promise.all([
    getBranchServices(branchId, { publicOnly: false }),
    admin
      .from("staff")
      .select("id, full_name, nickname, is_active, staff_type, system_role, staff_services(service_id)")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    admin
      .from("branch_resources")
      .select("id, name, type, capacity")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const services = (branchServices as BranchServiceRow[])
    .map((row) => {
      const service = firstRelation(row.services);
      if (!service?.id || !service.name || service.is_active === false) return null;
      return {
        id: service.id,
        name: service.name,
        price: Number(row.custom_price ?? service.price ?? 0),
        durationMinutes: Number(service.duration_minutes ?? 0),
        availableInSpa: row.available_in_spa ?? true,
        availableHomeService: row.available_home_service ?? false,
      };
    })
    .filter((service): service is NonNullable<typeof service> => service !== null);

  const staff = ((staffResult.data ?? []) as unknown as StaffRow[])
    .filter((member) =>
      canActAsBookingServiceProvider(member, (member.staff_services ?? []).length > 0)
    )
    .map((member) => ({
      id: member.id,
      name: member.full_name,
      nickname: member.nickname,
      serviceIds: (member.staff_services ?? []).map((row) => row.service_id),
    }));

  const resources = (resourcesResult.data ?? []).map((resource) => ({
    id: resource.id,
    name: resource.name,
    type: resource.type,
    capacity: resource.capacity,
  }));

  return { services, staff, resources };
}

export default async function CrmBookingWizardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { branchId, branchName } = await getFrontDeskContext();
  const [customerPrefill, options, bookingRules] = await Promise.all([
    getCustomerPrefill(params.customerId),
    getQuickBookingOptions(branchId),
    getBranchBookingRulesOrDefault(branchId),
  ]);

  return (
    <QuickBookingForm
      branchId={branchId}
      branchName={branchName}
      bookingRules={bookingRules}
      initialMode={normalizeQuickBookingMode(params)}
      initialCustomer={customerPrefill}
      initialName={params.name ?? ""}
      initialPhone={params.phone ?? ""}
      services={options.services}
      staff={options.staff}
      resources={options.resources}
    />
  );
}
