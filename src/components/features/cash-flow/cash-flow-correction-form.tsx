"use client";

import { useMemo, useState } from "react";
import {
  Undo2,
  Clock,
  SlidersHorizontal,
  CreditCard,
  Plus,
  Target,
  Calendar,
  FileText,
  TrendingUp,
  History,
  Info,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CashFlowEntry } from "@/lib/cash-flow/read-model";
import { cn } from "@/lib/utils";
import { CashFlowTransactionSummary } from "./cash-flow-transaction-summary";
import { CashFlowCorrectionPreview } from "./cash-flow-correction-preview";
import { compactFieldClass, peso } from "./cash-flow-ui";

export type CorrectionAction =
  | "reverse"
  | "correct_amount"
  | "correct_category"
  | "correct_method"
  | "add_adjustment";

interface CorrectionActionOption {
  action: CorrectionAction;
  title: string;
  helper: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const CORRECTION_ACTIONS: CorrectionActionOption[] = [
  {
    action: "reverse",
    title: "Reverse transaction",
    helper: "Create opposite entry",
    icon: <Undo2 className="size-4" />,
    iconBg: "bg-rose-50 border-rose-100",
    iconColor: "text-rose-600",
  },
  {
    action: "correct_amount",
    title: "Correct amount",
    helper: "Adjust to correct amount",
    icon: <Clock className="size-4" />,
    iconBg: "bg-emerald-50 border-emerald-100",
    iconColor: "text-emerald-700",
  },
  {
    action: "correct_category",
    title: "Correct category",
    helper: "Move to different category",
    icon: <SlidersHorizontal className="size-4" />,
    iconBg: "bg-blue-50 border-blue-100",
    iconColor: "text-blue-600",
  },
  {
    action: "correct_method",
    title: "Correct payment method",
    helper: "Update payment method",
    icon: <CreditCard className="size-4" />,
    iconBg: "bg-purple-50 border-purple-100",
    iconColor: "text-purple-600",
  },
  {
    action: "add_adjustment",
    title: "Add adjustment",
    helper: "Record additional income or expense",
    icon: <Plus className="size-4" />,
    iconBg: "bg-emerald-50 border-emerald-100",
    iconColor: "text-emerald-700",
  },
];

const REASONS = [
  "Supplier charged additional items",
  "Entry typo / wrong amount",
  "Customer dispute / adjustment",
  "Wrong category assigned",
  "Incorrect payment method recorded",
  "Duplicate entry correction",
  "Overpayment refund",
  "Underpayment reconciliation",
  "Other manual adjustment",
];

const CATEGORIES = [
  "Expense – Operational cost",
  "Expense – Supplies",
  "Expense – Maintenance",
  "Expense – Utilities",
  "Tip – Customer tip",
  "Staff Advance – Advance payment",
  "Petty Cash – Cash use",
  "Refund – Customer refund",
  "Adjustment – Ledger correction",
  "Misc Income – Other income",
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "card", label: "Card" },
  { value: "pay_on_site", label: "Pay on Site" },
  { value: "other", label: "Other" },
];

