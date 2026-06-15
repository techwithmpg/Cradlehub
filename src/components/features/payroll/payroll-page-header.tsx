"use client";

import { FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { outlinePayrollButtonClass, primaryPayrollButtonClass } from "./payroll-ui";

export function PayrollPageHeader({
  onOpenSettings,
  onOpenHistory,
}: {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="font-heading text-3xl font-semibold leading-tight text-[var(--cs-text)]">
          Payroll
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--cs-text-muted)] sm:text-base">
          Set monthly staff pay, track who has been paid, and prepare for the next payroll.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          className={primaryPayrollButtonClass}
          onClick={onOpenSettings}
        >
          <Settings className="size-4" aria-hidden="true" />
          Payroll Settings
        </Button>
        <Button
          type="button"
          variant="outline"
          className={outlinePayrollButtonClass}
          onClick={onOpenHistory}
        >
          <FileText className="size-4" aria-hidden="true" />
          Payment History
        </Button>
      </div>
    </div>
  );
}
