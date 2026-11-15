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
        "relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B] sm:p-5",
        selected
          ? "border-[#163A2B] bg-[#F5EFE3] shadow-sm ring-1 ring-[#163A2B]/25"
          : "border-[#E5DEC9] bg-white hover:border-[#C8A96B] hover:bg-[#FCFAF5]",
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#163A2B] text-[#E8D5A3] shadow-xs sm:size-14">
        <Sparkles className="size-5 sm:size-6" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold leading-5 text-[#10261D]">
            Any available provider
          </span>
          <TherapistAvailabilityBadge tone="recommended">
            Recommended
          </TherapistAvailabilityBadge>
        </span>
        <span className="mt-1.5 block text-[12px] leading-5 text-[#55635B] sm:text-[13px]">
          We&apos;ll assign the best qualified available staff based on service and schedule.
        </span>
      </span>

      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
          selected
            ? "bg-[#163A2B]"
            : "border border-[#D7CEBC] bg-[#FCFAF5]",
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="size-4 text-[#FAF5E9]" /> : null}
      </span>
    </button>
  );
}
