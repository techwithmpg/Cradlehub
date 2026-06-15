"use client";

import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PayrollPeriodRow } from "@/lib/queries/payroll";
import { formatPayrollMoney, outlinePayrollButtonClass } from "./payroll-ui";

export function PayrollHistoryDialog({
  open,
  onOpenChange,
  history,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: PayrollPeriodRow[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[85svh] max-w-3xl overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-0"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--cs-border-soft)] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="font-heading text-xl font-semibold text-[var(--cs-text)]">
                Payment History
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-[var(--cs-text-muted)]">
                Recent payroll periods and saved payment totals.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close payment history"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="max-h-[65svh] overflow-y-auto p-5">
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--cs-border-soft)] p-8 text-center">
              <p className="font-medium text-[var(--cs-text)]">No payroll history yet</p>
              <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                Paid payroll periods will appear here after staff payments are tracked.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((period) => (
                <article
                  key={period.id}
                  className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[var(--cs-text)]">
                        {formatDate(period.period_start)} to {formatDate(period.period_end)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                        {period.item_count} staff entries
                        {period.branch_name ? ` - ${period.branch_name}` : ""}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-[var(--cs-success-text)]">
                        {formatPayrollMoney(period.total_net_pay)}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-[var(--cs-success-bg)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--cs-success-text)]">
                        {period.status}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--cs-border-soft)] px-5 py-4 text-right">
          <Button
            type="button"
            variant="outline"
            className={outlinePayrollButtonClass}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
