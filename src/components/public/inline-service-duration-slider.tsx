"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";

type Props = {
  branchId: string;
  serviceId: string;
  serviceName: string;
  baseQuoteVersion?: string;
  selectedQuote?: ServiceLineQuote;
  currentDurationMinutes: number;
  deliveryMode: "in_spa" | "home_service";
  onSelectQuote: (quote: ServiceLineQuote) => void;
};

const money = (price: number) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", maximumFractionDigits: 0,
}).format(price);

/** An index slider: each stop is a complete quote returned by the server. */
export function InlineServiceDurationSlider(props: Props) {
  const [options, setOptions] = useState<ServiceLineQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/booking/service-line-quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: props.branchId, serviceId: props.serviceId,
        audience: "public", deliveryMode: props.deliveryMode }),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Duration options are temporarily unavailable.");
      const payload = await response.json() as { options?: ServiceLineQuote[] };
      const quotes = payload.options;
      if (!Array.isArray(quotes) || quotes.length < 2 ||
          quotes.some((quote, index) =>
            quote.serviceId !== props.serviceId || !quote.quoteVersion ||
            !Number.isSafeInteger(quote.selectedDurationMinutes) ||
            !Number.isFinite(quote.calculatedPrice) || quote.calculatedPrice < 0 ||
            (index > 0 && quote.selectedDurationMinutes <= quotes[index - 1]!.selectedDurationMinutes))) {
        throw new Error("Duration options are temporarily unavailable.");
      }
      if (!controller.signal.aborted) setOptions(quotes);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Duration options are temporarily unavailable. Please try again or choose another service.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [props.branchId, props.serviceId, props.deliveryMode]);

  const selectedIndex = options.findIndex((quote) => quote.selectedDurationMinutes === props.currentDurationMinutes);
  const currentIndex = selectedIndex < 0 ? 0 : selectedIndex;
  const currentOption = options[currentIndex];
  const displayedVersion = props.selectedQuote?.quoteVersion ?? props.baseQuoteVersion;
  const quoteChanged = !loading && !error && currentOption &&
    (selectedIndex < 0 || (displayedVersion && displayedVersion !== currentOption.quoteVersion));

  const selectIndex = (index: number) => {
    const quote = options[index];
    if (quote && (index !== currentIndex || quoteChanged)) props.onSelectQuote(quote);
  };

  return (
    <div className="mt-2 border-t border-[#D4B57A]/20 pt-2.5 md:mt-4 md:pt-4">
      <div className="hidden md:flex md:items-center md:gap-3">
        <Clock3 className="h-5 w-5 shrink-0 text-[#D4B57A]" aria-hidden="true" />
        <div className="min-w-[130px]">
          <p className="text-[13px] font-medium text-[#F6EBD6]">Adjust duration</p>
          <p className="text-[11px] text-[#F6EBD6]/60">Slide for more time</p>
        </div>
      </div>
      {error ? <p role="alert" className="mt-1 text-xs text-[#F6C3AA]">{error}</p> : null}
      {quoteChanged ? <p role="alert" className="mt-1 text-xs text-[#F6C3AA]">Duration or price changed. Review and select a current option.</p> : null}
      <div className={`relative ${loading || error ? "opacity-50" : ""}`} aria-busy={loading}>
        <div className="relative mx-1 min-h-11 focus-within:rounded-lg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D4B57A]">
          <div className="pointer-events-none absolute inset-x-3 top-[21px] h-[2px] bg-[#D4B57A]/35" />
          <div className="pointer-events-none absolute left-3 top-[21px] h-[2px] bg-[#D4B57A]" style={{
            width: options.length > 1 ? `calc((100% - 24px) * ${currentIndex / (options.length - 1)})` : "0px",
          }} />
          <div className="pointer-events-none absolute inset-x-0 top-[13px] flex justify-between px-[3px]">
            {(options.length > 0 ? options.map((quote) => quote.selectedDurationMinutes) : [0, 1, 2, 3, 4]).map((duration, index) => (
              <span key={duration} aria-hidden="true"
                className={`size-[18px] rounded-full border-2 ${index === currentIndex && !loading
                  ? "border-[#D4B57A] bg-[#D4B57A] shadow-[0_0_0_4px_rgba(212,181,122,0.18)]"
                  : "border-[#D4B57A]/55 bg-[#092C23]"}`} />
            ))}
          </div>
          <input type="range" min={0} max={Math.max(0, options.length - 1)} step={1}
            value={currentIndex} disabled={loading || Boolean(error) || options.length < 2}
            aria-label={`${props.serviceName} duration`}
            aria-valuetext={currentOption ? `${currentOption.selectedDurationMinutes} minutes, ${money(currentOption.calculatedPrice)}` : "Loading duration options"}
            onChange={(event) => selectIndex(Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Home") { event.preventDefault(); selectIndex(0); }
              if (event.key === "End") { event.preventDefault(); selectIndex(options.length - 1); }
              if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); selectIndex(Math.max(0, currentIndex - 1)); }
              if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); selectIndex(Math.min(options.length - 1, currentIndex + 1)); }
            }}
            className="absolute inset-0 h-11 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
        </div>
        {options.length > 0 ? <div className="hidden md:flex md:justify-between md:gap-1">
          {options.map((quote) => <div key={quote.selectedDurationMinutes} className="min-w-0 text-center text-[11px] text-[#F6EBD6]/72">
            <p className={quote.selectedDurationMinutes === props.currentDurationMinutes ? "font-semibold text-[#D4B57A]" : ""}>{quote.selectedDurationMinutes} min</p>
            <p className={quote.selectedDurationMinutes === props.currentDurationMinutes ? "font-semibold text-[#D4B57A]" : ""}>{money(quote.calculatedPrice)}</p>
          </div>)}
        </div> : null}
      </div>
    </div>
  );
}
