import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { Database } from "@/types/supabase";

export type CrmStaffServiceRow =
  Database["public"]["Tables"]["services"]["Row"] & {
    service_categories: { id: string; name: string } | null;
  };

type NestedService = NonNullable<ServiceLite["services"]>;
type RuntimeNestedService = NestedService | NestedService[];

export function getCrmStaffNestedService(
  branchService: ServiceLite
): NestedService | null {
  const relation = branchService.services as RuntimeNestedService | null | undefined;
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

export function getCrmStaffServiceId(branchService: ServiceLite): string | null {
  const nestedService = getCrmStaffNestedService(branchService);
  return branchService.service_id || nestedService?.id || null;
}

export function getCrmStaffServiceName(
  branchService: ServiceLite
): string | null {
  const nestedService = getCrmStaffNestedService(branchService);
  return branchService.public_title?.trim() || nestedService?.name || null;
}

export function toCrmStaffServiceRows(
  activeServices: ServiceLite[]
): CrmStaffServiceRow[] {
  const rows: CrmStaffServiceRow[] = [];
  const seenServiceIds = new Set<string>();

  for (const branchService of activeServices) {
    const nestedService = getCrmStaffNestedService(branchService);
    const serviceId = getCrmStaffServiceId(branchService);

    if (!nestedService || !serviceId || seenServiceIds.has(serviceId)) {
      continue;
    }

    seenServiceIds.add(serviceId);

    const catRel = nestedService.service_categories;
    const category =
      catRel === null || catRel === undefined
        ? null
        : Array.isArray(catRel)
          ? catRel[0]
            ? { id: catRel[0].id, name: catRel[0].name }
            : null
          : { id: catRel.id, name: catRel.name };

    rows.push({
      id: serviceId,
      name: branchService.public_title?.trim() || nestedService.name,
      description:
        (branchService.public_description?.trim() ||
          nestedService.description) ??
        null,
      is_active: branchService.is_active,
      duration_minutes:
        branchService.custom_duration_minutes ?? nestedService.duration_minutes,
      price: branchService.custom_price ?? nestedService.price,
      service_categories: category,
    } as unknown as CrmStaffServiceRow);
  }

  return rows;
}
