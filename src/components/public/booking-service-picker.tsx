"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";

import { ServiceImage } from "@/components/public/service-image";
import { InlineServiceDurationSlider } from "@/components/public/inline-service-duration-slider";
import { Skeleton } from "@/components/ui/skeleton";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";
import type { VisitType } from "@/lib/bookings/visit-type-availability";
import { resolveServiceImage } from "@/lib/service-images";

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
  durationPolicy?: "fixed" | "extendable";
  quoteVersion?: string;
  durationAdjusted?: boolean;
  price: number;
  categoryId?: string | null;
  categoryName?: string;
  categorySortOrder?: number;
  availableInSpa?: boolean;
  availableHomeService?: boolean;
  imageUrl?: string | null;
  imageAlt?: string | null;
  bookingMode?: "automatic" | "consultation";
  consultationMessage?: string | null;
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
  onAdjust?: (service: BookingWizardService) => void;
  inlineDuration?: boolean;
  branchId?: string;
  attendeeId?: string;
  lineQuotes?: Record<string, ServiceLineQuote>;
  onSelectQuote?: (service: BookingWizardService, quote: ServiceLineQuote) => void;
  heading?: string;
  totalDuration: number;
  totalPrice: number;
  visitType: VisitType;
  theme?: "default" | "warm";
};

const WARM_HEADING_STYLE = {
  fontFamily: "var(--sp-font-display)",
  color: "#10261D",
} as const;
const WARM_BODY_STYLE = { color: "#3E4C44" } as const;
const WARM_MUTED_STYLE = { color: "#6B766F" } as const;
const WARM_LABEL_STYLE = { color: "#8A6D3B" } as const;
const WARM_GLASS_CARD =
  "border border-[#E5DEC9] bg-white shadow-xs";
const WARM_SKELETON_CLS =
  "bg-[#EDE4D3] after:via-white/60";

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

// ── Mobile service card: image-led with warm dark overlay ─────────────────────

