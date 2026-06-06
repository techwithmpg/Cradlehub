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
    <section className="rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 border border-[#D4B57A]/24 bg-[#05241D] shadow-sm">
          {option.avatarUrl ? (
            <AvatarImage src={option.avatarUrl} alt={option.displayName} />
          ) : null}
          <AvatarFallback className="bg-[radial-gradient(circle_at_35%_25%,#FAE6BE_0%,#C8A96B_36%,#163A2B_100%)] text-sm font-bold text-[#FCFAF5]">
            {option.initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[#F6EBD6]">
              {option.displayName}
            </h3>
            {option.isRecommended ? (
              <TherapistAvailabilityBadge tone="recommended">
                Recommended
              </TherapistAvailabilityBadge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[12px] text-[#F6EBD6]/64">
            {getTherapistSubLabel(option)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full border-[#D4B57A]/30 bg-[#031B16]/42 text-[#F6EBD6] hover:border-[#D4B57A]/70 hover:bg-[#05241D]"
          onClick={onChange}
        >
          <RotateCcw className="size-3.5" />
          Change
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full text-[#F6EBD6]/68 hover:bg-[#05241D] hover:text-[#F6EBD6]"
          onClick={onClear}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
    </section>
  );
}
