"use client";

import { BarChart3 } from "lucide-react";
import type { PayrollDashboardSummary } from "@/lib/queries/payroll";
import { PayrollProgressBar } from "./payroll-ui";

export function PaymentProgressCard({ summary }: { summary: PayrollDashboardSummary }) {
  return (
    <section className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cs-warning-bg)] text-[var(--cs-success-text)]">
          <BarChart3 className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-[var(--cs-text)]">
            Payment Progress
          </h2>
          <p className="mt-1 text-sm text-[var(--cs-text)]">
            {summary.paidStaff} of {summary.totalIncludedStaff} staff paid
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <PayrollProgressBar value={summary.payrollProgress} label="Payment progress" />
        <span className="w-10 text-right text-sm text-[var(--cs-text)]">
          {summary.payrollProgress}%
        </span>
      </div>
      {summary.unpaidStaff > 0 ? (
        <p className="mt-4 text-sm font-semibold text-[var(--cs-warning-text)]">
          {summary.unpaidStaff} staff remaining
        </p>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[var(--cs-success-text)]">
          All included staff are paid
        </p>
      )}
    </section>
  );
}
