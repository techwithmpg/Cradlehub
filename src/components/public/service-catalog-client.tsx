"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock,
  Flower2,
  Home,
  LayoutGrid,
  List,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { PublicBranch } from "@/lib/public/public-site-data";
import { ServiceImage } from "@/components/public/service-image";
import { ServiceDetailDialog } from "@/components/public/service-detail-dialog";

type ServiceCatalogClientProps = {
  services: PublicCatalogService[];
  branches?: PublicBranch[];
  initialCategory?: string;
  initialQuery?: string;
};

type DurationBucketId = "under_30" | "45_60" | "61_90" | "over_90";
type SortOption = "recommended" | "price_asc" | "price_desc" | "duration_asc";

const CATEGORY_TABS = [
  { id: "all", label: "All Services" },
  { id: "Massage Services", label: "Massage" },
  { id: "Skin Care Services", label: "Facials" },
  { id: "Salon Services", label: "Salon & Nail" },
  { id: "Divine Renewal Packages", label: "Packages" },
  { id: "Spa Party Packages", label: "Spa Parties" },
  { id: "home_only", label: "Home Service" },
];

const DURATION_BUCKETS: {
  id: DurationBucketId;
  label: string;
  matches: (mins: number) => boolean;
}[] = [
  { id: "under_30", label: "30 min or less", matches: (m) => m > 0 && m <= 30 },
  { id: "45_60", label: "45 – 60 min", matches: (m) => m > 30 && m <= 60 },
  { id: "61_90", label: "61 – 90 min", matches: (m) => m > 60 && m <= 90 },
  { id: "over_90", label: "91 – 120+ min", matches: (m) => m > 90 },
];

function formatPhp(amount: number) {
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}

