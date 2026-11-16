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
  preferenceConfirmationRequired?: boolean;
};

export function TherapistSelectionStep({
  options,
  value,
  onValueChange,
  serviceCount,
  totalDuration,
  totalPriceLabel,
  preferenceConfirmationRequired = false,
}: TherapistSelectionStepProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedOption = getSelectedTherapistOption(options, value);
  const hasProviders = options.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2
          className="font-[family-name:var(--sp-font-display)] text-[26px] font-medium leading-tight text-[#FAF5E9] sm:text-[30px] md:text-[34px]"
        >
          Select therapist
        </h2>
        <p className="mt-1.5 text-[14px] leading-6 text-[#CBD6CD] sm:text-[15px]">
          Choose your preferred therapist or let us assign the best one.
        </p>
      </div>

      {serviceCount > 0 ? (
        <div className="eg-glass-card flex items-center justify-between gap-4 rounded-xl px-4 py-3 md:hidden">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#E5C98B]">
            {serviceCount} {serviceCount === 1 ? "service" : "services"} · {totalDuration} min
          </p>
          <p className="text-[14px] font-bold text-[#FAF5E9]">{totalPriceLabel}</p>
        </div>
      ) : null}

      <AnyProviderOptionCard
        selected={value === "auto"}
        onSelect={() => onValueChange("auto")}
      />

      <div className="space-y-3">
        <div>
          <p className="text-[14px] font-semibold text-[#FAF5E9] sm:text-[15px]">
            Choose a specific therapist, optional
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#9FB1A6]">
            {preferenceConfirmationRequired
              ? "Keep the default or choose a specific staff preference. Our team will confirm a manual preference after we receive your booking."
              : "Keep the default or choose from staff available for your selected time."}
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
          <div className="rounded-xl border border-dashed border-[#D4B57A]/28 bg-[#092118]/75 px-5 py-5 text-[14px] leading-7 text-[#CBD6CD]">
            No specific therapists are available for these services. You can continue with Any available provider and we&apos;ll assign the best available staff.
          </div>
        ) : null}
      </div>

      <SelectedTherapistPreview
        option={selectedOption.isAnyProvider ? null : selectedOption}
        onChange={() => setDropdownOpen(true)}
        onClear={() => onValueChange("auto")}
      />

      <div className="eg-glass-card flex items-start gap-3 rounded-xl px-4 py-3 text-[13px] leading-6">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#D4B57A]/35 bg-[#0A251A] text-[#E5C98B]">
          <Info className="size-4" />
        </span>
        <span className="text-[#CBD6CD]">
          All our therapists are certified professionals. You can review more details after completing your booking.
        </span>
      </div>
    </div>
  );
}
