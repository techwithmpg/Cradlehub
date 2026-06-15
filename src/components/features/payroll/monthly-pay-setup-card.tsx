"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveMonthlyPayAction } from "@/lib/actions/payroll-dashboard-actions";
import type { PayrollDashboardStaffRow } from "@/lib/queries/payroll";
import {
  fieldLabelClass,
  formatPayrollMoney,
  inputClass,
  primaryPayrollButtonClass,
  selectClass,
} from "./payroll-ui";

export function MonthlyPaySetupCard({
  staffRows,
  initialStaffId,
  onSaved,
  framed = true,
}: {
  staffRows: PayrollDashboardStaffRow[];
  initialStaffId?: string | null;
  onSaved?: () => void;
  framed?: boolean;
}) {
  const router = useRouter();
  const staffOptions = useMemo(
    () => [...staffRows].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [staffRows]
  );
  const initialStaff = staffOptions.find((staff) => staff.id === initialStaffId) ?? null;
  const [selectedStaffId, setSelectedStaffId] = useState(initialStaffId ?? "");
  const [amount, setAmount] = useState(
    initialStaff?.has_monthly_pay ? String(initialStaff.monthly_pay) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedStaff = staffOptions.find((staff) => staff.id === selectedStaffId) ?? null;

  function handleStaffChange(nextStaffId: string) {
    const nextStaff = staffOptions.find((staff) => staff.id === nextStaffId) ?? null;
    setSelectedStaffId(nextStaffId);
    setAmount(nextStaff?.has_monthly_pay ? String(nextStaff.monthly_pay) : "");
    setError(null);
    setMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await saveMonthlyPayAction({
        staffId: selectedStaffId,
        amount: Number(amount),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Monthly pay saved.");
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <section
      className={
        framed
          ? "rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm"
          : "bg-[var(--cs-surface)]"
      }
      aria-labelledby="monthly-pay-setup-heading"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
          <UserRound className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="monthly-pay-setup-heading" className="font-heading text-lg font-semibold text-[var(--cs-text)]">
            Monthly Pay Setup
          </h2>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
            Set or update monthly pay for staff members.
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="monthly-pay-staff" className={fieldLabelClass}>
            Staff member
          </label>
          <select
            id="monthly-pay-staff"
            className={selectClass}
            value={selectedStaffId}
            onChange={(event) => handleStaffChange(event.target.value)}
          >
            <option value="">Select staff member</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="monthly-pay-amount" className={fieldLabelClass}>
            Monthly amount (PHP)
          </label>
          <input
            id="monthly-pay-amount"
            className={inputClass}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Enter amount"
          />
          {selectedStaff?.has_monthly_pay ? (
            <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
              Current monthly pay: {formatPayrollMoney(selectedStaff.monthly_pay)}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-lg bg-[var(--cs-error-bg)] px-3 py-2 text-sm text-[var(--cs-error-text)]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-lg bg-[var(--cs-success-bg)] px-3 py-2 text-sm text-[var(--cs-success-text)]">
            {message}
          </p>
        ) : null}

        <Button
          type="submit"
          className={`w-full ${primaryPayrollButtonClass}`}
          disabled={pending}
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? "Saving..." : "Save"}
        </Button>
      </form>
    </section>
  );
}
