"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CrmPageHeader } from "@/components/features/crm/shared/crm-page-header";
import { Button } from "@/components/ui/button";
import { ServicesToolbar, type ServiceFilter, type ServiceSort } from "./services-toolbar";
import { ServiceCategorySection } from "./service-category-section";
import { ServicesEmptyState } from "./services-empty-state";
import { ServiceEditorModal } from "./service-editor-modal";
import type { OwnerService, OwnerServiceBranch, OwnerServiceCategory } from "./owner-service-types";
import { filterOwnerServices } from "@/lib/services/owner-service-workspace";

type Props = {
  services: OwnerService[];
  branches: OwnerServiceBranch[];
  categories: OwnerServiceCategory[];
  scopedBranchId?: string | null;
  scopedBranchName?: string | null;
};

export function ServicesPageClient({
  services,
  branches,
  categories,
  scopedBranchId = null,
  scopedBranchName = null,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ServiceFilter>("all");
  const [sort, setSort] = useState<ServiceSort>("name");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<OwnerService | "new" | null>(null);

  const filteredServices = useMemo(() => filterOwnerServices(services, {
    search, categoryId: categoryFilter, branchId: branchFilter, status: filter, sort,
  }), [services, search, filter, sort, categoryFilter, branchFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, OwnerService[]>();
    for (const service of filteredServices) {
      const name = service.service_categories?.name ?? "Uncategorized";
      map.set(name, [...(map.get(name) ?? []), service]);
    }
    return Array.from(map.entries());
  }, [filteredServices]);

  const hasFilters = Boolean(search || filter !== "all" || sort !== "name" || categoryFilter || branchFilter);
  function clearFilters() {
    setSearch(""); setFilter("all"); setSort("name");
    setCategoryFilter(null); setBranchFilter(null);
  }
  const activeCount = services.filter((service) => service.is_active).length;

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Service Catalog"
        title="Services"
        description={`${services.length} services across ${categories.length} categories · ${activeCount} active · ${services.length - activeCount} inactive`}
        actions={
          <Button
            size="sm"
            onClick={() => setEditing("new")}
            className="bg-[#1F4E33] text-white hover:bg-[#163B26]"
          >
            <Plus size={15} />
            New Service
          </Button>
        }
      />
      <ServicesToolbar
        search={search} onSearchChange={setSearch}
        filter={filter} onFilterChange={setFilter}
        sort={sort} onSortChange={setSort}
        resultCount={filteredServices.length}
        categories={categories} categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        branches={branches} branchFilter={branchFilter}
        onBranchFilterChange={setBranchFilter}
      />
      {filteredServices.length === 0 ? (
        <ServicesEmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />
      ) : grouped.map(([categoryName, categoryServices]) => (
        <ServiceCategorySection key={categoryName} categoryName={categoryName}
          services={categoryServices} branches={branches} onEdit={setEditing} onToggle={() => router.refresh()} />
      ))}
      <ServiceEditorModal
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        open={editing !== null}
        service={editing === "new" ? null : editing}
        categories={categories}
        branches={branches}
        scopedBranchId={scopedBranchId}
        scopedBranchName={scopedBranchName}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); router.refresh(); }}
      />
    </div>
  );
}