export function ServiceCatalogClient({
  services,
  branches = [],
  initialCategory = "all",
  initialQuery = "",
}: ServiceCatalogClientProps) {
  const safeServices = useMemo(
    () =>
      services.filter(
        (s) => s.isPublicBookable && !s.isCsrOnly && !s.isVip,
      ),
    [services],
  );

  const catalogMaxPrice = useMemo(() => {
    const prices = safeServices.map((s) => s.price).filter((p) => p > 0);
    return prices.length > 0 ? Math.max(...prices, 3000) : 5000;
  }, [safeServices]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory || "all",
  );
  const [checkedTypes, setCheckedTypes] = useState<string[]>([]);
  const [checkedDurations, setCheckedDurations] = useState<DurationBucketId[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(catalogMaxPrice);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [visitModeFilter, setVisitModeFilter] = useState<
    "all" | "in_spa" | "home_service"
  >(initialCategory === "home_only" ? "home_service" : "all");
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailService, setDetailService] = useState<PublicCatalogService | null>(
    null,
  );
  const [quickBookBranchId, setQuickBookBranchId] = useState<string>(
    branches[0]?.id || "",
  );

  const buildBookingHref = (service?: PublicCatalogService) => {
    const params = new URLSearchParams();
    if (service) params.set("serviceId", service.id);
    if (selectedBranchId !== "all") params.set("branchId", selectedBranchId);
    if (visitModeFilter !== "all") params.set("visitType", visitModeFilter);
    const qs = params.toString();
    return qs ? `/book?${qs}` : "/book";
  };

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of safeServices) {
      map.set(s.categoryName, (map.get(s.categoryName) ?? 0) + 1);
    }
    return map;
  }, [safeServices]);

  const durationCounts = useMemo(() => {
    const counts: Record<DurationBucketId, number> = {
      under_30: 0,
      "45_60": 0,
      "61_90": 0,
      over_90: 0,
    };
    for (const s of safeServices) {
      for (const b of DURATION_BUCKETS) {
        if (b.matches(s.durationMinutes)) counts[b.id] += 1;
      }
    }
    return counts;
  }, [safeServices]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = safeServices.filter((s) => {
      if (selectedCategory === "home_only") {
        if (!s.availableHomeService) return false;
      } else if (selectedCategory !== "all" && s.categoryName !== selectedCategory) {
        return false;
      }

      if (checkedTypes.length > 0 && !checkedTypes.includes(s.categoryName)) {
        return false;
      }

      if (visitModeFilter === "in_spa" && !s.availableInSpa) return false;
      if (visitModeFilter === "home_service" && !s.availableHomeService) return false;

      if (checkedDurations.length > 0) {
        const matchesAny = checkedDurations.some((id) => {
          const bucket = DURATION_BUCKETS.find((b) => b.id === id);
          return bucket ? bucket.matches(s.durationMinutes) : true;
        });
        if (!matchesAny) return false;
      }

      if (s.price > maxPrice) return false;

      if (q) {
        const haystack = `${s.name} ${s.categoryName} ${s.subcategory || ""} ${s.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...list];
    if (sortBy === "price_asc") sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === "duration_asc")
      sorted.sort((a, b) => a.durationMinutes - b.durationMinutes);
    return sorted;
  }, [
    safeServices,
    selectedCategory,
    checkedTypes,
    visitModeFilter,
    checkedDurations,
    maxPrice,
    searchQuery,
    sortBy,
  ]);

  const featuredService = useMemo(() => {
    if (filteredServices.length === 0) return null;
    return (
      filteredServices.find((s) => s.categoryName === "Massage Services") ||
      filteredServices[0]
    );
  }, [filteredServices]);

  const gridServices = useMemo(() => {
    if (!featuredService) return filteredServices;
    if (filteredServices.length <= 4) return filteredServices;
    return filteredServices.filter((s) => s.id !== featuredService.id);
  }, [filteredServices, featuredService]);

  const clearAllFilters = () => {
    setSelectedCategory("all");
    setCheckedTypes([]);
    setCheckedDurations([]);
    setMaxPrice(catalogMaxPrice);
    setSelectedBranchId("all");
    setVisitModeFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-8">
      {/* Top Category Pill Tabs */}
      <div
        role="tablist"
        aria-label="Service categories"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {CATEGORY_TABS.map((tab) => {
          const active = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSelectedCategory(tab.id);
                if (tab.id === "home_only") setVisitModeFilter("home_service");
                else if (visitModeFilter === "home_service") setVisitModeFilter("all");
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#163A2B] ${
                active
                  ? "border-[#163A2B] bg-[#163A2B] text-[#FAF5E9] shadow-xs"
                  : "border-[#DDD4C2] bg-white text-[#2A3830] hover:border-[#C8A96B]"
              }`}
            >
              {tab.id === "home_only" ? (
                <Home className="h-3.5 w-3.5 text-[#C8A96B]" aria-hidden="true" />
              ) : (
                <Flower2 className="h-3.5 w-3.5 text-[#C8A96B]" aria-hidden="true" />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Split: Filter Sidebar + Catalog */}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-12">
        {/* Left Filter Sidebar */}
        <aside className="rounded-2xl border border-[#E5DEC9] bg-white p-5 shadow-xs lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#EFEAE0] pb-3">
            <h2 className="text-sm font-semibold text-[#10261D]">
              Filter Services
            </h2>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-medium text-[#8A6D3B] hover:text-[#163A2B] hover:underline"
            >
              Clear All
            </button>
          </div>

          <div className="mt-4 space-y-5">
            {/* Branch */}
            <div>
              <label
                htmlFor="catalog-branch-select"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#10261D]"
              >
                <MapPin className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
                <span>Branch</span>
              </label>
              <select
                id="catalog-branch-select"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#DDD4C2] bg-[#FCFAF5] px-3 py-2 text-xs text-[#10261D]"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Type Checkboxes */}
            <div className="border-t border-[#EFEAE0] pt-4">
              <p className="text-xs font-semibold text-[#10261D]">Service Type</p>
              <div className="mt-2.5 space-y-2">
                {Array.from(categoryCounts.entries()).map(([cat, count]) => {
                  const checked = checkedTypes.includes(cat);
                  return (
                    <label
                      key={cat}
                      className="flex cursor-pointer items-center justify-between gap-2 text-xs text-[#3E4C44]"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCheckedTypes((prev) =>
                              prev.includes(cat)
                                ? prev.filter((item) => item !== cat)
                                : [...prev, cat],
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-[#C8BFA9] accent-[#163A2B]"
                        />
                        <span>{cat.replace(" Services", "")}</span>
                      </span>
                      <span className="text-[11px] text-[#7A847D]">({count})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Duration Buckets */}
            <div className="border-t border-[#EFEAE0] pt-4">
              <p className="text-xs font-semibold text-[#10261D]">Duration</p>
              <div className="mt-2.5 space-y-2">
                {DURATION_BUCKETS.map((bucket) => {
                  const checked = checkedDurations.includes(bucket.id);
                  return (
                    <label
                      key={bucket.id}
                      className="flex cursor-pointer items-center justify-between gap-2 text-xs text-[#3E4C44]"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCheckedDurations((prev) =>
                              prev.includes(bucket.id)
                                ? prev.filter((id) => id !== bucket.id)
                                : [...prev, bucket.id],
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-[#C8BFA9] accent-[#163A2B]"
                        />
                        <span>{bucket.label}</span>
                      </span>
                      <span className="text-[11px] text-[#7A847D]">
                        ({durationCounts[bucket.id]})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Price Range */}
            <div className="border-t border-[#EFEAE0] pt-4">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="catalog-price-slider"
                  className="text-xs font-semibold text-[#10261D]"
                >
                  Max Price
                </label>
                <span className="text-xs font-bold text-[#163A2B]">
                  {formatPhp(maxPrice)}
                </span>
              </div>
              <input
                id="catalog-price-slider"
                type="range"
                min={200}
                max={catalogMaxPrice}
                step={50}
                value={maxPrice}
                aria-valuetext={`Up to ${formatPhp(maxPrice)}`}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="mt-2.5 w-full accent-[#B68A3C]"
              />
              <div className="mt-1 flex justify-between text-[10px] text-[#7A847D]">
                <span>₱200</span>
                <span>{formatPhp(catalogMaxPrice)}+</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Content Column */}
        <div className="space-y-6 lg:col-span-9">
          {/* Featured Service Card */}
          {featuredService && (
            <div className="overflow-hidden rounded-3xl border border-[#E2D9C8] bg-white shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="relative min-h-[220px] bg-[#EDE4D3] md:col-span-5">
                  <ServiceImage
                    src={featuredService.imageUrl}
                    alt={featuredService.imageAlt || featuredService.name}
                    category={featuredService.categoryName}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-cover"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-[#163A2B]/90 px-3 py-1 text-[10px] font-semibold tracking-wider text-[#E8D5A3] uppercase">
                    Featured Service
                  </span>
                </div>
                <div className="flex flex-col justify-between p-6 md:col-span-7">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{featuredService.categoryName}</span>
                    </p>
                    <h2 className="mt-1.5 font-serif text-2xl font-medium text-[#10261D] [font-family:var(--sp-font-display)] lg:text-3xl">
                      {featuredService.name}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#4C5A52]">
                      {featuredService.description}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#F0EAE0] pt-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-[#4C5A52]">
                        <Clock className="h-4 w-4 text-[#B68A3C]" aria-hidden="true" />
                        <span>{featuredService.durationText}</span>
                      </span>
                      <span className="text-lg font-bold text-[#10261D]">
                        {featuredService.priceLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setDetailService(featuredService)}
                        className="rounded-full border border-[#D7CEBC] bg-[#FCFAF5] px-4 py-2 text-xs font-semibold text-[#10261D] transition hover:border-[#163A2B]"
                      >
                        View Details
                      </button>
                      <Link
                        href={buildBookingHref(featuredService)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#163A2B] px-5 py-2 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                      >
                        <span>Book Now</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar: Count + Search + Sort + Grid/List */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5DEC9] bg-white px-4 py-3">
            <p className="font-serif text-lg font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              All Services{" "}
              <span className="text-sm font-sans text-[#6B766F]">
                ({filteredServices.length})
              </span>
            </p>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#7A847D]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services..."
                  aria-label="Search services"
                  className="w-full rounded-xl border border-[#DDD4C2] bg-[#FCFAF5] py-2 pr-8 pl-8 text-xs text-[#10261D] placeholder:text-[#7A847D]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear service search"
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-[#7A847D] hover:text-[#10261D]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort services"
                className="rounded-xl border border-[#DDD4C2] bg-[#FCFAF5] px-3 py-2 text-xs text-[#10261D]"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="duration_asc">Duration: Shortest</option>
              </select>

              <div className="flex rounded-xl border border-[#DDD4C2] bg-[#FCFAF5] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  aria-pressed={viewMode === "grid"}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    viewMode === "grid"
                      ? "bg-[#163A2B] text-[#FAF5E9]"
                      : "text-[#58665E]"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    viewMode === "list"
                      ? "bg-[#163A2B] text-[#FAF5E9]"
                      : "text-[#58665E]"
                  }`}
                >
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Empty State or Services Cards */}
          {gridServices.length === 0 ? (
            <div className="rounded-2xl border border-[#E5DEC9] bg-white p-10 text-center">
              <p className="font-serif text-xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
                No matching services found
              </p>
              <p className="mt-1.5 text-sm text-[#58665E]">
                Try broadening your duration, price range, or category filter.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 rounded-full bg-[#163A2B] px-5 py-2 text-xs font-semibold text-[#FAF5E9]"
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {gridServices.map((service) => (
                <article
                  key={service.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-xs transition hover:border-[#C8A96B] hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] w-full bg-[#EDE4D3]">
                    <ServiceImage
                      src={service.imageUrl}
                      alt={service.imageAlt || service.name}
                      category={service.categoryName}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover"
                    />
                    {service.availableHomeService && (
                      <span className="absolute top-2.5 right-2.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-[#163A2B] shadow-xs">
                        Home Service Ready
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[10px] font-semibold tracking-wider text-[#8A6D3B] uppercase">
                      {service.categoryName}
                    </p>
                    <h3 className="mt-1 font-serif text-base font-semibold text-[#10261D] [font-family:var(--sp-font-display)]">
                      {service.name}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#55635B]">
                      {service.description}
                    </p>
                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between border-t border-[#F0EAE0] pt-3 text-xs">
                        <span className="inline-flex items-center gap-1 text-[#55635B]">
                          <Clock className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
                          <span>{service.durationText}</span>
                        </span>
                        <span className="text-sm font-bold text-[#10261D]">
                          {service.priceLabel}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Link
                          href={buildBookingHref(service)}
                          className="inline-flex items-center justify-center gap-1 rounded-full bg-[#163A2B] px-3 py-2 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                        >
                          <span>Book Now</span>
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDetailService(service)}
                          className="rounded-full border border-[#DDD4C2] bg-[#FCFAF5] px-3 py-2 text-xs font-semibold text-[#10261D] transition hover:border-[#163A2B]"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {gridServices.map((service) => (
                <article
                  key={service.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#E5DEC9] bg-white p-4 shadow-xs sm:flex-row sm:items-center"
                >
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-[#EDE4D3] sm:h-24 sm:w-32">
                    <ServiceImage
                      src={service.imageUrl}
                      alt={service.imageAlt || service.name}
                      category={service.categoryName}
                      fill
                      sizes="(max-width: 640px) 100vw, 128px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold tracking-wider text-[#8A6D3B] uppercase">
                      {service.categoryName}
                    </p>
                    <h3 className="font-serif text-base font-semibold text-[#10261D] [font-family:var(--sp-font-display)]">
                      {service.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-[#55635B]">
                      {service.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-bold text-[#10261D]">
                        {service.priceLabel}
                      </p>
                      <p className="text-[11px] text-[#58665E]">
                        {service.durationText}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailService(service)}
                        className="rounded-full border border-[#DDD4C2] px-3.5 py-1.5 text-xs font-semibold text-[#10261D]"
                      >
                        Details
                      </button>
                      <Link
                        href={buildBookingHref(service)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#163A2B] px-4 py-1.5 text-xs font-semibold text-[#FAF5E9]"
                      >
                        <span>Book</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Choose Experience + Quick Book Bottom CTA */}
      <div className="rounded-3xl border border-[#E2D9C8] bg-white p-6 shadow-xs lg:p-8">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
              Ready to Relax?
            </p>
            <h2 className="mt-1 font-serif text-2xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              Book Your Service Today
            </h2>
            <p className="mt-1 text-sm text-[#55635B]">
              Choose your preferred Bacolod branch and schedule your appointment in
              minutes.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            {branches.length > 0 && (
              <select
                value={quickBookBranchId}
                onChange={(e) => setQuickBookBranchId(e.target.value)}
                aria-label="Select Bacolod branch to book"
                className="rounded-full border border-[#DDD4C2] bg-[#FCFAF5] px-4 py-2.5 text-xs font-medium text-[#10261D]"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <Link
              href={
                quickBookBranchId
                  ? `/book?branchId=${encodeURIComponent(quickBookBranchId)}`
                  : "/book"
              }
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#163A2B] px-6 py-2.5 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
            >
              <Calendar className="h-4 w-4 text-[#D4B57A]" aria-hidden="true" />
              <span>Book an Appointment</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <ServiceDetailDialog
        service={detailService}
        bookingHref={detailService ? buildBookingHref(detailService) : "/book"}
        onClose={() => setDetailService(null)}
      />
    </div>
  );
}
