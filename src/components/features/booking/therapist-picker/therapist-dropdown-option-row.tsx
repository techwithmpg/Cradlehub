"use client";

import { Check, Sparkles } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TherapistPickerOption } from "./therapist-picker-types";
import { getTherapistSubLabel } from "./therapist-picker-utils";
import { TherapistAvailabilityBadge } from "./therapist-availability-badge";

type TherapistDropdownOptionRowProps = {
  option: TherapistPickerOption;
  selected: boolean;
  onSelect: () => void;
};

export function TherapistDropdownOptionRow({
  option,
  selected,
  onSelect,
}: TherapistDropdownOptionRowProps) {
  const subLabel = option.isAnyProvider
    ? "We'll assign the best available staff for you."
    : getTherapistSubLabel(option);

  return (
    <button
      type="button"
      disabled={!option.isAvailable}
      onClick={onSelect}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]/50",
        selected
          ? "bg-[#D4B57A]/14 text-[#F6EBD6]"
          : "text-[#F6EBD6] hover:bg-[#0D2B20]/80",
        !option.isAvailable && "cursor-not-allowed opacity-50"
      )}
      aria-pressed={selected}
    >
      <Avatar className="size-10 border border-[#D4B57A]/22 bg-[#05241D] shadow-sm">
        {option.avatarUrl ? (
          <AvatarImage src={option.avatarUrl} alt={option.displayName} />
        ) : null}
        <AvatarFallback className="bg-[radial-gradient(circle_at_35%_25%,#FAE6BE_0%,#C8A96B_36%,#163A2B_100%)] text-[12px] font-bold text-[#FCFAF5]">
          {option.isAnyProvider ? <Sparkles className="size-4" /> : option.initials}
        </AvatarFallback>
      </Avatar>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-semibold">{option.displayName}</span>
          {option.isRecommended ? (
            <TherapistAvailabilityBadge tone="recommended">
              Recommended
            </TherapistAvailabilityBadge>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-5 text-[#F6EBD6]/64">
          {subLabel}
        </span>
      </span>

      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-[#D4B57A] bg-[#D4B57A]" : "border-[#D4B57A]/30 bg-[#031B16]/35"
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="size-3.5 text-[#031B16]" /> : null}
      </span>
    </button>
  );
}
