"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdjustScheduleHeaderProps = {
  onRequestClose: () => void;
};

export function AdjustScheduleHeader({ onRequestClose }: AdjustScheduleHeaderProps) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e5ded2] bg-[#fbfaf7] px-5 py-4 sm:px-8">
      <div>
        <h2 className="text-lg font-bold text-[#181713] sm:text-xl">Adjust Schedule</h2>
        <p className="mt-1 text-xs text-[#5f5a50] sm:text-sm">
          Customize weekly schedule, apply overrides, and manage unavailable time.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full text-[#4f4a42] hover:bg-[#efe9dc]"
        onClick={onRequestClose}
        aria-label="Close Adjust Schedule"
      >
        <X className="size-4" />
      </Button>
    </header>
  );
}
