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
        "relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]/60 sm:p-5",
        selected
          ? "border-[#D4B57A]/80 bg-[#0D2B20]/78 shadow-[0_0_34px_rgba(212,181,122,0.18)] ring-1 ring-[#D4B57A]/45"
          : "border-[#D4B57A]/25 bg-[#0D2B20]/58 hover:border-[#D4B57A]/55 hover:bg-[#0D2B20]/72"
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_25%,#2D674E_0%,#163A2B_68%,#10261D_100%)] text-[#C8A96B] shadow-[0_6px_16px_rgba(16,38,29,0.22)] sm:size-14">
        <Sparkles className="size-5 sm:size-6" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold leading-5 text-[#F6EBD6]">
            Any available provider
          </span>
          <TherapistAvailabilityBadge tone="recommended">
            Recommended
          </TherapistAvailabilityBadge>
        </span>
        <span className="mt-1.5 block text-[12px] leading-5 text-[#F6EBD6]/72 sm:text-[13px]">
          We&apos;ll assign the best qualified available staff based on service and schedule.
        </span>
      </span>

      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
          selected ? "bg-[#D4B57A]" : "border border-[#D4B57A]/30 bg-[#031B16]/35"
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="size-4 text-[#031B16]" /> : null}
      </span>
    </button>
  );
}
