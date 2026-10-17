"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatCurrency } from "@/lib/utils";
import { formatServiceDuration } from "@/components/features/bookings/quick-booking-service-selector";
import type { QuickBookingServiceOption } from "@/components/features/bookings/quick-booking-form";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";

export type InlineServiceDurationDropdownProps = {
  branchId: string;
  service: QuickBookingServiceOption;
  deliveryMode: "in_spa" | "home_service";
  disabled?: boolean;
  onSelectQuote: (quote: ServiceLineQuote) => void;
};

export function InlineServiceDurationDropdown({
  branchId,
  service,
  deliveryMode,
  disabled = false,
  onSelectQuote,
}: InlineServiceDurationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ServiceLineQuote[]>([]);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  const fetchOptions = async () => {
    if (!branchId || !service.id) return;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/booking/service-line-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          serviceId: service.id,
          audience: "crm",
          deliveryMode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Service duration options could not be loaded.");
      }

      const result = (await response.json()) as { options: ServiceLineQuote[] };
      if (controller.signal.aborted) return;
      if (
        !Array.isArray(result.options) ||
        result.options.length === 0 ||
        result.options.some(
          (opt, i) =>
            i > 0 &&
            (opt.selectedDurationMinutes <= result.options[i - 1]!.selectedDurationMinutes ||
              opt.calculatedPrice <= result.options[i - 1]!.calculatedPrice)
        )
      ) {
        throw new Error("Duration options are unavailable.");
      }

      setOptions(result.options);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Duration options are unavailable.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) return;
    setOpen(nextOpen);
    if (nextOpen) {
      // Fetch fresh server-authorized options on every opening.
      setOptions([]);
      void fetchOptions();
    } else {
      activeRequestRef.current?.abort();
      setLoading(false);
    }
  };

  const handleSelect = (quote: ServiceLineQuote) => {
    onSelectQuote(quote);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 text-xs font-semibold text-[var(--cs-text)] transition hover:border-[#7A583E] hover:bg-[#F7F4F0] disabled:opacity-60",
          open && "border-[#7A583E] bg-[#F7F4F0] ring-1 ring-[#7A583E]/40"
        )}
        title="Adjust duration"
        aria-label={`Duration for ${service.name}: ${formatServiceDuration(service.durationMinutes)}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{formatServiceDuration(service.durationMinutes)}</span>
        <ChevronDown
          size={12}
          className={cn("text-[var(--cs-text-muted)] transition-transform", open && "rotate-180")}
        />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={4}
        className="z-50 min-w-[210px] max-w-[260px] rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-1.5 shadow-xl"
      >
        <div className="px-2 py-1 border-b border-[var(--cs-border-soft)] mb-1">
          <p className="text-[11px] font-semibold text-[var(--cs-text-muted)] truncate">
            {service.name}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-[var(--cs-text-muted)]">
            <Loader2 size={13} className="animate-spin text-[var(--cs-sand-dark)]" />
            <span>Loading durations…</span>
          </div>
        ) : error ? (
          <div className="p-2 text-xs">
            <p className="text-[var(--cs-error-text)]">{error}</p>
            <button
              type="button"
              onClick={fetchOptions}
              className="mt-1.5 inline-block text-xs font-semibold text-[var(--cs-sand-dark)] underline hover:text-[var(--cs-text)]"
            >
              Retry
            </button>
          </div>
        ) : (
          <div role="listbox" aria-label="Available durations" className="space-y-0.5">
            {options.map((option) => {
              const isSelected = option.selectedDurationMinutes === service.durationMinutes;
              return (
                <button
                  key={option.selectedDurationMinutes}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs transition text-left cursor-pointer",
                    isSelected
                      ? "bg-[#F7F4F0] text-[#7A583E] font-bold"
                      : "text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {isSelected ? (
                      <Check size={12} className="text-[#7A583E]" />
                    ) : (
                      <span className="w-3" />
                    )}
                    <span>{formatServiceDuration(option.selectedDurationMinutes)}</span>
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      isSelected ? "text-[#7A583E]" : "text-[var(--cs-text-secondary)]"
                    )}
                  >
                    {formatCurrency(option.calculatedPrice)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
