import { NextRequest, NextResponse } from "next/server";
import { getAllBranches, getBranchServices } from "@/lib/queries/branches";
import { getStaffByBranch } from "@/lib/queries/staff";
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

function firstService(value: ServiceRelation): ServiceRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
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
    getStaffByBranch(selectedBranchId),
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
