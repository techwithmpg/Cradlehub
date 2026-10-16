"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  serviceId: string;
  serviceName: string;
  currentDurationMinutes: number;
  audience: "public" | "crm";
  deliveryMode: "in_spa" | "home_service";
  onApply: (quote: ServiceLineQuote) => void;
};

/** Discrete, server-generated prices. Draft state is discarded unless Apply is pressed. */
export function ServiceDurationSelector(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? (
        <ServiceDurationSelectorContent
          key={`${props.branchId}:${props.serviceId}:${props.currentDurationMinutes}`}
          {...props}
        />
      ) : null}
    </Dialog>
  );
}

function ServiceDurationSelectorContent(props: Props) {
  const [options, setOptions] = useState<ServiceLineQuote[]>([]);
  const [draftDuration, setDraftDuration] = useState(props.currentDurationMinutes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/booking/service-line-quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: props.branchId,
        serviceId: props.serviceId,
        audience: props.audience,
        deliveryMode: props.deliveryMode,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Service duration configuration needs review.");
        const result = (await response.json()) as { options: ServiceLineQuote[] };
        if (!Array.isArray(result.options) || result.options.length === 0 ||
            result.options.some((opt, i) => i > 0 && (
              opt.selectedDurationMinutes <= result.options[i - 1]!.selectedDurationMinutes ||
              opt.calculatedPrice <= result.options[i - 1]!.calculatedPrice
            ))) {
          throw new Error("Duration options are unavailable.");
        }
        setOptions(result.options);
        if (!result.options.some((option) => option.selectedDurationMinutes === props.currentDurationMinutes)) {
          setDraftDuration(result.options[0]!.selectedDurationMinutes);
          setError("The service options changed. Review the current price before applying.");
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Duration options are unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [props.branchId, props.serviceId, props.currentDurationMinutes, props.audience, props.deliveryMode]);

  const selected = options.find((option) => option.selectedDurationMinutes === draftDuration);
  const base = options[0];
  return (
    <DialogContent className={props.audience === "public"
      ? "max-h-[min(90vh,680px)] w-[min(95vw,560px)] overflow-y-auto rounded-2xl p-5 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      : "max-h-[min(80vh,560px)] w-[min(95vw,460px)] overflow-y-auto rounded-2xl p-5 sm:max-w-[460px]"}>
      {props.audience === "public" ? <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-[var(--cs-border-strong)] sm:hidden" /> : null}
      <div className="pr-7">
        <DialogTitle className="text-lg font-semibold">{props.serviceName}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[var(--cs-text-muted)]">
          Choose a treatment duration. Your booking changes only after Apply duration.
        </DialogDescription>
      </div>
      {loading ? <p role="status" className="py-5 text-sm text-[var(--cs-text-muted)]">Loading duration options…</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-[var(--cs-warning-bg)] p-3 text-sm text-[var(--cs-warning-text)]">{error}</p> : null}
      {options.length > 0 ? (
        <>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Select your duration</legend>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {options.map((option) => (
                <label key={option.selectedDurationMinutes} className="min-w-[76px] flex-1 cursor-pointer">
                  <input type="radio" name="service-duration" value={option.selectedDurationMinutes}
                    checked={draftDuration === option.selectedDurationMinutes}
                    onChange={() => setDraftDuration(option.selectedDurationMinutes)}
                    className="peer sr-only" />
                  <span className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-[var(--cs-border)] px-2 text-center text-xs font-semibold transition peer-checked:border-[var(--cs-sand-dark)] peer-checked:bg-[var(--cs-sand-mist)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--cs-sand-dark)]">
                    <span>{option.selectedDurationMinutes} min</span>
                    <span className="mt-1">{formatCurrency(option.calculatedPrice)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {selected && base ? <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-center">
            <p className="font-semibold">{selected.selectedDurationMinutes} minutes · {formatCurrency(selected.calculatedPrice)}</p>
            <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
              +{selected.selectedDurationMinutes - base.baseDurationMinutes} minutes from base
              {selected.extensionUnits > 0 ? ` · +${formatCurrency(selected.extensionPrice ?? 0)} per ${selected.extensionIncrementMinutes} min` : ""}
            </p>
          </div> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => props.onOpenChange(false)}
              className="min-h-11 rounded-xl border border-[var(--cs-border)] px-4 text-sm">Cancel</button>
            <button type="button" disabled={!selected} onClick={() => {
              if (selected) { props.onApply(selected); props.onOpenChange(false); }
            }} className="min-h-11 rounded-xl bg-[var(--cs-sand)] px-5 text-sm font-semibold text-[var(--cs-text)] disabled:opacity-50">
              Apply duration
            </button>
          </div>
        </>
      ) : null}
    </DialogContent>
  );
}
