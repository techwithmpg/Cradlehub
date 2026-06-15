"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/payroll/fixed-monthly";
import type { PayrollDashboardStaffRow } from "@/lib/queries/payroll";

export const primaryPayrollButtonClass =
  "bg-[var(--cs-success-text)] text-[var(--cs-text-inverse)] shadow-sm hover:bg-[var(--cs-success-text)]/90";

export const outlinePayrollButtonClass =
  "border-[var(--cs-border-soft)] bg-[var(--cs-surface)] text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]";

export const inputClass =
  "h-10 w-full rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/20 disabled:cursor-not-allowed disabled:bg-[var(--cs-surface-muted)] disabled:text-[var(--cs-text-subtle)]";

export const selectClass = cn(inputClass, "appearance-auto pr-8");

export const fieldLabelClass =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]";

export function formatPayrollMoney(amount: number): string {
  return formatPeso(amount);
}

export function StaffPayrollAvatar({ staff }: { staff: PayrollDashboardStaffRow }) {
  return (
    <Avatar size="lg" className="bg-[var(--cs-success-bg)]">
      {staff.avatar_url ? <AvatarImage src={staff.avatar_url} alt="" /> : null}
      <AvatarFallback className="bg-[var(--cs-success-bg)] font-semibold text-[var(--cs-success-text)]">
        {getInitials(staff.display_name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function PayrollStatusBadge({ status }: { status: PayrollDashboardStaffRow["status"] }) {
  if (status === "paid") {
    return (
      <Badge className="border-[var(--cs-success)]/20 bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
        Paid
      </Badge>
    );
  }

  if (status === "missing_salary") {
    return (
      <Badge className="border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)]">
        Set Pay
      </Badge>
    );
  }

  return (
    <Badge className="border-[var(--cs-warning)]/20 bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]">
      Unpaid
    </Badge>
  );
}

export function PayrollProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--cs-border-soft)]", className)}
    >
      <div
        className="h-full rounded-full bg-[var(--cs-success-text)] transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}
