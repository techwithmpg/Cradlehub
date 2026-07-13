import { NextRequest, NextResponse } from "next/server";
import { getAllBranches, getBranchServices, getBranchServicesForPublicBooking } from "@/lib/queries/branches";
import { getBranchBookingRulesOrDefaultCached } from "@/lib/queries/branch-booking-rules";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { isOperationalStaff } from "@/lib/staff/operational-staff";
import { resolveServiceImage } from "@/lib/service-images";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import type { Database } from "@/types/supabase";

// Force this route to always run dynamically — prevents any edge/CDN caching
// that would serve stale service data after a CRM home-service toggle.
export const dynamic = "force-dynamic";

type BranchRow = Pick<
  Database["public"]["Tables"]["branches"]["Row"],
  "id" | "name" | "slot_interval_minutes"
>;

type ServiceRow = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  | "id"
  | "name"
  | "description"
  | "is_active"
  | "duration_minutes"
  | "price"
> & {
  image_url?: string | null;
  image_alt?: string | null;
  service_categories?: CategoryRelation;
};

type CategoryRow = Pick<
  Database["public"]["Tables"]["service_categories"]["Row"],
  "id" | "name" | "display_order"
>;

type CategoryRelation = CategoryRow | CategoryRow[] | null;

type ServiceRelation = ServiceRow | ServiceRow[] | null;

type BranchServiceRow = Pick<
  Database["public"]["Tables"]["branch_services"]["Row"],
  "id" | "custom_price" | "is_active" | "available_in_spa" | "available_home_service"
> & {
  custom_duration_minutes?: number | null;
  custom_image_url?: string | null;
  services: ServiceRelation;
};

type StaffWithServicesRow = {
  id: string;
  full_name: string;
  tier: string;
  is_active: boolean;
  staff_type: string | null;
  system_role: string | null;
  is_head: boolean | null;
  nickname: string | null;
  avatar_url: string | null;
  archived_at: string | null;
  merged_into_staff_id: string | null;
  metadata: Record<string, unknown> | null;
  staff_services: { service_id: string }[] | null;
};

function firstService(value: ServiceRelation): ServiceRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function firstCategory(value: CategoryRelation | undefined): CategoryRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function getPublicStaffByBranch(branchId: string): Promise<StaffWithServicesRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, tier, is_active, staff_type, system_role, is_head, nickname, avatar_url, archived_at, merged_into_staff_id, metadata, staff_services(service_id)")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("tier")
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StaffWithServicesRow[];
}

async function canUseInhouseContext(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return canAccessCrmWorkspace(me?.system_role ?? "");
}

export async function GET(request: NextRequest) {
  const requestedBranchId = request.nextUrl.searchParams.get("branchId");
  const mode = request.nextUrl.searchParams.get("mode"); // "public" | "inhouse" | null

  // Auth check and branch list are independent — resolve them in parallel.
  const [publicOnly, rawBranches] = await Promise.all([
    mode === "inhouse" ? canUseInhouseContext().then((ok) => !ok) : Promise.resolve(true),
    getAllBranches() as Promise<BranchRow[]>,
  ]);

  const branches = rawBranches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    slotIntervalMinutes: branch.slot_interval_minutes,
  }));

  if (branches.length === 0) {
    return NextResponse.json({
      branches: [],
      selectedBranchId: null,
      services: [],
      staff: [],
      bookingRules: null,
    });
  }

  const selectedBranchId =
    requestedBranchId && branches.some((branch) => branch.id === requestedBranchId)
      ? requestedBranchId
      : branches[0]!.id;

  const [rawBranchServices, rawStaff, bookingRules] = await Promise.all([
    publicOnly
      // Use uncached direct-DB query so CRM changes (home-service toggle,
      // visibility) are immediately visible in the public booking wizard
      // without waiting for cache expiry.
      ? getBranchServicesForPublicBooking(selectedBranchId)
      : getBranchServices(selectedBranchId, { publicOnly: false }),
    getPublicStaffByBranch(selectedBranchId),
    getBranchBookingRulesOrDefaultCached(selectedBranchId),
  ]);

  const branchServices = (rawBranchServices as BranchServiceRow[])
    .filter((record) => record.is_active)
    .map((record) => {
      const service = firstService(record.services);
      if (!service?.is_active) return null;
      const category = firstCategory(service.service_categories);
      const serviceImage = resolveServiceImage({
        id: service.id,
        name: service.name,
        imageUrl: record.custom_image_url ?? service.image_url,
        imageAlt: service.image_alt,
      });

      return {
        branchServiceId: record.id,
        serviceId: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: record.custom_duration_minutes ?? service.duration_minutes,
        price: Number(record.custom_price ?? service.price),
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? "Wellness",
        categorySortOrder: category?.display_order ?? 999,
        availableInSpa: record.available_in_spa ?? true,
        availableHomeService: record.available_home_service ?? false,
        imageUrl: serviceImage.imageUrl,
        imageAlt: serviceImage.imageAlt,
      };
    })
    .filter((service): service is NonNullable<typeof service> => service !== null)
    .sort((a, b) => {
      const categoryDelta = a.categorySortOrder - b.categorySortOrder;
      return categoryDelta !== 0 ? categoryDelta : a.name.localeCompare(b.name);
    });

  const serviceIds = branchServices.map((service) => service.serviceId);

  // Build per-staff service maps from the embedded staff_services join — no extra round-trip.
  const serviceIdsByStaff = new Map<string, string[]>(
    rawStaff.map((member) => [
      member.id,
      (member.staff_services ?? []).map((ss) => ss.service_id),
    ])
  );
  const serviceIdsWithStaffMappings = new Set(
    rawStaff.flatMap((member) =>
      (member.staff_services ?? []).map((ss) => ss.service_id)
    )
  );

  const staff = rawStaff
    .filter(
      (member) =>
        isOperationalStaff(member) &&
        canActAsBookingServiceProvider(
          member,
          (serviceIdsByStaff.get(member.id)?.length ?? 0) > 0
        )
    )
    .map((member) => ({
      id: member.id,
      name: member.full_name,
      nickname: member.nickname,
      tier: member.tier,
      staffType: member.staff_type,
      isHead: member.is_head,
      serviceIds: serviceIdsByStaff.get(member.id) ?? [],
      avatarUrl: member.avatar_url,
    }));

  return NextResponse.json(
    {
      branches,
      selectedBranchId,
      services: branchServices,
      staff,
      serviceEligibility: serviceIds.map((serviceId) => ({
        serviceId,
        hasStaffMappings: serviceIdsWithStaffMappings.has(serviceId),
      })),
      bookingRules,
    },
    {
      headers: {
        // Prevent browser and CDN from caching service availability data.
        // CRM changes (home-service toggle, visibility) must be immediately
        // visible to customers in the public booking wizard.
        "Cache-Control": "no-store, must-revalidate",
      },
    }
  );
}
