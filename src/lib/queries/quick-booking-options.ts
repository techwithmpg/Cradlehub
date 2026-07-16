import "server-only";

import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { getBranchServices } from "@/lib/queries/branches";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  QuickBookingCustomerOption,
  QuickBookingResourceOption,
  QuickBookingServiceOption,
  QuickBookingStaffOption,
} from "@/components/features/bookings/quick-booking-form";

type ServiceRelation =
  | {
      id?: string;
      name?: string;
      is_active?: boolean;
      price?: number | string | null;
      duration_minutes?: number | null;
    }
  | Array<{
      id?: string;
      name?: string;
      is_active?: boolean;
      price?: number | string | null;
      duration_minutes?: number | null;
    }>
  | null;

type BranchServiceRow = {
  custom_price?: number | string | null;
  custom_duration_minutes?: number | null;
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
  archived_at: string | null;
  merged_into_staff_id: string | null;
  staff_services: { service_id: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getQuickBookingCustomerPrefill(
  customerId: string | undefined
): Promise<QuickBookingCustomerOption | null> {
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

export async function getQuickBookingOptions(branchId: string): Promise<{
  services: QuickBookingServiceOption[];
  staff: QuickBookingStaffOption[];
  resources: QuickBookingResourceOption[];
}> {
  const admin = createAdminClient();
  const [branchServices, staffResult, resourcesResult] = await Promise.all([
    getBranchServices(branchId, { publicOnly: false }),
    admin
      .from("staff")
      .select("id, full_name, nickname, is_active, staff_type, system_role, archived_at, merged_into_staff_id, staff_services(service_id)")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .is("archived_at", null)
      .is("merged_into_staff_id", null)
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
        durationMinutes: Number(row.custom_duration_minutes ?? service.duration_minutes ?? 0),
        availableInSpa: row.available_in_spa ?? true,
        availableHomeService: row.available_home_service ?? false,
      };
    })
    .filter((service): service is QuickBookingServiceOption => service !== null);

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

export async function getQuickBookingContext(branchId: string) {
  const [options, bookingRules] = await Promise.all([
    getQuickBookingOptions(branchId),
    getBranchBookingRulesOrDefault(branchId),
  ]);

  return {
    ...options,
    bookingRules,
  };
}
