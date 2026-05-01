"use client";

import { useState, useMemo } from "react";
import { ServicesToolbar, type ServiceFilter, type ServiceSort } from "./services-toolbar";
import { ServiceCategorySection } from "./service-category-section";
import { ServicesEmptyState } from "./services-empty-state";

type ServiceCategory = {
  id: string;
  name: string | null;
  display_order: number | null;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  service_categories: ServiceCategory | null;
};

type Props = {
  services: Service[];
};

export function ServicesPageClient({ services }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ServiceFilter>("all");
  const [sort, setSort] = useState<ServiceSort>("name");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((s) => {
      const cat = s.service_categories;
      if (cat && cat.id && cat.name) {
        map.set(cat.id, cat.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  const filteredServices = useMemo(() => {
    let result = services.filter((s) => !deletedIds.has(s.id));

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.service_categories?.name ?? "").toLowerCase().includes(q)
      );
    }

    if (categoryFilter) {
      result = result.filter((s) => s.service_categories?.id === categoryFilter);
    }

    switch (filter) {
      case "active":
        result = result.filter((s) => s.is_active);
        break;
      case "inactive":
        result = result.filter((s) => !s.is_active);
        break;
    }

    result.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "price_asc":
          return Number(a.price) - Number(b.price);
        case "price_desc":
          return Number(b.price) - Number(a.price);
        case "duration":
          return a.duration_minutes - b.duration_minutes;
        default:
          return 0;
      }
    });

    return result;
  }, [services, search, filter, sort, categoryFilter, deletedIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    filteredServices.forEach((s) => {
      const catName = s.service_categories?.name ?? "Uncategorized";
      const existing = map.get(catName) ?? [];
      existing.push(s);
      map.set(catName, existing);
    });
    return Array.from(map.entries());
  }, [filteredServices]);

  const hasFilters = search !== "" || filter !== "all" || categoryFilter !== null || sort !== "name";

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setSort("name");
    setCategoryFilter(null);
  }

  function handleDeleted(serviceId: string) {
    setDeletedIds((prev) => new Set(prev).add(serviceId));
  }

  if (filteredServices.length === 0) {
    return (
      <div>
        <ServicesToolbar
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          sort={sort}
          onSortChange={setSort}
          resultCount={0}
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
        <ServicesEmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />
      </div>
    );
  }

  return (
    <div>
      <ServicesToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        resultCount={filteredServices.length}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {grouped.map(([categoryName, categoryServices]) => (
        <ServiceCategorySection
          key={categoryName}
          categoryName={categoryName}
          services={categoryServices}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}
