import { ServicesPageClient } from "@/components/features/services/services-page-client";
import { getAllCategories, getAllServicesForOwner } from "@/lib/queries/services";
import { getAllBranches } from "@/lib/queries/branches";
import { createClient } from "@/lib/supabase/server";
import type { OwnerService } from "@/components/features/services/owner-service-types";

export default async function ServicesPage() {
  const [categories, services, branches] = await Promise.all([
    getAllCategories(),
    getAllServicesForOwner(),
    getAllBranches(),
  ]);
  const supabase = await createClient();
  const { data: offerings, error } = services.length > 0
    ? await supabase.from("branch_services")
      .select("service_id, branch_id, is_active")
      .in("service_id", services.map((service) => service.id))
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const activeBranchIds = new Set(branches.map((branch) => branch.id));
  const offeredByService = new Map<string, string[]>();
  for (const row of offerings ?? []) {
    if (!row.is_active || !activeBranchIds.has(row.branch_id)) continue;
    const offered = offeredByService.get(row.service_id) ?? [];
    offered.push(row.branch_id);
    offeredByService.set(row.service_id, offered);
  }
  const ownerServices = services.map((service) => ({
    ...service,
    offeredBranchIds: offeredByService.get(service.id) ?? [],
  })) as OwnerService[];
  return <ServicesPageClient
    services={ownerServices}
    categories={categories.map(({ id, name }) => ({ id, name }))}
    branches={branches.map(({ id, name }) => ({ id, name }))}
  />;
}
