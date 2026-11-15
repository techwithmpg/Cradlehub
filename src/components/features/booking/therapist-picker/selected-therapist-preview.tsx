"use client";

import { RotateCcw, X } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { TherapistPickerOption } from "./therapist-picker-types";
import { getTherapistSubLabel } from "./therapist-picker-utils";
import { TherapistAvailabilityBadge } from "./therapist-availability-badge";

type SelectedTherapistPreviewProps = {
  option: TherapistPickerOption | null;
  onChange: () => void;
  onClear: () => void;
};

export function SelectedTherapistPreview({
  option,
  onChange,
  onClear,
}: SelectedTherapistPreviewProps) {
  if (!option || option.isAnyProvider) return null;

  return (
    <section className="rounded-2xl border border-[#E2D9C8] bg-white p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 border border-[#D4B57A]/45 bg-[#163A2B] shadow-xs">
          {option.avatarUrl ? (
            <AvatarImage src={option.avatarUrl} alt={option.displayName} />
          ) : null}
          <AvatarFallback className="bg-[#163A2B] text-sm font-bold text-[#E8D5A3]">
            {option.initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[#10261D]">
              {option.displayName}
            </h3>
            {option.isRecommended ? (
              <TherapistAvailabilityBadge tone="recommended">
                Recommended
              </TherapistAvailabilityBadge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[12px] text-[#55635B]">
            {getTherapistSubLabel(option)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full border-[#D7CEBC] bg-[#FCFAF5] text-[#10261D] hover:border-[#163A2B] hover:bg-[#F5EFE3]"
          onClick={onChange}
        >
          <RotateCcw className="size-3.5" />
          Change
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full text-[#55635B] hover:bg-[#EDE4D3] hover:text-[#10261D]"
          onClick={onClear}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
    </section>
  );
}
