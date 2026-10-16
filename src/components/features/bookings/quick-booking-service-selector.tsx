"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, PlusCircle, Search, Sparkles, Trash2, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { QuickBookingServiceOption } from "@/components/features/bookings/quick-booking-form";

type QuickBookingServiceSelectorProps = {
  services: QuickBookingServiceOption[];
  selectedServiceIds: string[];
  onChange: (serviceIds: string[]) => void;
  onAdjust?: (service: QuickBookingServiceOption) => void;
  isHomeService: boolean;
  disabled?: boolean;
  error?: string;
  maxServices?: number;
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
  isHomeService,
  disabled = false,
  error,
  maxServices = 5,
}: QuickBookingServiceSelectorProps) {
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const selectedServices = useMemo(
    () =>
      selectedServiceIds
        .map((id) => services.find((service) => service.id === id))
        .filter((service): service is QuickBookingServiceOption => Boolean(service)),
    [selectedServiceIds, services]
  );

  // Extract canonical categories from the loaded services list
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const service of services) {
      if (service.categoryId && service.categoryName) {
        map.set(service.categoryId, service.categoryName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [services]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (selectedCategoryId && service.categoryId !== selectedCategoryId) {
        return false;
      }
      if (normalizedQuery) {
        const nameMatch = service.name.toLowerCase().includes(normalizedQuery);
        const descMatch = service.description?.toLowerCase().includes(normalizedQuery);
        const catMatch = service.categoryName?.toLowerCase().includes(normalizedQuery);
        return nameMatch || Boolean(descMatch) || Boolean(catMatch);
      }
      return true;
    });
  }, [services, selectedCategoryId, normalizedQuery]);

  const totalDurationMinutes = selectedServices.reduce(
    (sum, service) => sum + service.durationMinutes,
    0
  );

  const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);

  function toggleService(serviceId: string) {
    if (disabled) return;

    if (selectedServiceIds.includes(serviceId)) {
      onChange(selectedServiceIds.filter((id) => id !== serviceId));
      return;
    }

    if (selectedServiceIds.length >= maxServices) return;

    onChange([...selectedServiceIds, serviceId]);
  }

  function removeService(serviceId: string) {
    if (disabled) return;
    onChange(selectedServiceIds.filter((id) => id !== serviceId));
  }

  function clearServices() {
    if (disabled) return;
    onChange([]);
  }

  return (
    <div className="min-w-0 space-y-3">
      {/* 2-Column Catalog Layout: Left ~55% Available, Right ~45% Selected */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        {/* Left Column: Select Services */}
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={searchInputId}
              className="text-xs font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]"
            >
              Select Services
            </label>
            <span className="text-[11px] font-medium text-[var(--cs-text-muted)]">
              {filteredServices.length} available
            </span>
          </div>

          {/* Search Input with accessible trigger */}
          <div className="relative flex items-center">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 text-[var(--cs-text-muted)]"
            />
            <input
              id={searchInputId}
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              placeholder="Search services…"
              className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-16 text-xs text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand-dark)] focus:ring-1 focus:ring-[var(--cs-sand-dark)]"
            />

            {/* Accessible button for search trigger compatibility */}
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              aria-label={isHomeService ? "Search home-service services" : "Search in-spa services"}
              className="sr-only"
            >
              {isHomeService ? "Search home-service services" : "Search in-spa services"}
            </button>

            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 grid size-6 place-items-center rounded-md text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
                aria-label="Clear service search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Category Filter Pills */}
          {categories.length > 0 ? (
            <div
              className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 text-xs"
              role="group"
              aria-label="Service categories"
            >
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  "h-7 shrink-0 rounded-full px-3 text-xs font-semibold transition",
                  selectedCategoryId === null
                    ? "bg-[#7A583E] text-white shadow-xs"
                    : "border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-sand-mist)]"
                )}
              >
                All
              </button>
              {categories.map((category) => {
                const isActive = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(isActive ? null : category.id)}
                    className={cn(
                      "h-7 shrink-0 rounded-full px-3 text-xs font-semibold transition",
                      isActive
                        ? "bg-[#7A583E] text-white shadow-xs"
                        : "border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-sand-mist)]"
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Service Cards Grid (2 columns on sm+, single column on xs) */}
          <div className="grid max-h-[340px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {filteredServices.length > 0 ? (
              filteredServices.map((service) => {
                const isSelected = selectedServiceIds.includes(service.id);
                const atLimit = !isSelected && selectedServiceIds.length >= maxServices;

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    disabled={disabled || atLimit}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl border p-2 text-left transition",
                      isSelected
                        ? "border-[#7A583E] bg-[#F7F4F0] ring-1 ring-[#7A583E]/40"
                        : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-sand-dark)] hover:bg-[var(--cs-surface-warm)]",
                      atLimit ? "cursor-not-allowed opacity-50" : "",
                      disabled ? "cursor-not-allowed opacity-70" : ""
                    )}
                    aria-pressed={isSelected}
                  >
                    {/* Thumbnail */}
                    {service.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={service.imageUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
                        <Sparkles size={18} />
                      </div>
                    )}

                    {/* Service Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[var(--cs-text)] group-hover:text-[var(--cs-primary)]">
                        {service.name}
                      </p>
                      {service.description ? (
                        <p className="line-clamp-1 text-[11px] text-[var(--cs-text-muted)]">
                          {service.description}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] font-medium text-[var(--cs-text-secondary)]">
                        {formatServiceDuration(service.durationMinutes)} ·{" "}
                        {formatCurrency(service.price)}
                      </p>
                    </div>

                    {/* Action Icon */}
                    <div className="shrink-0 pl-1">
                      {isSelected ? (
                        <span className="grid size-6 place-items-center rounded-full bg-[#7A583E] text-white">
                          <Check size={13} strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span className="grid size-6 place-items-center text-[var(--cs-sand-dark)] transition group-hover:scale-110">
                          <PlusCircle size={18} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full rounded-xl border border-dashed border-[var(--cs-border)] px-4 py-8 text-center text-xs text-[var(--cs-text-muted)]">
                No services match your search or filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Services */}
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Selected Services ({selectedServices.length})
            </span>
            {selectedServices.length > 0 ? (
              <button
                type="button"
                onClick={clearServices}
                disabled={disabled}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C2828] hover:underline disabled:opacity-50"
              >
                <Trash2 size={12} />
                Clear all
              </button>
            ) : null}
          </div>

          {/* Selected Services Card List */}
          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {selectedServices.length > 0 ? (
              selectedServices.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2.5 shadow-xs"
                >
                  {/* Thumbnail */}
                  {service.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={service.imageUrl}
                      alt=""
                      className="size-11 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
                      <Sparkles size={16} />
                    </div>
                  )}

                  {/* Title & Desc */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[var(--cs-text)]">
                      {service.name}
                    </p>
                    {service.description ? (
                      <p className="line-clamp-1 text-[11px] text-[var(--cs-text-muted)]">
                        {service.description}
                      </p>
                    ) : null}
                  </div>

                  {/* Duration Trigger or Badge */}
                  <div className="shrink-0">
                    {service.durationPolicy === "extendable" ? (
                      <button
                        type="button"
                        onClick={() => onAdjust?.(service)}
                        disabled={disabled}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 text-xs font-semibold text-[var(--cs-text)] transition hover:border-[#7A583E] hover:bg-[#F7F4F0] disabled:opacity-60"
                        title="Adjust duration"
                      >
                        <span>{formatServiceDuration(service.durationMinutes)}</span>
                        <ChevronDown size={12} className="text-[var(--cs-text-muted)]" />
                      </button>
                    ) : (
                      <span className="inline-flex h-7 items-center rounded-lg border border-transparent bg-[var(--cs-surface-warm)] px-2 text-xs font-medium text-[var(--cs-text-secondary)]">
                        {formatServiceDuration(service.durationMinutes)}
                      </span>
                    )}
                  </div>

                  {/* Authoritative Price */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-[var(--cs-text)]">
                      {formatCurrency(service.price)}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeService(service.id)}
                    disabled={disabled}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface-warm)] hover:text-red-600 disabled:opacity-50"
                    aria-label={`Remove ${service.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--cs-border)] p-4 text-center text-xs text-[var(--cs-text-muted)]">
                <Sparkles size={20} className="mb-1 text-[var(--cs-sand-dark)]/60" />
                No services selected.
                <span className="mt-0.5 text-[11px]">Click any service on the left to add it.</span>
              </div>
            )}
          </div>

          {/* Subtotal Summary for Active Guest */}
          {selectedServices.length > 0 ? (
            <div className="flex items-center justify-between border-t border-[var(--cs-border-soft)] pt-2 text-xs font-semibold text-[var(--cs-text-secondary)]">
              <span>
                {selectedServices.length} service{selectedServices.length === 1 ? "" : "s"} ·{" "}
                {formatServiceDuration(totalDurationMinutes)}
              </span>
              <span className="text-[var(--cs-text)]">{formatCurrency(totalPrice)}</span>
            </div>
          ) : null}

          {selectedServiceIds.length >= maxServices ? (
            <p className="text-xs font-medium text-[var(--cs-warning-text)]">
              Maximum {maxServices} services per guest session.
            </p>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs font-medium text-[var(--cs-error-text)]">{error}</p> : null}
    </div>
  );
}
