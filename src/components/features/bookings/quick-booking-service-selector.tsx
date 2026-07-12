"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { QuickBookingServiceOption } from "@/components/features/bookings/quick-booking-form";

type QuickBookingServiceSelectorProps = {
  services: QuickBookingServiceOption[];
  selectedServiceIds: string[];
  onChange: (serviceIds: string[]) => void;
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
  isHomeService,
  disabled = false,
  error,
  maxServices = 5,
}: QuickBookingServiceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedServices = useMemo(
    () =>
      selectedServiceIds
        .map((id) => services.find((service) => service.id === id))
        .filter((service): service is QuickBookingServiceOption => Boolean(service)),
    [selectedServiceIds, services]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredServices = useMemo(
    () =>
      services.filter((service) =>
        normalizedQuery ? service.name.toLowerCase().includes(normalizedQuery) : true
      ),
    [normalizedQuery, services]
  );

  const totalDurationMinutes = selectedServices.reduce(
    (sum, service) => sum + service.durationMinutes,
    0
  );

  const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);

  const selectedCountLabel =
    selectedServices.length === 0
      ? "Select services"
      : `${selectedServices.length} service${selectedServices.length === 1 ? "" : "s"} selected`;

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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cs-text)]">Services</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--cs-text-muted)]">
            Search and select one or more services.
          </p>
        </div>

        {selectedServiceIds.length > 0 ? (
          <button
            type="button"
            onClick={clearServices}
            disabled={disabled}
            className="shrink-0 text-xs font-semibold text-[var(--cs-sand-dark)] transition hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        disabled={disabled}
        className={cn(
          "flex min-h-12 w-full min-w-0 items-center gap-2 rounded-2xl border bg-[var(--cs-surface)] px-3 py-2 text-left shadow-[var(--cs-shadow-xs)] transition",
          error
            ? "border-[var(--cs-error-text)]"
            : open
              ? "border-[var(--cs-sand-dark)]"
              : "border-[var(--cs-border)] hover:border-[var(--cs-border-strong)]",
          disabled ? "cursor-not-allowed opacity-70" : ""
        )}
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedServices.length > 0 ? (
            selectedServices.slice(0, 3).map((service) => (
              <span
                key={service.id}
                className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-[var(--cs-sand)] bg-[var(--cs-sand-mist)] px-2 py-1 text-xs font-semibold text-[var(--cs-text)]"
                onClick={(event) => event.stopPropagation()}
              >
                <span className="truncate">{service.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => removeService(service.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      removeService(service.id);
                    }
                  }}
                  className="grid size-4 place-items-center rounded-full hover:bg-[var(--cs-surface)]"
                  aria-label={`Remove ${service.name}`}
                >
                  <X size={12} />
                </span>
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--cs-text-muted)]">
              {isHomeService ? "Search home-service services" : "Search in-spa services"}
            </span>
          )}

          {selectedServices.length > 3 ? (
            <span className="rounded-full bg-[var(--cs-surface-warm)] px-2 py-1 text-xs font-semibold text-[var(--cs-text-muted)]">
              +{selectedServices.length - 3} more
            </span>
          ) : null}
        </div>

        <div className="hidden shrink-0 text-xs font-semibold text-[var(--cs-text-muted)] sm:block">
          {selectedCountLabel}
        </div>

        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-[var(--cs-text-muted)] transition",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--cs-text-secondary)]">
        <span>{selectedServices.length} service{selectedServices.length === 1 ? "" : "s"}</span>
        <span aria-hidden="true">·</span>
        <span>{formatServiceDuration(totalDurationMinutes)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatCurrency(totalPrice)}</span>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-xl">
          <div className="border-b border-[var(--cs-border-soft)] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={disabled}
                placeholder={isHomeService ? "Search home-service services..." : "Search in-spa services..."}
                className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-9 text-sm text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)]"
              />

              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cs-text-muted)]"
                  aria-label="Clear service search"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {filteredServices.length > 0 ? (
              filteredServices.map((service) => {
                const selected = selectedServiceIds.includes(service.id);
                const atLimit = !selected && selectedServiceIds.length >= maxServices;

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    disabled={disabled || atLimit}
                    className={cn(
                      "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      selected ? "bg-[var(--cs-sand-mist)]" : "hover:bg-[var(--cs-surface-warm)]",
                      atLimit ? "cursor-not-allowed opacity-50" : "",
                      disabled ? "cursor-not-allowed opacity-70" : ""
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded border",
                        selected
                          ? "border-[var(--cs-sand-dark)] bg-[var(--cs-sand)] text-[var(--cs-text)]"
                          : "border-[var(--cs-border-strong)] text-transparent"
                      )}
                      aria-hidden="true"
                    >
                      <Check size={13} />
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--cs-text)]">
                        {service.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--cs-text-muted)]">
                        {formatServiceDuration(service.durationMinutes)}
                      </span>
                    </span>

                    <span className="text-xs font-semibold text-[var(--cs-text-secondary)]">
                      {formatCurrency(service.price)}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--cs-border)] px-3 py-5 text-center text-xs text-[var(--cs-text-muted)]">
                No services match your search.
              </p>
            )}
          </div>

          {selectedServiceIds.length >= maxServices ? (
            <div className="border-t border-[var(--cs-border-soft)] px-3 py-2 text-xs font-medium text-[var(--cs-warning-text)]">
              Maximum {maxServices} services per booking.
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-medium text-[var(--cs-error-text)]">{error}</p> : null}
    </div>
  );
}
