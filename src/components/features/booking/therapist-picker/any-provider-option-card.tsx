"use client";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TherapistAvailabilityBadge } from "./therapist-availability-badge";

type AnyProviderOptionCardProps = {
  selected: boolean;
  onSelect: () => void;
};

export function AnyProviderOptionCard({
  selected,
  onSelect,
}: AnyProviderOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4B57A] sm:p-5",
        selected
          ? "border-[#D4B57A] bg-[linear-gradient(160deg,rgba(20,64,46,0.92)_0%,rgba(11,38,28,0.92)_100%)] ring-1 ring-[#D4B57A]/45 shadow-[0_14px_34px_-16px_rgba(212,181,122,0.38)]"
          : "border-[#D4B57A]/22 bg-[#0A2219]/78 backdrop-blur-md hover:border-[#D4B57A]/55 hover:bg-[#0E2E22]/88",
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/35 bg-[#0A251A] text-[#E5C98B] shadow-xs sm:size-14">
        <Sparkles className="size-5 sm:size-6" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold leading-5 text-[#FAF5E9]">
            Any available provider
          </span>
          <TherapistAvailabilityBadge tone="recommended">
            Recommended
          </TherapistAvailabilityBadge>
        </span>
        <span className="mt-1.5 block text-[12px] leading-5 text-[#CBD6CD] sm:text-[13px]">
          We&apos;ll assign the best qualified available staff based on service and schedule.
        </span>
      </span>

      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
          selected
            ? "bg-[#D4B57A]"
            : "border border-[#D4B57A]/40 bg-[#092118]",
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="size-4 text-[#071A12]" /> : null}
      </span>
    </button>
  );
}
