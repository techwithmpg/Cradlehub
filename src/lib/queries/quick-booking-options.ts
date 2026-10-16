import "server-only";

import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { getBranchServiceCatalog } from "@/lib/services/service-catalog";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateServiceLineQuote } from "@/lib/services/service-line-quote";
import { quoteVersionFor } from "@/lib/services/resolve-service-line-quote";
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
      duration_policy?: string | null;
      extension_increment_minutes?: number | null;
      extension_price?: number | null;
      maximum_duration_minutes?: number | null;
    }
  | Array<{
      id?: string;
      name?: string;
      is_active?: boolean;
      price?: number | string | null;
      duration_minutes?: number | null;
      duration_policy?: string | null;
      extension_increment_minutes?: number | null;
      extension_price?: number | null;
      maximum_duration_minutes?: number | null;
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
  const { data, error } = await admin
    .from("customers")
    .select("id, full_name, phone, email")
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new Error("Customer identity could not be loaded.");
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
    getBranchServiceCatalog(branchId, { audience: "crm" }),
    admin
      .from("staff")
      .select(
        "id, full_name, nickname, is_active, staff_type, system_role, archived_at, merged_into_staff_id, staff_services(service_id)"
      )
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
    .map((row): QuickBookingServiceOption | null => {
      const service = firstRelation(row.services);
      if (!service?.id || !service.name || service.is_active === false) return null;
      let quoteVersion: string | undefined;
      if (service.duration_policy === "fixed" || service.duration_policy === "extendable") {
        try {
          const quote = calculateServiceLineQuote({
            service: { id: service.id, duration_policy: service.duration_policy,
              duration_minutes: Number(service.duration_minutes), price: service.price ?? 0,
              extension_increment_minutes: service.extension_increment_minutes ?? null,
              extension_price: service.extension_price ?? null,
              maximum_duration_minutes: service.maximum_duration_minutes ?? null },
            branch: { custom_duration_minutes: row.custom_duration_minutes ?? null,
              custom_price: row.custom_price ?? null },
          });
          quoteVersion = quoteVersionFor(branchId, quote);
        } catch { /* The quote endpoint will report the configuration error. */ }
      }
      return {
        id: service.id,
        name: service.name,
        price: Number(row.custom_price ?? service.price ?? 0),
        durationMinutes: Number(row.custom_duration_minutes ?? service.duration_minutes ?? 0),
        durationPolicy: service.duration_policy === "extendable" ? "extendable" as const : "fixed" as const,
        quoteVersion,
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
