"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { QuickBookingServiceOption } from "@/components/features/bookings/quick-booking-form";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";
import { InlineServiceDurationDropdown } from "@/components/features/bookings/inline-service-duration-dropdown";

type QuickBookingServiceSelectorProps = {
  services: QuickBookingServiceOption[];
  selectedServiceIds: string[];
  onChange: (serviceIds: string[]) => void;
  onAdjust?: (service: QuickBookingServiceOption) => void;
  onSelectQuote?: (service: QuickBookingServiceOption, quote: ServiceLineQuote) => void;
  branchId?: string;
  isHomeService: boolean;
  disabled?: boolean;
  error?: string;
  maxServices?: number;
  durationPresentation?: "dropdown" | "guest-buttons";
};

export function formatServiceDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function QuickBookingServiceSelector({
  services,
  selectedServiceIds,
  onChange,
  onAdjust,
  onSelectQuote,
  branchId,
  isHomeService,
  disabled = false,
  error,
  maxServices = 5,
  durationPresentation = "dropdown",
}: QuickBookingServiceSelectorProps) {
  const searchId = useId();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const updateCount = () => {
      const width = carouselRef.current?.clientWidth || window.innerWidth;
      setVisibleCount(width >= 760 ? 4 : width >= 520 ? 3 : width >= 340 ? 2 : 1);
    };
    updateCount();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateCount);
    if (observer && carouselRef.current) observer.observe(carouselRef.current);
    window.addEventListener("resize", updateCount);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateCount);
    };
  }, []);

  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    for (const service of services) {
      if (service.categoryId && service.categoryName) {
        unique.set(service.categoryId, service.categoryName);
      }
    }
    return Array.from(unique, ([id, name]) => ({ id, name }));
  }, [services]);

  const selectedServices = useMemo(
    () =>
      selectedServiceIds
        .map((id) => services.find((service) => service.id === id))
        .filter((service): service is QuickBookingServiceOption => Boolean(service)),
    [selectedServiceIds, services]
  );

  const filteredServices = useMemo(() => {
    const term = query.trim().toLowerCase();
    return services.filter((service) => {
      if (categoryId && service.categoryId !== categoryId) return false;
      if (!term) return true;
      return (
        service.name.toLowerCase().includes(term) ||
        Boolean(service.description?.toLowerCase().includes(term)) ||
        Boolean(service.categoryName?.toLowerCase().includes(term))
      );
    });
  }, [services, categoryId, query]);

  const maxOffset = Math.max(0, filteredServices.length - visibleCount);
  const currentOffset = Math.min(offset, maxOffset);
  const visibleServices = filteredServices.slice(currentOffset, currentOffset + visibleCount);
  const selectedPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const selectedMinutes = selectedServices.reduce(
    (sum, service) => sum + service.durationMinutes,
    0
  );

  function changeCategory(nextId: string | null) {
    setCategoryId(nextId);
    setOffset(0);
  }

  function toggleService(serviceId: string) {
    if (disabled) return;
    if (selectedServiceIds.includes(serviceId)) {
      onChange(selectedServiceIds.filter((id) => id !== serviceId));
    } else if (selectedServiceIds.length < maxServices) {
      onChange([...selectedServiceIds, serviceId]);
    }
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={searchId} className="shrink-0 text-xs font-bold text-[var(--cs-text)]">
          Service
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cs-text-muted)]"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOffset(0);
            }}
            disabled={disabled}
            placeholder="Search all services"
            className="h-8 w-full rounded-lg border border-[var(--cs-border)] bg-white pl-8 pr-3 text-xs outline-none focus:border-[#006044] focus:ring-2 focus:ring-[#006044]/20"
          />
        </div>
        <span
          className="shrink-0 text-[11px] text-[var(--cs-text-muted)]"
          role="status"
          aria-live="polite"
        >
          {filteredServices.length
            ? `${currentOffset + 1}–${currentOffset + visibleServices.length} of ${filteredServices.length}`
            : "0 services"}
        </span>
      </div>

      <select
        aria-label="Service category"
        value={categoryId || ""}
        onChange={(event) => changeCategory(event.target.value || null)}
        disabled={disabled}
        className="h-8 w-full rounded-lg border border-[var(--cs-border)] bg-white px-2 text-xs text-[var(--cs-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006044] sm:hidden"
      >
        <option value="">All service categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <div
        className="hidden min-w-0 items-center gap-1.5 sm:flex"
        role="group"
        aria-label="Service categories"
      >
        <button
          type="button"
          onClick={() => changeCategory(null)}
          aria-pressed={!categoryId}
          className={cn(
            "h-6 shrink-0 rounded-full px-2.5 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006044]",
            !categoryId ? "bg-[#006044] text-white" : "border border-[var(--cs-border)] bg-white"
          )}
        >
          All
        </button>
        {categories.slice(0, 4).map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => changeCategory(category.id)}
            aria-pressed={categoryId === category.id}
            className={cn(
              "h-6 min-w-0 max-w-36 shrink-0 truncate rounded-full px-2.5 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006044]",
              categoryId === category.id
                ? "bg-[#006044] text-white"
                : "border border-[var(--cs-border)] bg-white"
            )}
            title={category.name}
          >
            {category.name}
          </button>
        ))}
        {categories.length > 4 ? (
          <select
            aria-label="More service categories"
            value={
              categoryId && categories.slice(4).some((category) => category.id === categoryId)
                ? categoryId
                : ""
            }
            onChange={(event) => changeCategory(event.target.value || null)}
            disabled={disabled}
            className="h-6 min-w-0 max-w-40 rounded-full border border-[var(--cs-border)] bg-white px-2 text-[11px] text-[var(--cs-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006044]"
          >
            <option value="">More categories</option>
            {categories.slice(4).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div
        ref={carouselRef}
        className="flex min-w-0 items-stretch gap-1.5"
        aria-label="Service choices"
      >
        <button
          type="button"
          onClick={() => setOffset(Math.max(0, currentOffset - visibleCount))}
          disabled={disabled || currentOffset === 0}
          aria-label="Previous services"
          className="grid w-7 shrink-0 place-items-center rounded-lg border border-[var(--cs-border)] bg-white text-[#006044] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006044]"
        >
          <ChevronLeft size={17} />
        </button>
        <div
          className="grid min-w-0 flex-1 gap-1.5"
          style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}
        >
          {visibleServices.length ? (
            visibleServices.map((service) => {
              const selected = selectedServiceIds.includes(service.id);
              const atLimit = !selected && selectedServiceIds.length >= maxServices;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  disabled={disabled || atLimit}
                  aria-pressed={selected}
                  aria-label={`${service.name}, ${formatServiceDuration(service.durationMinutes)}, ${formatCurrency(service.price)}`}
                  className={cn(
                    "flex min-h-16 min-w-0 items-center gap-1.5 rounded-lg border p-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006044]",
                    selected
                      ? "border-[#006044] bg-[#f0f8f3] ring-1 ring-[#006044]/30"
                      : "border-[var(--cs-border)] bg-white hover:border-[#006044]",
                    atLimit && "opacity-50"
                  )}
                >
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt=""
                      loading="lazy"
                      className="size-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--cs-sand-mist)] text-[#006044]">
                      <Sparkles size={15} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-xs font-bold text-[var(--cs-text)]"
                      title={service.name}
                    >
                      {service.name}
                    </span>
                    {service.description ? (
                      <span
                        className="block truncate text-[10px] text-[var(--cs-text-muted)]"
                        title={service.description}
                      >
                        {service.description}
                      </span>
                    ) : null}
                    <span className="block truncate text-[11px] text-[var(--cs-text-muted)]">
                      {formatServiceDuration(service.durationMinutes)}
                    </span>
                    <span className="block text-xs font-bold text-[var(--cs-text)]">
                      {formatCurrency(service.price)}
                    </span>
                  </span>
                  {selected ? <Check size={15} className="shrink-0 text-[#006044]" /> : null}
                </button>
              );
            })
          ) : (
            <div className="flex min-h-16 items-center justify-center rounded-lg border border-dashed border-[var(--cs-border)] px-2 text-xs text-[var(--cs-text-muted)]">
              No services match this search or category.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOffset(Math.min(maxOffset, currentOffset + visibleCount))}
          disabled={disabled || currentOffset >= maxOffset}
          aria-label="Next services"
          className="grid w-7 shrink-0 place-items-center rounded-lg border border-[var(--cs-border)] bg-white text-[#006044] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006044]"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      {selectedServices.length ? (
        <div className="flex flex-wrap items-center gap-1" aria-label="Selected services">
          {selectedServices.map((service) => (
            <div
              key={service.id}
              className="flex h-7 min-w-0 items-center gap-1 rounded-lg border border-[#006044]/20 bg-[#f0f8f3] pl-2 pr-1 text-xs"
            >
              <span className="max-w-24 truncate font-semibold" title={service.name}>
                {service.name}
              </span>
              {durationPresentation === "guest-buttons" ? (
                <span className="text-[11px]">
                  {formatServiceDuration(service.durationMinutes)}
                </span>
              ) : service.durationPolicy === "extendable" && branchId ? (
                <InlineServiceDurationDropdown
                  branchId={branchId}
                  service={service}
                  deliveryMode={isHomeService ? "home_service" : "in_spa"}
                  disabled={disabled}
                  onSelectQuote={(quote) => onSelectQuote?.(service, quote)}
                />
              ) : service.durationPolicy === "extendable" && onAdjust ? (
                <button
                  type="button"
                  onClick={() => onAdjust(service)}
                  disabled={disabled}
                  title="Adjust duration"
                  className="inline-flex items-center gap-0.5 rounded border border-[var(--cs-border)] px-1 text-[11px]"
                >
                  <span>{formatServiceDuration(service.durationMinutes)}</span>
                  <ChevronDown size={11} />
                </button>
              ) : (
                <span className="text-[11px]">
                  {formatServiceDuration(service.durationMinutes)}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleService(service.id)}
                disabled={disabled}
                aria-label={`Remove ${service.name}`}
                className="grid size-5 place-items-center rounded hover:bg-[#006044]/10 focus-visible:outline-2 focus-visible:outline-[#006044]"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <span className="ml-auto whitespace-nowrap text-[11px] font-semibold text-[var(--cs-text)]">
            {formatServiceDuration(selectedMinutes)} · {formatCurrency(selectedPrice)}
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            aria-label="Clear selected services"
            className="grid size-6 place-items-center rounded text-[var(--cs-text-muted)] hover:text-red-600 focus-visible:outline-2 focus-visible:outline-[#006044]"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : null}
      {selectedServiceIds.length >= maxServices ? (
        <p className="text-[11px] text-[var(--cs-warning-text)]">
          Maximum {maxServices} services per guest.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-[var(--cs-error-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
