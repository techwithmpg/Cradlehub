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
};

export function TherapistDropdownPicker({
  options,
  value,
  open,
  onOpenChange,
  onValueChange,
}: TherapistDropdownPickerProps) {
  const selectedOption = getSelectedTherapistOption(options, value);
  const allOptions = [ANY_PROVIDER_OPTION, ...options];

  function handleSelect(option: TherapistPickerOption) {
    onValueChange(option.id ?? "auto");
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label="Choose a therapist"
        aria-expanded={open}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 px-4 py-3 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all hover:border-[#D4B57A]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4B57A]/35",
          open && "border-[#D4B57A]/75 ring-2 ring-[#D4B57A]/20"
        )}
      >
        <Avatar className="size-10 border border-[#D4B57A]/24 bg-[#05241D] shadow-sm">
          {selectedOption.avatarUrl ? (
            <AvatarImage src={selectedOption.avatarUrl} alt={selectedOption.displayName} />
          ) : null}
          <AvatarFallback className="bg-[radial-gradient(circle_at_35%_25%,#FAE6BE_0%,#C8A96B_36%,#163A2B_100%)] text-[12px] font-bold text-[#FCFAF5]">
            {selectedOption.isAnyProvider ? <Sparkles className="size-4" /> : selectedOption.initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[#F6EBD6]">
            {selectedOption.displayName}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[#F6EBD6]/64">
            {selectedOption.isAnyProvider
              ? "Recommended default"
              : getTherapistSubLabel(selectedOption)}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-[#D4B57A] transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] max-w-[36rem] rounded-2xl border border-[#D4B57A]/25 bg-[#05241D]/95 p-2 text-[#F6EBD6] shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:w-[var(--anchor-width)] sm:min-w-[28rem]"
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
