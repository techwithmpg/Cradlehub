"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Check, Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { SPA_IMAGES } from "@/constants/spa-images";
import type { VisitType } from "@/lib/bookings/visit-type-availability";

type ServiceGridDensity = "featured" | "standard" | "compact";

function getServiceGridDensity(count: number): ServiceGridDensity {
  if (count <= 2) return "featured";
  if (count <= 6) return "standard";
  return "compact";
}

export type BookingWizardService = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  categoryId?: string | null;
  categoryName?: string;
  categorySortOrder?: number;
  availableInSpa?: boolean;
  availableHomeService?: boolean;
};

type ServiceCategoryGroup = {
  id: string;
  name: string;
  sortOrder: number;
  services: BookingWizardService[];
};

type BookingServicePickerProps = {
  services: BookingWizardService[];
  loading: boolean;
  selected: BookingWizardService[];
  onToggle: (service: BookingWizardService) => void;
  totalDuration: number;
  totalPrice: number;
  visitType: VisitType;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function serviceCategoryId(service: BookingWizardService): string {
  return service.categoryId ?? `category:${service.categoryName ?? "Wellness"}`;
}

function groupServicesByCategory(services: BookingWizardService[]): ServiceCategoryGroup[] {
  const groups = new Map<string, ServiceCategoryGroup>();

  for (const service of services) {
    const id = serviceCategoryId(service);
    const current = groups.get(id) ?? {
      id,
      name: service.categoryName ?? "Wellness",
      sortOrder: service.categorySortOrder ?? 999,
      services: [],
    };

    current.services.push(service);
    groups.set(id, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      services: group.services
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      const categoryDelta = a.sortOrder - b.sortOrder;
      return categoryDelta !== 0 ? categoryDelta : a.name.localeCompare(b.name);
    });
}

// ── Category → image mapping ──────────────────────────────────────────────────

const CATEGORY_IMAGE_KEYWORDS: Array<[string, string]> = [
  ["couples",      SPA_IMAGES.couples],
  ["duo",          SPA_IMAGES.couples],
  ["hot stone",    SPA_IMAGES.hotStone],
  ["stone",        SPA_IMAGES.hotStone],
  ["deep tissue",  SPA_IMAGES.deepTissue],
  ["deep",         SPA_IMAGES.deepTissue],
  ["aromatherapy", SPA_IMAGES.aromatherapy],
  ["aroma",        SPA_IMAGES.aromatherapy],
  ["reflexology",  SPA_IMAGES.reflexology],
  ["foot",         SPA_IMAGES.reflexology],
  ["nail",         SPA_IMAGES.about],
  ["facial",       SPA_IMAGES.aboutSecondary],
  ["skin",         SPA_IMAGES.aboutSecondary],
  ["massage",      SPA_IMAGES.swedish],
  ["body",         SPA_IMAGES.swedish],
  ["wellness",     SPA_IMAGES.booking],
];

function getCategoryImage(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [keyword, img] of CATEGORY_IMAGE_KEYWORDS) {
    if (lower.includes(keyword)) return img;
  }
  return SPA_IMAGES.booking;
}

// ── Mobile service card: image-top + white text area below ────────────────────

