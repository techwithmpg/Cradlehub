import { NextRequest, NextResponse } from "next/server";
import { getAllBranches, getBranchServices } from "@/lib/queries/branches";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

type BranchRow = Pick<
  Database["public"]["Tables"]["branches"]["Row"],
  "id" | "name" | "slot_interval_minutes"
>;

type ServiceRow = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  "id" | "name" | "description" | "duration_minutes" | "price"
>;

type ServiceRelation = ServiceRow | ServiceRow[] | null;

type BranchServiceRow = Pick<
  Database["public"]["Tables"]["branch_services"]["Row"],
  "id" | "custom_price" | "is_active"
> & {
  services: ServiceRelation;
};

type StaffRow = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "full_name" | "tier" | "is_active" | "staff_type" | "is_head"
>;

type LegacyStaffRow = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "full_name" | "tier" | "is_active"
>;

function firstService(value: ServiceRelation): ServiceRow | null {
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
    m.includes("could not find the 'staff_type' column")
  );
}

async function getPublicStaffByBranch(branchId: string): Promise<StaffRow[]> {
  const supabase = createAdminClient();
  const primary = await supabase
    .from("staff")
    .select("id, full_name, tier, is_active, staff_type, is_head")
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
      .select("id, full_name, tier, is_active")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("tier")
      .order("full_name");

    if (fallback.error) throw new Error(fallback.error.message);

    return ((fallback.data ?? []) as LegacyStaffRow[]).map((member) => ({
      ...member,
      staff_type: "therapist",
      is_head: false,
    })) as StaffRow[];
  }

  throw new Error(primary.error.message);
}

export async function GET(request: NextRequest) {
  const requestedBranchId = request.nextUrl.searchParams.get("branchId");
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
    });
  }

  const selectedBranchId =
    requestedBranchId && branches.some((branch) => branch.id === requestedBranchId)
      ? requestedBranchId
      : branches[0]!.id;

  const [rawBranchServices, rawStaff] = await Promise.all([
    getBranchServices(selectedBranchId),
    getPublicStaffByBranch(selectedBranchId),
  ]);

  const branchServices = (rawBranchServices as BranchServiceRow[])
    .filter((record) => record.is_active)
    .map((record) => {
      const service = firstService(record.services);
      if (!service) return null;

      return {
        branchServiceId: record.id,
        serviceId: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.duration_minutes,
        price: Number(record.custom_price ?? service.price),
      };
    })
    .filter((service): service is NonNullable<typeof service> => service !== null);

  const staff = (rawStaff as StaffRow[])
    .filter((member) => member.is_active)
    .map((member) => ({
      id: member.id,
      name: member.full_name,
      tier: member.tier,
      staffType: member.staff_type,
      isHead: member.is_head,
    }));

  return NextResponse.json({
    branches,
    selectedBranchId,
    services: branchServices,
    staff,
  });
}
