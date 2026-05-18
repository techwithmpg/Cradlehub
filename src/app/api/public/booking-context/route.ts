import { NextRequest, NextResponse } from "next/server";
import { getAllBranches, getBranchServices, getBranchServicesPublicCached } from "@/lib/queries/branches";
import { getBranchBookingRulesOrDefaultCached } from "@/lib/queries/branch-booking-rules";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

const INHOUSE_CONTEXT_ROLES = new Set([
  "owner",
  "manager",
  "crm",
  "csr",
  "csr_head",
  "csr_staff",
]);

type BranchRow = Pick<
  Database["public"]["Tables"]["branches"]["Row"],
  "id" | "name" | "slot_interval_minutes"
>;

type ServiceRow = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  "id" | "name" | "description" | "duration_minutes" | "price"
> & {
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
  services: ServiceRelation;
};

type StaffRow = {
  id: string;
  full_name: string;
  tier: string;
  is_active: boolean;
  staff_type: string | null;
  system_role: string | null;
  is_head: boolean | null;
  nickname: string | null;
  avatar_url: string | null;
};

type LegacyStaffRow = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "full_name" | "tier" | "is_active" | "system_role"
>;

type StaffServiceRow = Pick<
  Database["public"]["Tables"]["staff_services"]["Row"],
  "staff_id" | "service_id"
>;

function firstService(value: ServiceRelation): ServiceRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function firstCategory(value: CategoryRelation | undefined): CategoryRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isMissingStaffOrgColumnsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('column staff.staff_type does not exist') ||
    m.includes('column "staff_type" does not exist') ||
    m.includes('column staff.is_head does not exist') ||
    m.includes('column "is_head" does not exist') ||
    m.includes("could not find the 'is_head' column") ||
    m.includes("could not find the 'staff_type' column") ||
    m.includes('column staff.nickname does not exist') ||
    m.includes('column "nickname" does not exist') ||
    m.includes("could not find the 'nickname' column") ||
    m.includes('column staff.avatar_url does not exist') ||
    m.includes('column "avatar_url" does not exist') ||
    m.includes("could not find the 'avatar_url' column")
  );
}

async function getPublicStaffByBranch(branchId: string): Promise<StaffRow[]> {
  const supabase = createAdminClient();
  const primary = await supabase
    .from("staff")
    .select("id, full_name, tier, is_active, staff_type, system_role, is_head, nickname, avatar_url")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("tier")
    .order("full_name");

  if (!primary.error) {
    return (primary.data ?? []) as StaffRow[];
  }

  if (isMissingStaffOrgColumnsError(primary.error.message)) {
    const fallback = await supabase
      .from("staff")
      .select("id, full_name, tier, is_active, system_role")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("tier")
      .order("full_name");

    if (fallback.error) throw new Error(fallback.error.message);

    return ((fallback.data ?? []) as LegacyStaffRow[]).map((member) => ({
      ...member,
      staff_type: null,
      is_head: false,
      nickname: null,
      avatar_url: null,
    })) as StaffRow[];
  }

  throw new Error(primary.error.message);
}

async function getStaffServiceRows(
  staffIds: string[],
  serviceIds: string[]
): Promise<StaffServiceRow[]> {
  if (staffIds.length === 0 || serviceIds.length === 0) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id, service_id")
    .in("staff_id", staffIds)
    .in("service_id", serviceIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as StaffServiceRow[];
}

function groupServiceIdsByStaff(rows: StaffServiceRow[]): Map<string, string[]> {
  const serviceIdsByStaff = new Map<string, string[]>();

  for (const row of rows) {
    const current = serviceIdsByStaff.get(row.staff_id) ?? [];
    current.push(row.service_id);
    serviceIdsByStaff.set(row.staff_id, current);
  }

  return serviceIdsByStaff;
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

  return !!me?.system_role && INHOUSE_CONTEXT_ROLES.has(me.system_role);
}

export async function GET(request: NextRequest) {
  const requestedBranchId = request.nextUrl.searchParams.get("branchId");
  const mode = request.nextUrl.searchParams.get("mode"); // "public" | "inhouse" | null
  const publicOnly = mode === "inhouse" ? !(await canUseInhouseContext()) : true;
  const rawBranches = (await getAllBranches()) as BranchRow[];

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
    // Use the cached public variant when publicOnly=true (all public booking requests).
    // Fall back to uncached for inhouse context (staff-facing, may include non-public services).
    publicOnly
      ? getBranchServicesPublicCached(selectedBranchId)
      : getBranchServices(selectedBranchId, { publicOnly: false }),
    getPublicStaffByBranch(selectedBranchId),
    getBranchBookingRulesOrDefaultCached(selectedBranchId),
  ]);

  const branchServices = (rawBranchServices as BranchServiceRow[])
    .filter((record) => record.is_active)
    .map((record) => {
      const service = firstService(record.services);
      if (!service) return null;
      const category = firstCategory(service.service_categories);

      return {
        branchServiceId: record.id,
        serviceId: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.duration_minutes,
        price: Number(record.custom_price ?? service.price),
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? "Wellness",
        categorySortOrder: category?.display_order ?? 999,
        availableInSpa: record.available_in_spa ?? true,
        availableHomeService: record.available_home_service ?? false,
      };
    })
    .filter((service): service is NonNullable<typeof service> => service !== null)
    .sort((a, b) => {
      const categoryDelta = a.categorySortOrder - b.categorySortOrder;
      return categoryDelta !== 0 ? categoryDelta : a.name.localeCompare(b.name);
    });

  const serviceIds = branchServices.map((service) => service.serviceId);
  const staffServiceRows = await getStaffServiceRows(
    (rawStaff as StaffRow[]).map((member) => member.id),
    serviceIds
  );
  const serviceIdsByStaff = groupServiceIdsByStaff(staffServiceRows);
  const serviceIdsWithStaffMappings = new Set(
    staffServiceRows.map((row) => row.service_id)
  );

  const staff = (rawStaff as StaffRow[])
    .filter((member) =>
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

  return NextResponse.json({
    branches,
    selectedBranchId,
    services: branchServices,
    staff,
    serviceEligibility: serviceIds.map((serviceId) => ({
      serviceId,
      hasStaffMappings: serviceIdsWithStaffMappings.has(serviceId),
    })),
    bookingRules,
  });
}