function MobileServiceCard({
  service,
  isSelected,
  onToggle,
}: {
  service: BookingWizardService;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const priceLabel = formatCurrency(service.price);
  const durationLabel = `${service.durationMinutes} min`;
  const serviceImage = resolveServiceImage(service);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      aria-label={`Select ${service.name}, ${durationLabel}, ${priceLabel}`}
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white shadow-xs transition active:scale-[0.98] ${
        isSelected
          ? "border-[#163A2B] ring-2 ring-[#163A2B]/35"
          : "border-[#E5DEC9] hover:border-[#C8A96B]"
      }`}
    >
      <div className="relative aspect-[4/4.6] w-full overflow-hidden">
        <ServiceImage
          src={serviceImage.imageUrl}
          alt={serviceImage.imageAlt}
          fill
          className="h-full w-full object-cover"
          sizes="(max-width: 390px) 50vw, (max-width: 520px) 33vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#10261D]/92 via-[#10261D]/30 to-transparent" />
        <div
          className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow-sm transition ${
            isSelected
              ? "bg-[#D4B57A] text-[#10261D]"
              : "border border-white/65 bg-[#10261D]/45 backdrop-blur"
          }`}
          aria-hidden="true"
        >
          {isSelected && <Check className="h-3 w-3 text-[#10261D]" />}
        </div>

        <div className="absolute inset-x-0 bottom-0 min-w-0 p-2.5">
          <p className="min-w-0 line-clamp-2 text-[12px] font-semibold leading-tight text-[#F6EBD6]">
            {service.name}
          </p>
          {service.bookingMode === "consultation" ? (
            <p className="mt-1 text-left text-[10px] font-semibold text-[#D4B57A]">
              Manual arrangement required
            </p>
          ) : null}
          <div className="mt-1 flex min-w-0 items-center justify-between gap-1">
            <span className="truncate text-[11px] text-[#F6EBD6]/68">
              {durationLabel}
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-[#D4B57A]">
              {priceLabel}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Desktop service card: full-bleed image with gradient overlay ───────────────

function ServiceImageCard({
  service,
  isSelected,
  onToggle,
}: {
  service: BookingWizardService;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const serviceImage = resolveServiceImage(service);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      aria-label={`Select ${service.name}, ${service.durationMinutes} min, ${formatCurrency(service.price)}`}
      className={`group relative aspect-[4/5] overflow-hidden rounded-2xl transition-all duration-200 ${
        isSelected
          ? "ring-2 ring-[#163A2B] ring-offset-2 ring-offset-[#F7F3EB] shadow-md"
          : "ring-1 ring-[#E5DEC9] hover:ring-[#C8A96B] hover:shadow-md"
      }`}
    >
      <ServiceImage
        src={serviceImage.imageUrl}
        alt={serviceImage.imageAlt}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 1024px) 33vw, 25vw"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[#10261D]/90 via-[#10261D]/20 to-transparent" />

      {service.bookingMode === "consultation" ? (
        <span className="absolute left-2 top-2 rounded-full bg-[#10261D]/90 px-2 py-1 text-[10px] font-semibold text-[#E8D5A3]">
          Manual arrangement required
        </span>
      ) : null}

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
        <p className="line-clamp-2 text-[13px] font-semibold leading-[1.35] text-[#F6EBD6]">
          {service.name}
        </p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-[11px] text-[#F6EBD6]/70">{service.durationMinutes} min</span>
          <span className="text-[13px] font-bold text-[#D4B57A]">
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
  onAdjust,
  inlineDuration = false,
  branchId,
  attendeeId = "att-1",
  lineQuotes = {},
  onSelectQuote,
  heading = "Select services",
  totalDuration,
  totalPrice,
  visitType,
  theme = "warm",
}: BookingServicePickerProps) {
  const [preferredCategoryId, setPreferredCategoryId] = useState<string | null>(null);
  const categories = useMemo(() => groupServicesByCategory(services), [services]);
  const activeCategory =
    categories.find((category) => category.id === preferredCategoryId) ??
    categories[0] ??
    null;
  const selectedIds = new Set(selected.map((service) => service.id));
  const hasInlineDuration = inlineDuration && Boolean(branchId) &&
    selected.some((service) => service.durationPolicy === "extendable");
  const skeletonClassName = theme === "warm" ? WARM_SKELETON_CLS : "";

  if (loading) {
    return (
      <div>
        {/* Mobile loading skeleton */}
        <div className="w-full max-w-full md:hidden">
          <div className="w-full max-w-full shrink-0 overflow-hidden">
            <div className="mb-3 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className={`h-9 w-24 shrink-0 rounded-full ${skeletonClassName}`} />
              ))}
            </div>
          </div>
          <div className="w-full max-w-full">
            <div className="grid w-full max-w-full grid-cols-2 gap-2.5 min-[390px]:grid-cols-3 min-[520px]:grid-cols-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className={`rounded-2xl ${skeletonClassName}`} style={{ aspectRatio: "4/3" }} />
              ))}
            </div>
          </div>
        </div>
        {/* Desktop loading skeleton */}
        <div className="hidden md:grid md:grid-cols-[190px_minmax(0,1fr)] md:gap-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={`h-11 rounded-full ${skeletonClassName}`} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={`rounded-2xl ${skeletonClassName}`} style={{ aspectRatio: "4/5" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] font-medium" style={WARM_HEADING_STYLE}>
          No services available
        </p>
        <p className="mt-2 text-[13px]" style={WARM_MUTED_STYLE}>
          {visitType === "home_service"
            ? "No services are currently available for home service. Please choose in-spa or contact us."
            : "This location does not have any services listed yet."}
        </p>
      </div>
    );
  }

  const density = getServiceGridDensity(activeCategory?.services.length ?? 0);

  const desktopGridClassName =
    density === "featured"
      ? "grid grid-cols-2 gap-3"
      : density === "standard"
        ? "grid grid-cols-2 gap-3 md:grid-cols-3"
        : "grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="w-full max-w-full">
      <h2
        className="mb-1.5 shrink-0 text-[17px] font-semibold md:mb-2 md:text-2xl md:font-medium"
        style={WARM_HEADING_STYLE}
      >
        {heading}
      </h2>
      <p className="mb-3 shrink-0 text-[12px] leading-5 md:mb-5 md:text-[14px] md:leading-6" style={WARM_BODY_STYLE}>
        Choose one or more services for your visit.
      </p>

      {/* Selection summary strip */}
      {selected.length > 0 && (
        <div
          className={`mb-3 flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 md:mb-4 md:gap-4 md:px-4 md:py-3 ${hasInlineDuration ? "flex-wrap" : ""} ${WARM_GLASS_CARD}`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={WARM_LABEL_STYLE}>
              {selected.length} {selected.length === 1 ? "service" : "services"} selected
            </p>
            {!hasInlineDuration || selected.length === 1 ? (
              <p className="mt-0.5 truncate text-[13px] font-medium" style={WARM_BODY_STYLE}>
                {selected.map((s) => s.name).slice(0, 2).join(", ")}
                {selected.length > 2 && ` +${selected.length - 2} more`}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium" style={WARM_MUTED_STYLE}>{totalDuration} min</p>
            <p className="text-[15px] font-bold" style={WARM_LABEL_STYLE}>
              {formatCurrency(totalPrice)}
            </p>
          </div>
          {hasInlineDuration ? (
            <div className="w-full">
              {selected.map((service) => (
                <div key={`${attendeeId}:${service.id}`} className={selected.length > 1 ? "mt-2 border-t border-[#E5DEC9] pt-2" : ""}>
                  {selected.length > 1 ? (
                    <div className="flex items-center justify-between gap-3 text-[12px] text-[#10261D]">
                      <span className="min-w-0 truncate font-medium">{service.name}</span>
                      <span className="shrink-0 font-semibold text-[#163A2B]">{service.durationMinutes} min · {formatCurrency(service.price)}</span>
                    </div>
                  ) : null}
                  {service.durationPolicy === "extendable" ? (
                    <InlineServiceDurationSlider branchId={branchId!} serviceId={service.id}
                      serviceName={service.name} baseQuoteVersion={service.quoteVersion}
                      selectedQuote={lineQuotes[`${attendeeId}:${service.id}`]}
                      currentDurationMinutes={service.durationMinutes} deliveryMode={visitType}
                      onSelectQuote={(quote) => onSelectQuote?.(service, quote)} />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {!inlineDuration && selected.some((service) => service.durationPolicy === "extendable") ? (
        <div className="mb-4 space-y-2">
          {selected.filter((service) => service.durationPolicy === "extendable").map((service) => (
            <button key={service.id} type="button" onClick={() => onAdjust?.(service)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#10261D] ${WARM_GLASS_CARD}`}>
              <span className="min-w-0 truncate font-semibold">{service.name}</span>
              <span className="shrink-0 text-xs font-semibold text-[#8A6D3B]">
                {service.durationAdjusted ? `${service.durationMinutes} min · ${formatCurrency(service.price)}` : `${service.durationMinutes} min+ · From ${formatCurrency(service.price)}`} · Adjust ›
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {/* ── Mobile layout ─────────────────────────────────────────────────────── */}
      <div className="w-full max-w-full md:hidden">
        {/* Category chips — scrollable row, no page overflow */}
        <div className="w-full max-w-full shrink-0 overflow-hidden">
          <div className="mb-3 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
            {categories.map((category) => {
              const isActive = category.id === activeCategory?.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setPreferredCategoryId(category.id)}
                  className={`min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                    isActive
                      ? "border-[#163A2B] bg-[#163A2B] text-[#FAF5E9]"
                      : "border-[#DDD4C2] bg-white text-[#3E4C44]"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile service grid: 2 → 3 → 4 columns */}
        <div className="w-full max-w-full">
          {!activeCategory ? (
            <div
              className="rounded-2xl border border-dashed border-[#D7CEBC] bg-[#FCFAF5] px-4 py-8 text-center text-[#55635B]"
            >
              No services in this category yet.
            </div>
          ) : (
            <div className="grid w-full max-w-full grid-cols-2 gap-2.5 min-[390px]:grid-cols-3 min-[520px]:grid-cols-4">
              {activeCategory.services.map((service) => (
                <MobileServiceCard
                  key={service.id}
                  service={service}
                  isSelected={selectedIds.has(service.id)}
                  onToggle={() => onToggle(service)}
                />
              ))}
            </div>
          )}
        </div>
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
                      ? "border-[#163A2B] bg-[#163A2B] text-[#FAF5E9]"
                      : "border-[#DDD4C2] bg-white text-[#3E4C44] hover:border-[#C8A96B]"
                  }`}
                >
                  <span className="truncate">{category.name}</span>
                  <span className={isActive ? "text-[#E8D5A3]" : "text-[#8A6D3B]"}>
                    {category.services.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop image grid */}
          {!activeCategory ? (
            <div
              className="rounded-2xl border border-dashed border-[#D7CEBC] bg-[#FCFAF5] px-4 py-8 text-center text-[#55635B]"
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