export function CashFlowCorrectionForm({
  transaction,
  onCancel,
}: {
  transaction?: CashFlowEntry | null;
  onCancel: () => void;
}) {
  const originalAmount = transaction?.amount ?? 1250;
  const originalMethod = transaction?.method ?? "cash";
  const originalCategory = transaction?.source ?? "expense";

  const [action, setAction] = useState<CorrectionAction>("correct_amount");
  const [correctAmount, setCorrectAmount] = useState(
    action === "correct_amount" ? "1,450.00" : ""
  );
  const [reason, setReason] = useState("Supplier charged additional items");
  const [correctionCategory, setCorrectionCategory] = useState("Expense – Operational cost");
  const [effectiveDateTime, setEffectiveDateTime] = useState("2026-09-26 03:45 PM");
  const [notes, setNotes] = useState(
    "Supplier included additional items (towels). Adjusting amount from ₱1,250.00 to ₱1,450.00."
  );
  const [newMethod, setNewMethod] = useState("");
  const [adjustmentDirection, setAdjustmentDirection] = useState("inflow");

  // Errors & notification state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prototypeNotice, setPrototypeNotice] = useState<string | null>(null);

  // Compute difference
  const numCorrectAmount = parseFloat(correctAmount.replace(/,/g, "")) || 0;
  const difference = useMemo(() => {
    if (action === "correct_amount") {
      return numCorrectAmount - originalAmount;
    }
    if (action === "reverse") {
      return -originalAmount;
    }
    if (action === "add_adjustment") {
      return adjustmentDirection === "inflow" ? numCorrectAmount : -numCorrectAmount;
    }
    return 0;
  }, [action, numCorrectAmount, originalAmount, adjustmentDirection]);

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!reason.trim()) {
      errs.reason = "Reason for correction is required.";
    }

    if (action === "correct_amount") {
      if (numCorrectAmount <= 0) {
        errs.correctAmount = "Please enter a valid amount greater than 0.";
      } else if (numCorrectAmount === originalAmount) {
        errs.correctAmount = "Corrected amount must differ from original amount.";
      }
    }

    if (action === "correct_method") {
      if (!newMethod) {
        errs.newMethod = "Please select the corrected payment method.";
      } else if (newMethod === originalMethod) {
        errs.newMethod = "New payment method must differ from current method.";
      }
    }

    if (action === "add_adjustment") {
      if (numCorrectAmount <= 0) {
        errs.correctAmount = "Adjustment amount must be greater than 0.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRecordCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    setPrototypeNotice(null);

    if (!validate()) {
      return;
    }

    // THIS PASS IS UI ONLY — DO NOT MUTATE FINANCIAL DATA
    const notice = "Correction persistence is not wired in this UI pass.";
    setPrototypeNotice(notice);
    toast.info(notice);
  };

  return (
    <form onSubmit={handleRecordCorrection} className="space-y-4">
      {/* Information Banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-[#FDF8F0] p-3 text-xs text-[#7A5330]">
        <Info className="size-4 shrink-0 text-amber-700 mt-0.5" />
        <p className="leading-relaxed">
          Original records are never overwritten. A linked correction entry will be written to the
          ledger. This keeps a complete audit trail of all changes.
        </p>
      </div>

      {/* Original Transaction Summary */}
      <CashFlowTransactionSummary transaction={transaction} />

      {/* Correction Action Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[var(--cs-text-secondary)]">
          Correction action
        </label>
        <div
          role="radiogroup"
          aria-label="Correction action"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
        >
          {CORRECTION_ACTIONS.map((opt) => {
            const isSelected = action === opt.action;
            return (
              <button
                key={opt.action}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  setAction(opt.action);
                  setErrors({});
                  setPrototypeNotice(null);
                  if (opt.action === "correct_amount" && !correctAmount) {
                    setCorrectAmount("1,450.00");
                  }
                }}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-700",
                  isSelected
                    ? "border-[#1b4332] bg-white ring-1 ring-[#1b4332] shadow-xs"
                    : "border-[var(--cs-border)] bg-white hover:border-stone-300 hover:bg-[var(--cs-surface-warm)]/40"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    opt.iconBg,
                    opt.iconColor
                  )}
                >
                  {opt.icon}
                </div>
                <div className="min-w-0 flex-1 pr-4">
                  <p className="truncate text-xs font-bold text-[var(--cs-text)]">
                    {opt.title}
                  </p>
                  <p className="truncate text-[10px] text-[var(--cs-text-muted)]">
                    {opt.helper}
                  </p>
                </div>
                {isSelected && (
                  <span
                    data-testid="selected-action-check"
                    className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-[#1b4332] text-white"
                  >
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Fields + Right Rail (Result panel) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        {/* Left Form Area */}
        <div className="space-y-4">
          {/* Action-Specific Inputs */}
          {action === "correct_amount" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Correct amount <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--cs-text-muted)]">
                    ₱
                  </span>
                  <input
                    type="text"
                    value={correctAmount}
                    onChange={(e) => setCorrectAmount(e.target.value)}
                    className={`${compactFieldClass} pl-7 font-bold tabular-nums`}
                  />
                </div>
                {errors.correctAmount && (
                  <p className="text-[11px] font-semibold text-rose-600">{errors.correctAmount}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Difference
                </label>
                <div className="flex h-8 items-center justify-between rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)]/40 px-3">
                  <span
                    data-testid="difference-display"
                    className={`font-bold tabular-nums text-xs ${
                      difference > 0
                        ? "text-emerald-700"
                        : difference < 0
                          ? "text-rose-700"
                          : "text-[var(--cs-text-secondary)]"
                    }`}
                  >
                    {difference > 0 ? `+${peso(difference)}` : difference < 0 ? `-${peso(Math.abs(difference))}` : peso(0)}
                  </span>
                  <span className="text-[10px] text-[var(--cs-text-muted)]">
                    Correction for difference
                  </span>
                </div>
              </div>
            </div>
          ) : action === "reverse" ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-800 space-y-1">
              <p className="font-bold">Reversal Confirmation</p>
              <p>
                This will record an equal and opposite entry of{" "}
                <span className="font-bold tabular-nums text-rose-900">-{peso(originalAmount)}</span> to
                completely reverse this transaction in the append-only ledger.
              </p>
            </div>
          ) : action === "correct_category" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Current Category
                </label>
                <input
                  type="text"
                  readOnly
                  value={originalCategory}
                  className={`${compactFieldClass} bg-[var(--cs-surface-warm)]/50 text-[var(--cs-text-muted)] cursor-not-allowed capitalize`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Corrected Category <span className="text-rose-600">*</span>
                </label>
                <select
                  value={correctionCategory}
                  onChange={(e) => setCorrectionCategory(e.target.value)}
                  className={compactFieldClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : action === "correct_method" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Current Payment Method
                </label>
                <input
                  type="text"
                  readOnly
                  value={originalMethod}
                  className={`${compactFieldClass} bg-[var(--cs-surface-warm)]/50 text-[var(--cs-text-muted)] cursor-not-allowed capitalize`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Corrected Payment Method <span className="text-rose-600">*</span>
                </label>
                <select
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value)}
                  className={compactFieldClass}
                >
                  <option value="">Select new method</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {errors.newMethod && (
                  <p className="text-[11px] font-semibold text-rose-600">{errors.newMethod}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Adjustment Direction <span className="text-rose-600">*</span>
                </label>
                <select
                  value={adjustmentDirection}
                  onChange={(e) => setAdjustmentDirection(e.target.value)}
                  className={compactFieldClass}
                >
                  <option value="inflow">Credit / Addition (Inflow)</option>
                  <option value="outflow">Debit / Deduction (Outflow)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Adjustment Amount <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--cs-text-muted)]">
                    ₱
                  </span>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={correctAmount}
                    onChange={(e) => setCorrectAmount(e.target.value)}
                    className={`${compactFieldClass} pl-7 font-bold tabular-nums`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Common Fields Row: Reason & Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                Reason for correction <span className="text-rose-600">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={compactFieldClass}
              >
                <option value="">Select reason</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {errors.reason && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.reason}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                Correction category <span className="text-rose-600">*</span>
              </label>
              <select
                value={correctionCategory}
                onChange={(e) => setCorrectionCategory(e.target.value)}
                className={compactFieldClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Effective Date & Notes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                Effective date & time <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={effectiveDateTime}
                onChange={(e) => setEffectiveDateTime(e.target.value)}
                className={compactFieldClass}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                  Notes
                </label>
                <span className="text-[10px] text-[var(--cs-text-muted)]">
                  {notes.length}/500
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 text-xs text-[var(--cs-text)] outline-none transition placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/15 resize-none"
              />
            </div>
          </div>

          {/* Audit Trail Preview */}
          <CashFlowCorrectionPreview
            transaction={transaction}
            action={action}
            difference={difference}
            correctedAmount={numCorrectAmount}
            effectiveDateTime={effectiveDateTime}
            reason={reason}
          />
        </div>

        {/* Right Rail: Result Panel */}
        <div className="rounded-xl border border-[var(--cs-border-soft)] bg-stone-50/70 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
              <Target className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Preview
              </p>
              <p className="text-base font-bold text-[var(--cs-text)]">
                Result
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--cs-text-secondary)] leading-relaxed">
            This correction will be recorded as a new linked entry and will affect the following:
          </p>

          <div className="border-t border-[var(--cs-border-soft)] pt-3 space-y-3 text-xs text-[var(--cs-text-secondary)]">
            <div className="flex items-start gap-2.5">
              <Calendar className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <div>
                <p className="font-bold text-[var(--cs-text)]">Updates Today view</p>
                <p className="text-[11px] text-[var(--cs-text-muted)]">
                  Corrected amount reflected in daily totals
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <FileText className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <div>
                <p className="font-bold text-[var(--cs-text)]">Updates Ledger</p>
                <p className="text-[11px] text-[var(--cs-text-muted)]">
                  New adjustment entry (append-only)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <TrendingUp className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <div>
                <p className="font-bold text-[var(--cs-text)]">Affects Day Close</p>
                <p className="text-[11px] text-[var(--cs-text-muted)]">
                  Included in daily reconciliation
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <History className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <div>
                <p className="font-bold text-[var(--cs-text)]">Visible in History</p>
                <p className="text-[11px] text-[var(--cs-text-muted)]">
                  Full audit trail with original and correction entries
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Local Prototype Notice Banner */}
      {prototypeNotice && (
        <div
          data-testid="prototype-notice"
          className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900"
        >
          <Info className="size-4 shrink-0 text-blue-700" />
          <span>{prototypeNotice}</span>
        </div>
      )}

      {/* Modal Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-[var(--cs-border-soft)] pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-9 rounded-lg border-[var(--cs-border)] bg-white px-4 text-xs font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)] shadow-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-9 rounded-lg bg-[#1b4332] px-5 text-xs font-semibold text-white hover:bg-[#16382a] shadow-xs"
        >
          <Check className="mr-1.5 size-3.5 stroke-[3]" />
          Record correction
        </Button>
      </div>
    </form>
  );
}
