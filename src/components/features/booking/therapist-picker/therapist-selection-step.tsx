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
          className="font-[family-name:var(--sp-font-display)] text-[26px] font-medium leading-tight text-[#F6EBD6] sm:text-[30px] md:text-[34px]"
        >
          Select therapist
        </h2>
        <p className="mt-1.5 text-[14px] leading-6 text-[#F6EBD6]/72 sm:text-[15px]">
          Choose your preferred therapist or let us assign the best one.
        </p>
      </div>

      {serviceCount > 0 ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 px-4 py-3 backdrop-blur-xl md:hidden">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#D4B57A]">
            {serviceCount} {serviceCount === 1 ? "service" : "services"} · {totalDuration} min
          </p>
          <p className="text-[14px] font-bold text-[#D4B57A]">{totalPriceLabel}</p>
        </div>
      ) : null}

      <AnyProviderOptionCard
        selected={value === "auto"}
        onSelect={() => onValueChange("auto")}
      />

      <div className="space-y-3">
        <div>
          <p className="text-[14px] font-semibold text-[#F6EBD6] sm:text-[15px]">
            Choose a specific therapist, optional
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#F6EBD6]/68">
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
          <div className="rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50 px-5 py-5 text-[14px] leading-7 text-[#F6EBD6]/68">
            No specific therapists are available for this time. You can continue with Any available provider and we&apos;ll assign the best available staff.
          </div>
        ) : null}
      </div>

      <SelectedTherapistPreview
        option={selectedOption.isAnyProvider ? null : selectedOption}
        onChange={() => setDropdownOpen(true)}
        onClear={() => onValueChange("auto")}
      />

      <div className="flex items-start gap-3 rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/58 px-4 py-3 text-[13px] leading-6 shadow-[0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#D4B57A]/25 bg-[#031B16]/48 text-[#D4B57A]">
          <Info className="size-4" />
        </span>
        <span className="text-[#F6EBD6]/72">
          All our therapists are certified professionals. You can review more details after completing your booking.
        </span>
      </div>
    </div>
  );
}
