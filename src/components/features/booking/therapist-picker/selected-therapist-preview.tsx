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
    <section className="eg-glass-card rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 border border-[#D4B57A]/45 bg-[#0A251A] shadow-xs">
          {option.avatarUrl ? (
            <AvatarImage src={option.avatarUrl} alt={option.displayName} />
          ) : null}
          <AvatarFallback className="bg-[#0A251A] text-sm font-bold text-[#E5C98B]">
            {option.initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[#FAF5E9]">
              {option.displayName}
            </h3>
            {option.isRecommended ? (
              <TherapistAvailabilityBadge tone="recommended">
                Recommended
              </TherapistAvailabilityBadge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[12px] text-[#9FB1A6]">
            {getTherapistSubLabel(option)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full border-[#D4B57A]/40 bg-[#0D2E20]/75 text-[#FAF5E9] hover:border-[#E5C98B] hover:bg-[#14402E]"
          onClick={onChange}
        >
          <RotateCcw className="size-3.5" />
          Change
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full text-[#CBD6CD] hover:bg-[#0E2F22] hover:text-[#FAF5E9]"
          onClick={onClear}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
    </section>
  );
}
