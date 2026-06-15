"use client";

import { CalendarDays, ChevronRight, UserCheck, UserRound, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { PayrollDashboardSummary } from "@/lib/queries/payroll";
import { formatPayrollMoney, PayrollProgressBar } from "./payroll-ui";

export function PayrollSummaryGrid({
  summary,
  onChangePayday,
}: {
  summary: PayrollDashboardSummary;
  onChangePayday: () => void;
}) {
  return (
    <section
      aria-label="Payroll summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
    >
      <SummaryCard
        icon={<CalendarDays className="size-5" aria-hidden="true" />}
        tone="green"
        label="Next Payroll"
        value={summary.nextPayrollDateLabel}
        detail={summary.countdownLabel}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 mt-1 h-7 justify-start px-2 text-[var(--cs-warning-text)] hover:bg-[var(--cs-warning-bg)]"
            onClick={onChangePayday}
          >
            Change payday
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        }
      />

      <SummaryCard
        icon={<WalletCards className="size-5" aria-hidden="true" />}
        tone="green"
        label="Total Monthly Payroll"
        value={formatPayrollMoney(summary.totalMonthlyPayroll)}
        detail="Total amount needed for this month"
      />

      <SummaryCard
        icon={<UserCheck className="size-5" aria-hidden="true" />}
        tone="green"
        label="Paid Staff"
        value={String(summary.paidStaff)}
        detail="Paid this month"
      />

      <SummaryCard
        icon={<UserRound className="size-5" aria-hidden="true" />}
        tone="amber"
        label="Unpaid Staff"
        value={String(summary.unpaidStaff)}
        detail="Unpaid this month"
      />

      <article className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
            <span className="text-lg font-semibold">{summary.payrollProgress}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
              Payroll Status
            </p>
            <p className="mt-2 text-3xl font-semibold leading-none text-[var(--cs-success-text)]">
              {summary.payrollProgress}%
            </p>
            <p className="mt-2 text-sm text-[var(--cs-text)]">
              {summary.paidStaff} of {summary.totalIncludedStaff} paid
            </p>
          </div>
        </div>
        <PayrollProgressBar
          value={summary.payrollProgress}
          label="Payroll status"
          className="mt-4"
        />
      </article>
    </section>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
  detail,
  action,
}: {
  icon: ReactNode;
  tone: "green" | "amber";
  label: string;
  value: string;
  detail: string;
  action?: ReactNode;
}) {
  const iconClass =
    tone === "amber"
      ? "bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]"
      : "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]";
  const valueClass =
    tone === "amber" ? "text-[var(--cs-warning-text)]" : "text-[var(--cs-success-text)]";

  return (
    <article className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
            {label}
          </p>
          <p className={`mt-2 break-words text-2xl font-semibold leading-tight ${valueClass}`}>
            {value}
          </p>
          <p className="mt-2 text-sm text-[var(--cs-text)]">{detail}</p>
          {action}
        </div>
      </div>
    </article>
  );
}
