"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  TherapistPickerOption,
  TherapistPickerValue,
} from "./therapist-picker-types";
import {
  ANY_PROVIDER_OPTION,
  getSelectedTherapistOption,
  getTherapistSubLabel,
} from "./therapist-picker-utils";
import { TherapistDropdownOptionRow } from "./therapist-dropdown-option-row";

type TherapistDropdownPickerProps = {
  options: TherapistPickerOption[];
  value: TherapistPickerValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: TherapistPickerValue) => void;
  compact?: boolean;
};

export function TherapistDropdownPicker({
  options,
  value,
  open,
  onOpenChange,
  onValueChange,
  compact = false,
}: TherapistDropdownPickerProps) {
  const selectedOption = getSelectedTherapistOption(options, value);
  const selectedLabel =
    compact && selectedOption.isAnyProvider
      ? "Any available therapist"
      : selectedOption.displayName;
  const allOptions = [ANY_PROVIDER_OPTION, ...options];

  function handleSelect(option: TherapistPickerOption) {
    onValueChange(option.id ?? "auto");
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label={
          compact ? `Choose a therapist: ${selectedLabel}` : "Choose a therapist"
        }
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 border border-[#DDD4C2] bg-white text-left transition-all hover:border-[#C8A96B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]",
          compact
            ? "min-h-12 rounded-xl px-3 py-2"
            : "min-h-16 rounded-2xl px-4 py-3 shadow-xs",
          open && "border-[#163A2B] ring-2 ring-[#163A2B]/15",
        )}
      >
        <Avatar
          className={cn(
            "border border-[#D4B57A]/40 bg-[#163A2B] shadow-xs",
            compact ? "size-7" : "size-10",
          )}
        >
          {selectedOption.avatarUrl ? (
            <AvatarImage
              src={selectedOption.avatarUrl}
              alt={selectedOption.displayName}
            />
          ) : null}
          <AvatarFallback className="bg-[#163A2B] text-[12px] font-bold text-[#E8D5A3]">
            {selectedOption.isAnyProvider ? (
              <Sparkles className="size-4" />
            ) : (
              selectedOption.initials
            )}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[#10261D]">
            {selectedLabel}
          </span>
          <span
            className={cn(
              "truncate text-[12px] text-[#55635B]",
              compact ? "hidden" : "mt-0.5 block",
            )}
          >
            {selectedOption.isAnyProvider
              ? "Recommended default"
              : getTherapistSubLabel(selectedOption)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[#8A6D3B] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] max-w-[36rem] rounded-2xl border border-[#DDD4C2] bg-white p-2 text-[#10261D] shadow-xl sm:w-[var(--anchor-width)] sm:min-w-[28rem]"
      >
        <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
          {allOptions.map((option) => (
            <TherapistDropdownOptionRow
              key={option.id ?? "auto"}
              option={option}
              selected={option.id === selectedOption.id}
              onSelect={() => handleSelect(option)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
