"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type {
  TherapistPickerOption,
  TherapistPickerValue,
} from "./therapist-picker-types";
import {
  getSelectedTherapistOption,
} from "./therapist-picker-utils";
import { AnyProviderOptionCard } from "./any-provider-option-card";
import { TherapistDropdownPicker } from "./therapist-dropdown-picker";
import { SelectedTherapistPreview } from "./selected-therapist-preview";

type TherapistSelectionStepProps = {
  options: TherapistPickerOption[];
  value: TherapistPickerValue;
  onValueChange: (value: TherapistPickerValue) => void;
  serviceCount: number;
  totalDuration: number;
  totalPriceLabel: string;
};

export function TherapistSelectionStep({
  options,
  value,
  onValueChange,
  serviceCount,
  totalDuration,
  totalPriceLabel,
}: TherapistSelectionStepProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedOption = getSelectedTherapistOption(options, value);
  const hasProviders = options.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2
          className="font-[family-name:var(--sp-font-display)] text-[26px] font-medium leading-tight text-[#163A2B] sm:text-[30px] md:text-[34px]"
        >
          Select therapist
        </h2>
        <p className="mt-1.5 text-[14px] leading-6 text-[#6B7A6F] sm:text-[15px]">
          Choose your preferred therapist or let us assign the best one.
        </p>
      </div>

      {serviceCount > 0 ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E3D7C5] bg-[#F9F5ED] px-4 py-3 md:hidden">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B4F2A]">
            {serviceCount} {serviceCount === 1 ? "service" : "services"} · {totalDuration} min
          </p>
          <p className="text-[14px] font-bold text-[#C8A96B]">{totalPriceLabel}</p>
        </div>
      ) : null}

      <AnyProviderOptionCard
        selected={value === "auto"}
        onSelect={() => onValueChange("auto")}
      />

      <div className="space-y-3">
        <div>
          <p className="text-[14px] font-semibold text-[#10261D] sm:text-[15px]">
            Choose a specific therapist, optional
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#6B7A6F]">
            Keep the default or choose from staff available for your selected time.
          </p>
        </div>

        <TherapistDropdownPicker
          options={options}
          value={value}
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          onValueChange={onValueChange}
        />

        {!hasProviders ? (
          <div className="rounded-xl border border-dashed border-[#EDE4D3] bg-[#FCFAF5] px-5 py-5 text-[14px] leading-7 text-[#6B7A6F]">
            No specific therapists are available for this time. You can continue with Any available provider and we&apos;ll assign the best available staff.
          </div>
        ) : null}
      </div>

      <SelectedTherapistPreview
        option={selectedOption.isAnyProvider ? null : selectedOption}
        onChange={() => setDropdownOpen(true)}
        onClear={() => onValueChange("auto")}
      />

      <div className="flex items-start gap-3 rounded-xl border border-[#EDE4D3] bg-white/70 px-4 py-3 text-[13px] leading-6 shadow-[0_8px_18px_rgba(16,38,29,0.04)]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F5E8D1] text-[#B68A3C]">
          <Info className="size-4" />
        </span>
        <span className="text-[#6B7A6F]">
          All our therapists are certified professionals. You can review more details after completing your booking.
        </span>
      </div>
    </div>
  );
}
