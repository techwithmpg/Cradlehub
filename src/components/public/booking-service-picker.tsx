"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { VisitType } from "@/lib/bookings/visit-type-availability";

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
  const selectedPreview = selected.slice(0, 2).map((service) => service.name).join(", ");
  const hiddenSelectedCount = Math.max(0, selected.length - 2);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="hidden gap-2 md:flex md:flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[94px] rounded-xl" />
          ))}
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

  return (
    <div>
      <h2
        className="mb-2 text-[18px] font-semibold md:text-2xl md:font-medium"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Select services
      </h2>
      <p className="mb-5 text-[13px] leading-6 md:text-[14px]" style={{ color: "#6B7A6F" }}>
        Choose one or more services for your visit.
      </p>

      <div
        className="mb-4 rounded-xl border px-4 py-3 md:flex md:items-center md:justify-between md:gap-4"
        style={{ background: "#FCFAF5", borderColor: "#EDE4D3" }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9AA89A" }}>
            {selected.length > 0
              ? `${selected.length} ${selected.length === 1 ? "service" : "services"} selected`
              : "No services selected"}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-medium" style={{ color: selected.length > 0 ? "#163A2B" : "#6B7A6F" }}>
            {selected.length > 0
              ? `${selectedPreview}${hiddenSelectedCount > 0 ? ` +${hiddenSelectedCount} more` : ""}`
              : "Choose a treatment to begin."}
          </p>
        </div>
        {selected.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-4 md:mt-0 md:shrink-0 md:justify-end">
            <span className="text-[12px] font-semibold" style={{ color: "#6B7A6F" }}>
              {totalDuration} min
            </span>
            <span className="text-[18px] font-semibold" style={{ color: "#C8A96B" }}>
              {formatCurrency(totalPrice)}
            </span>
          </div>
        )}
      </div>

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
        {categories.map((category) => {
          const isActive = category.id === activeCategory?.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setPreferredCategoryId(category.id)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-colors ${
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

      <div className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
        <div className="hidden md:flex md:flex-col md:gap-2">
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

        <div className="flex flex-col gap-2.5">
          {!activeCategory ? (
            <div
              className="rounded-xl border border-dashed px-4 py-8 text-center"
              style={{ background: "#FCFAF5", borderColor: "#EDE4D3", color: "#6B7A6F" }}
            >
              No services in this category yet.
            </div>
          ) : (
            activeCategory.services.map((service) => {
              const isSelected = selectedIds.has(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onToggle(service)}
                  aria-pressed={isSelected}
                  className={`grid grid-cols-[1fr_auto] items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-[#C8A96B] bg-[#FFFAF0] shadow-[0_4px_14px_rgba(200,169,107,0.14)]"
                      : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/60"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-[13px] font-semibold leading-5 md:text-[14px]" style={{ color: "#163A2B" }}>
                        {service.name}
                      </p>
                      <span className="text-[11px] font-medium" style={{ color: "#9AA89A" }}>
                        {service.durationMinutes} min
                      </span>
                    </div>
                    {service.description && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-[1.4]" style={{ color: "#6B7A6F" }}>
                        {service.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {service.availableInSpa !== false && (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: "#EFF7F2", color: "#2E6E4E" }}
                        >
                          In-spa
                        </span>
                      )}
                      {service.availableHomeService && (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: "#EEF2FF", color: "#3557B7" }}
                        >
                          Home service
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-0.5">
                    <span className="text-[13px] font-semibold" style={{ color: "#C8A96B" }}>
                      {formatCurrency(service.price)}
                    </span>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? "border-[#163A2B] bg-[#163A2B] text-[#C8A96B]"
                          : "border-[#D8CCBA] bg-white text-[#9AA89A]"
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
