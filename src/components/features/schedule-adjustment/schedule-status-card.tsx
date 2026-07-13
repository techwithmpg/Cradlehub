"use client";

import { AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScheduleStatusCardProps = {
  statusLabel: string;
  validationLabel: string;
  hasErrors: boolean;
  lastUpdatedLabel: string | null;
  dirty: boolean;
  onClearUnsavedChanges: () => void;
};

export function ScheduleStatusCard({
  statusLabel,
  validationLabel,
  hasErrors,
  lastUpdatedLabel,
  dirty,
  onClearUnsavedChanges,
}: ScheduleStatusCardProps) {
  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-[#181713]">Schedule Status</p>
      <p className="mt-3 text-sm font-bold text-[#0b57d0]">{statusLabel}</p>
      <p className="mt-2 text-[0.7rem] text-[#615c52]">
        {lastUpdatedLabel ? `Last updated: ${lastUpdatedLabel}` : "No update timestamp available"}
      </p>
      <div
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.7rem] font-semibold",
          hasErrors ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
        )}
      >
        {hasErrors ? <AlertCircle className="size-3" /> : <CheckCircle2 className="size-3" />}
        {validationLabel}
      </div>
      {dirty ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-4 w-full justify-center border-[#d9d1c2] bg-white text-[#3b352b]"
          onClick={onClearUnsavedChanges}
        >
          <RotateCcw className="size-3.5" />
          Clear Unsaved Changes
        </Button>
      ) : null}
    </section>
  );
}
