import type { OwnerService, OwnerServiceBranch } from "@/components/features/services/owner-service-types";

export type OwnerServiceWorkspaceFilters = {
  search: string;
  categoryId: string | null;
  branchId: string | null;
  status: "all" | "active" | "inactive";
  sort: "name" | "price_asc" | "price_desc" | "duration";
};

export function filterOwnerServices(services: OwnerService[], filters: OwnerServiceWorkspaceFilters) {
  let result = services;
  const query = filters.search.trim().toLowerCase();
  if (query) result = result.filter((service) =>
    service.name.toLowerCase().includes(query) ||
    (service.description ?? "").toLowerCase().includes(query) ||
    (service.service_categories?.name ?? "").toLowerCase().includes(query)
  );
  if (filters.categoryId) result = result.filter((service) => service.category_id === filters.categoryId);
  if (filters.branchId) result = result.filter((service) => service.offeredBranchIds.includes(filters.branchId!));
  if (filters.status === "active") result = result.filter((service) => service.is_active);
  if (filters.status === "inactive") result = result.filter((service) => !service.is_active);
  return [...result].sort((a, b) => {
    switch (filters.sort) {
      case "price_asc": return Number(a.price) - Number(b.price);
      case "price_desc": return Number(b.price) - Number(a.price);
      case "duration": return a.duration_minutes - b.duration_minutes;
      default: return a.name.localeCompare(b.name);
    }
  });
}

export function serviceBranchSummary(service: OwnerService, branches: OwnerServiceBranch[]) {
  if (branches.length > 0 && service.offeredBranchIds.length === branches.length) return "All branches";
  return branches.filter((branch) => service.offeredBranchIds.includes(branch.id))
    .map((branch) => branch.name).join(" · ") || "No active branch offering";
}

export function extensionPricePreview(input: {
  baseDuration: number;
  basePrice: number;
  increment: number;
  extensionPrice: number;
  maximumDuration: number;
}, limit = 12) {
  const { baseDuration, basePrice, increment, extensionPrice, maximumDuration } = input;
  if (![baseDuration, basePrice, increment, extensionPrice, maximumDuration].every(Number.isFinite)
    || extensionPrice <= 0 || increment <= 0 || maximumDuration <= baseDuration
    || (maximumDuration - baseDuration) % increment !== 0) return [];
  const count = Math.min(limit, (maximumDuration - baseDuration) / increment + 1);
  return Array.from({ length: count }, (_, index) => ({
    duration: baseDuration + index * increment,
    price: basePrice + index * extensionPrice,
  }));
}
