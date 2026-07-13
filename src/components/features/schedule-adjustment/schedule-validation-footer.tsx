"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduleValidationIssue } from "./adjust-schedule-types";

type ScheduleValidationFooterProps = {
  issues: ScheduleValidationIssue[];
  dirty: boolean;
  saving: boolean;
  modeAllowsPrimarySave: boolean;
  impactAcknowledged: boolean;
  onImpactAcknowledgedChange: (checked: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function ScheduleValidationFooter({
  issues,
  dirty,
  saving,
  modeAllowsPrimarySave,
  impactAcknowledged,
  onImpactAcknowledgedChange,
  onCancel,
  onSave,
}: ScheduleValidationFooterProps) {
  const firstError = issues.find((issue) => issue.level === "error");
  const blocking = Boolean(firstError);
  const canSave = modeAllowsPrimarySave && dirty && !blocking && impactAcknowledged && !saving;
  const message = firstError?.message ?? (dirty ? "Review impacts before saving this schedule." : "No conflicts detected. Schedule is valid.");

  return (
    <footer className="flex shrink-0 flex-col gap-3 border-t border-[#e5ded2] bg-[#fbfaf7] px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[#bfdbc8] bg-[#eef7f1]">
            {blocking ? <AlertCircle className="size-4 text-red-700" /> : <CheckCircle2 className="size-4 text-[#0f6b43]" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-[#181713]">Validation</p>
            <p aria-live="polite" className="mt-1 text-xs text-[#615c52]">{message}</p>
            {modeAllowsPrimarySave && dirty && !blocking ? (
              <label className="mt-2 flex items-start gap-2 text-xs text-[#4f4a42]">
                <input
                  type="checkbox"
                  checked={impactAcknowledged}
                  onChange={(event) => onImpactAcknowledgedChange(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-[#cfc6b7]"
                />
                I reviewed booking, attendance, and dispatch impact for this adjustment.
              </label>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="min-w-24 border-[#d9d1c2] bg-white" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className="min-w-36 bg-[#07552f] text-white hover:bg-[#064525]"
          disabled={!canSave}
          onClick={onSave}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save Adjustment
        </Button>
      </div>
    </footer>
  );
}