function MobileServiceCard({
  service,
  categoryImage,
  isSelected,
  onToggle,
}: {
  service: BookingWizardService;
  categoryImage: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const priceLabel = formatCurrency(service.price);
  const durationLabel = `${service.durationMinutes} min`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      aria-label={`Select ${service.name}, ${durationLabel}, ${priceLabel}`}
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white shadow-sm transition active:scale-[0.98] ${
        isSelected
          ? "border-[#163A2B] ring-1 ring-[#163A2B]"
          : "border-[#E3D7C5]"
      }`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          src={categoryImage}
          alt={`${service.name} service`}
          fill
          className="h-full w-full object-cover"
          sizes="(max-width: 390px) 50vw, (max-width: 520px) 33vw, 25vw"
        />
        {/* Selection indicator */}
        <div
          className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow-sm transition ${
            isSelected
              ? "bg-[#163A2B] text-white"
              : "border border-white/80 bg-black/10 backdrop-blur"
          }`}
          aria-hidden="true"
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>
      </div>

      {/* Text content */}
      <div className="min-w-0 p-2">
        <p
          className="min-w-0 line-clamp-2 text-[12px] font-semibold leading-tight"
          style={{ color: "#163A2B" }}
        >
          {service.name}
        </p>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-1">
          <span className="truncate text-[11px]" style={{ color: "#6B7A6F" }}>
            {durationLabel}
          </span>
          <span className="shrink-0 text-[11px] font-semibold" style={{ color: "#C8A96B" }}>
            {priceLabel}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Desktop service card: full-bleed image with gradient overlay ───────────────

function ServiceImageCard({
  service,
  categoryImage,
  isSelected,
  onToggle,
}: {
  service: BookingWizardService;
  categoryImage: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      aria-label={`Select ${service.name}, ${service.durationMinutes} min, ${formatCurrency(service.price)}`}
      className={`group relative aspect-[4/5] overflow-hidden rounded-2xl transition-all duration-200 ${
        isSelected
          ? "ring-2 ring-[#C8A96B] ring-offset-2 shadow-[0_6px_20px_rgba(200,169,107,0.25)]"
          : "ring-1 ring-[#EDE4D3] hover:ring-[#C8A96B]/60 hover:shadow-md"
      }`}
    >
      <Image
        src={categoryImage}
        alt={`${service.name} service`}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 1024px) 33vw, 25vw"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      {/* Selection indicator */}
      <div
        className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-200 ${
          isSelected
            ? "border-[#C8A96B] bg-[#C8A96B]"
            : "border-white/50 bg-black/30"
        }`}
        aria-hidden="true"
      >
        {isSelected ? (
          <Check className="h-3 w-3 text-[#163A2B]" />
        ) : (
          <Plus className="h-3 w-3 text-white/90" />
        )}
      </div>

      {/* Service info */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 text-[13px] font-semibold leading-[1.35] text-white">
          {service.name}
        </p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-[11px] text-white/70">{service.durationMinutes} min</span>
          <span className="text-[13px] font-bold text-[#C8A96B]">
            {formatCurrency(service.price)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingServicePicker({
  services,
  loading,
  selected,
  onToggle,
  totalDuration,
  totalPrice,
  visitType,
}: BookingServicePickerProps) {
  const [preferredCategoryId, setPreferredCategoryId] = useState<string | null>(null);
  const categories = useMemo(() => groupServicesByCategory(services), [services]);
  const activeCategory =
    categories.find((category) => category.id === preferredCategoryId) ??
    categories[0] ??
    null;
  const selectedIds = new Set(selected.map((service) => service.id));

  if (loading) {
    return (
      <div>
        {/* Mobile loading skeleton */}
        <div className="block w-full max-w-full overflow-hidden md:hidden">
          <div className="w-full max-w-full overflow-hidden">
            <div className="mb-4 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
              ))}
            </div>
          </div>
          <div className="w-full max-w-full overflow-hidden">
            <div className="grid w-full max-w-full grid-cols-2 gap-2.5 min-[390px]:grid-cols-3 min-[520px]:grid-cols-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="rounded-2xl" style={{ aspectRatio: "4/3" }} />
              ))}
            </div>
          </div>
        </div>
        {/* Desktop loading skeleton */}
        <div className="hidden md:grid md:grid-cols-[190px_minmax(0,1fr)] md:gap-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="rounded-2xl" style={{ aspectRatio: "4/5" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] font-medium" style={{ color: "#163A2B" }}>
          No services available
        </p>
        <p className="mt-2 text-[13px]" style={{ color: "#6B7A6F" }}>
          {visitType === "home_service"
            ? "No services are currently available for home service. Please choose in-spa or contact us."
            : "This location does not have any services listed yet."}
        </p>
      </div>
    );
  }

  const categoryImage = activeCategory ? getCategoryImage(activeCategory.name) : SPA_IMAGES.booking;
  const density = getServiceGridDensity(activeCategory?.services.length ?? 0);

  const desktopGridClassName =
    density === "featured"
      ? "grid grid-cols-2 gap-3"
      : density === "standard"
        ? "grid grid-cols-2 gap-3 md:grid-cols-3"
        : "grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="w-full max-w-full overflow-hidden md:overflow-visible">
      <h2
        className="mb-2 text-[18px] font-semibold md:text-2xl md:font-medium"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Select services
      </h2>
      <p className="mb-5 text-[13px] leading-6 md:text-[14px]" style={{ color: "#6B7A6F" }}>
        Choose one or more services for your visit.
      </p>

      {/* Selection summary strip */}
      {selected.length > 0 && (
        <div
          className="mb-4 flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
          style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#15803D" }}>
              {selected.length} {selected.length === 1 ? "service" : "services"} selected
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium" style={{ color: "#163A2B" }}>
              {selected.map((s) => s.name).slice(0, 2).join(", ")}
              {selected.length > 2 && ` +${selected.length - 2} more`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium" style={{ color: "#6B7A6F" }}>{totalDuration} min</p>
            <p className="text-[15px] font-bold" style={{ color: "#C8A96B" }}>
              {formatCurrency(totalPrice)}
            </p>
          </div>
        </div>
      )}

      {/* ── Mobile layout ─────────────────────────────────────────────────────── */}
      <div className="block w-full max-w-full overflow-hidden md:hidden">
        {/* Category chips — scrollable row, no page overflow */}
        <div className="w-full max-w-full overflow-hidden">
          <div className="mb-4 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
            {categories.map((category) => {
              const isActive = category.id === activeCategory?.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setPreferredCategoryId(category.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-[#163A2B] bg-[#163A2B] text-[#FDF8EE]"
                      : "border-[#E3D7C5] bg-white text-[#6B4F2A]"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile service grid: 2 → 3 → 4 columns */}
        {!activeCategory ? (
          <div
            className="rounded-2xl border border-dashed px-4 py-8 text-center"
            style={{ background: "#FCFAF5", borderColor: "#EDE4D3", color: "#6B7A6F" }}
          >
            No services in this category yet.
          </div>
        ) : (
          <div className="w-full max-w-full overflow-hidden">
            <div className="grid w-full max-w-full grid-cols-2 gap-2.5 min-[390px]:grid-cols-3 min-[520px]:grid-cols-4">
              {activeCategory.services.map((service) => (
                <MobileServiceCard
                  key={service.id}
                  service={service}
                  categoryImage={categoryImage}
                  isSelected={selectedIds.has(service.id)}
                  onToggle={() => onToggle(service)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop layout ─────────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <div className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
          {/* Category sidebar */}
          <div className="flex flex-col gap-2">
            {categories.map((category) => {
              const isActive = category.id === activeCategory?.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setPreferredCategoryId(category.id)}
                  className={`flex items-center justify-between rounded-full border px-4 py-2.5 text-left text-[12px] font-semibold transition-colors ${
                    isActive
                      ? "border-[#163A2B] bg-[#163A2B] text-[#FDF8EE]"
                      : "border-[#EDE4D3] bg-white text-[#6B4F2A] hover:border-[#C8A96B]/60"
                  }`}
                >
                  <span className="truncate">{category.name}</span>
                  <span className={isActive ? "text-[#C8A96B]" : "text-[#9AA89A]"}>
                    {category.services.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop image grid */}
          {!activeCategory ? (
            <div
              className="rounded-2xl border border-dashed px-4 py-8 text-center"
              style={{ background: "#FCFAF5", borderColor: "#EDE4D3", color: "#6B7A6F" }}
            >
              No services in this category yet.
            </div>
          ) : (
            <div className={density === "featured" ? "max-w-[620px]" : undefined}>
              <div className={desktopGridClassName}>
                {activeCategory.services.map((service) => (
                  <ServiceImageCard
                    key={service.id}
                    service={service}
                    categoryImage={categoryImage}
                    isSelected={selectedIds.has(service.id)}
                    onToggle={() => onToggle(service)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
