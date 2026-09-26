"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Calendar,
  FileText,
  ShieldCheck,
  Lock,
  Info,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CashFlowEntryTypeSelector,
  type CashFlowEntryType,
} from "./cash-flow-entry-type-selector";
import { compactFieldClass } from "./cash-flow-ui";

const EXPENSE_CATEGORIES = [
  "Supplies",
  "Utilities",
  "Rent",
  "Maintenance",
  "Marketing",
  "Travel & Transport",
  "Inventory",
  "Staff Welfare",
  "Other",
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "card", label: "Card" },
  { value: "pay_on_site", label: "Pay on Site" },
  { value: "other", label: "Other" },
];

const TRANSFER_ACCOUNTS = [
  { value: "cash", label: "Cash Vault / Drawer" },
  { value: "bank", label: "BDO Spa Account" },
  { value: "gcash", label: "GCash Merchant" },
  { value: "maya", label: "Maya Business" },
  { value: "petty_cash", label: "Petty Cash Box" },
];

const STAFF_MEMBERS = [
  "Joy Ramos (Senior Therapist)",
  "Maria Santos (Therapist)",
  "Rosanna Reyes (Therapist)",
  "Hazel Fonker (Therapist)",
  "Jannah Galvez (Front Desk)",
  "Staff Pool / All",
];

function getLedgerEffect(type: CashFlowEntryType, pettyDirection = "outflow", adjDirection = "outflow") {
  switch (type) {
    case "expense":
      return {
        direction: "outflow",
        label: "Outflow",
        desc: "This entry will be recorded as a money outflow (debit) in the cash ledger.",
      };
    case "tip":
      return {
        direction: "inflow",
        label: "Inflow",
        desc: "This entry will be recorded as a money inflow (credit) for staff tip tracking.",
      };
    case "staff_advance":
      return {
        direction: "outflow",
        label: "Outflow",
        desc: "This entry will be recorded as a money outflow (debit) in the staff advance ledger.",
      };
    case "petty_cash":
      return pettyDirection === "inflow"
        ? {
            direction: "inflow",
            label: "Inflow",
            desc: "This entry records cash replenishment into the petty cash balance.",
          }
        : {
            direction: "outflow",
            label: "Outflow",
            desc: "This entry records small cash disbursement from the petty cash balance.",
          };
    case "transfer":
      return {
        direction: "transfer",
        label: "Transfer",
        desc: "This entry moves funds between payment accounts without altering total net flow.",
      };
    case "refund":
      return {
        direction: "outflow",
        label: "Outflow",
        desc: "This entry will be recorded as a money outflow (debit) for customer refund.",
      };
    case "adjustment":
      return adjDirection === "inflow"
        ? {
            direction: "inflow",
            label: "Inflow",
            desc: "This adjustment entry will record an inflow (credit) to adjust the cash ledger.",
          }
        : {
            direction: "outflow",
            label: "Outflow",
            desc: "This adjustment entry will record an outflow (debit) to adjust the cash ledger.",
          };
    case "misc_income":
      return {
        direction: "inflow",
        label: "Inflow",
        desc: "This entry will be recorded as additional money inflow (credit) in the cash ledger.",
      };
    case "commission_payout":
      return {
        direction: "outflow",
        label: "Outflow",
        desc: "This entry will be recorded as a money outflow (debit) for staff commission disbursement.",
      };
    case "payroll":
      return {
        direction: "outflow",
        label: "Outflow",
        desc: "This entry will be recorded as a money outflow (debit) for staff payroll disbursement.",
      };
  }
}

export function CashFlowCreateEntryForm({
  defaultEntryType = "expense",
  branchName = "Cradle Wellness Living Main Spa",
  onCancel,
}: {
  defaultEntryType?: CashFlowEntryType;
  branchName?: string;
  onCancel: () => void;
}) {
  const [entryType, setEntryType] = useState<CashFlowEntryType>(defaultEntryType);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dateTime, setDateTime] = useState("2026-09-26 03:45 PM");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");

  // Type-specific state
  const [category, setCategory] = useState("");
  const [paidToSource, setPaidToSource] = useState("");
  const [staffMember, setStaffMember] = useState("");
  const [reason, setReason] = useState("");
  const [transferFrom, setTransferFrom] = useState("cash");
  const [transferTo, setTransferTo] = useState("bank");
  const [pettyDirection, setPettyDirection] = useState("outflow");
  const [adjustmentDirection, setAdjustmentDirection] = useState("outflow");
  const [customerRef, setCustomerRef] = useState("");
  const [period, setPeriod] = useState("");

  // Validation & prototype banner state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prototypeNotice, setPrototypeNotice] = useState<string | null>(null);

  const effect = getLedgerEffect(entryType, pettyDirection, adjustmentDirection);

  const validate = () => {
    const errs: Record<string, string> = {};
    const num = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) {
      errs.amount = "Please enter a valid amount greater than 0.";
    }

    if (entryType === "transfer") {
      if (transferFrom === transferTo) {
        errs.transferTo = "Source and destination accounts must be different.";
      }
    } else {
      if (!paymentMethod) {
        errs.paymentMethod = "Please select a payment method.";
      }
    }

    if (entryType === "expense") {
      if (!category) errs.category = "Please select an expense category.";
      if (!paidToSource.trim()) errs.paidToSource = "Paid To / Source is required.";
    }

    if (entryType === "staff_advance") {
      if (!staffMember) errs.staffMember = "Please select the staff member.";
    }

    if (entryType === "commission_payout" || entryType === "payroll") {
      if (!staffMember && !paidToSource) {
        errs.staffMember = "Recipient / staff member is required.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRecordEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setPrototypeNotice(null);

    if (!validate()) {
      return;
    }

    // THIS PASS IS UI ONLY — DO NOT MUTATE FINANCIAL DATA
    const notice = "Cash Flow entry wiring is not enabled in this UI pass.";
    setPrototypeNotice(notice);
    toast.info(notice);
  };

  return (
    <form onSubmit={handleRecordEntry} className="space-y-5">
      {/* Information Banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-[#FDF8F0] p-3 text-xs text-[#7A5330]">
        <Info className="size-4 shrink-0 text-amber-700 mt-0.5" />
        <p className="leading-relaxed">
          Automatic sources such as <span className="font-semibold text-stone-900">bookings</span>,{" "}
          <span className="font-semibold text-stone-900">home service</span>, and{" "}
          <span className="font-semibold text-stone-900">payment captures</span> flow in automatically.
          Use this form for manual finance entries and corrections only.
        </p>
      </div>

      {/* Entry Type Selector */}
      <CashFlowEntryTypeSelector
        value={entryType}
        onChange={(type) => {
          setEntryType(type);
          setErrors({});
          setPrototypeNotice(null);
        }}
      />

      {/* Form Grid: 2-column inputs + Right Rail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        {/* Left Inputs Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Amount * */}
          <div className="space-y-1">
            <label
              htmlFor="entry-amount"
              className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
            >
              Amount <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--cs-text-muted)]">
                ₱
              </span>
              <input
                id="entry-amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${compactFieldClass} pl-7 font-bold tabular-nums`}
              />
            </div>
            {errors.amount && (
              <p className="text-[11px] font-semibold text-rose-600">{errors.amount}</p>
            )}
          </div>

          {/* Conditional Field 1: Category or Transfer From */}
          {entryType === "transfer" ? (
            <div className="space-y-1">
              <label
                htmlFor="transfer-from"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                From Account <span className="text-rose-600">*</span>
              </label>
              <select
                id="transfer-from"
                value={transferFrom}
                onChange={(e) => setTransferFrom(e.target.value)}
                className={compactFieldClass}
              >
                {TRANSFER_ACCOUNTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          ) : entryType === "expense" ? (
            <div className="space-y-1">
              <label
                htmlFor="entry-category"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                id="entry-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={compactFieldClass}
              >
                <option value="">Select category</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.category}</p>
              )}
            </div>
          ) : entryType === "petty_cash" ? (
            <div className="space-y-1">
              <label
                htmlFor="petty-direction"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Petty Cash Flow <span className="text-rose-600">*</span>
              </label>
              <select
                id="petty-direction"
                value={pettyDirection}
                onChange={(e) => setPettyDirection(e.target.value)}
                className={compactFieldClass}
              >
                <option value="outflow">Cash withdrawal / Expense (Outflow)</option>
                <option value="inflow">Cash replenishment / Deposit (Inflow)</option>
              </select>
            </div>
          ) : entryType === "adjustment" ? (
            <div className="space-y-1">
              <label
                htmlFor="adj-direction"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Adjustment Direction <span className="text-rose-600">*</span>
              </label>
              <select
                id="adj-direction"
                value={adjustmentDirection}
                onChange={(e) => setAdjustmentDirection(e.target.value)}
                className={compactFieldClass}
              >
                <option value="outflow">Debit / Deduction (Outflow)</option>
                <option value="inflow">Credit / Addition (Inflow)</option>
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label
                htmlFor="entry-category-text"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Category
              </label>
              <input
                id="entry-category-text"
                type="text"
                placeholder="e.g. Service Tip / Other"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={compactFieldClass}
              />
            </div>
          )}

          {/* Conditional Field 2: Payment Method or Transfer To */}
          {entryType === "transfer" ? (
            <div className="space-y-1">
              <label
                htmlFor="transfer-to"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                To Account <span className="text-rose-600">*</span>
              </label>
              <select
                id="transfer-to"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className={compactFieldClass}
              >
                {TRANSFER_ACCOUNTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              {errors.transferTo && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.transferTo}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <label
                htmlFor="payment-method"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Payment Method <span className="text-rose-600">*</span>
              </label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={compactFieldClass}
              >
                <option value="">Select payment method</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {errors.paymentMethod && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.paymentMethod}</p>
              )}
            </div>
          )}

          {/* Date & Time * */}
          <div className="space-y-1">
            <label
              htmlFor="entry-date-time"
              className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
            >
              Date & Time <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                id="entry-date-time"
                type="text"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className={`${compactFieldClass} pr-8 font-medium`}
              />
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--cs-text-muted)] pointer-events-none" />
            </div>
          </div>

          {/* Reference No. */}
          <div className="space-y-1">
            <label
              htmlFor="reference-no"
              className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
            >
              Reference No.
            </label>
            <input
              id="reference-no"
              type="text"
              placeholder="e.g. INV-20260926-001"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className={compactFieldClass}
            />
          </div>

          {/* Type-Specific Source / Paid To / Staff */}
          {entryType === "expense" ? (
            <div className="space-y-1">
              <label
                htmlFor="paid-to-source"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Paid To / Source <span className="text-rose-600">*</span>
              </label>
              <input
                id="paid-to-source"
                type="text"
                placeholder="e.g. Supplier name, staff name, store, etc."
                value={paidToSource}
                onChange={(e) => setPaidToSource(e.target.value)}
                className={compactFieldClass}
              />
              {errors.paidToSource && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.paidToSource}</p>
              )}
            </div>
          ) : entryType === "staff_advance" || entryType === "commission_payout" || entryType === "payroll" ? (
            <div className="space-y-1">
              <label
                htmlFor="staff-member"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Staff Member <span className="text-rose-600">*</span>
              </label>
              <select
                id="staff-member"
                value={staffMember}
                onChange={(e) => setStaffMember(e.target.value)}
                className={compactFieldClass}
              >
                <option value="">Select staff member</option>
                {STAFF_MEMBERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.staffMember && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.staffMember}</p>
              )}
            </div>
          ) : entryType === "refund" ? (
            <div className="space-y-1">
              <label
                htmlFor="customer-ref"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Customer / Reference
              </label>
              <input
                id="customer-ref"
                type="text"
                placeholder="e.g. Customer name or booking #"
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
                className={compactFieldClass}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label
                htmlFor="paid-to-source-desc"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
              >
                Source / Description
              </label>
              <input
                id="paid-to-source-desc"
                type="text"
                placeholder="e.g. Cash sale / Vendor / Reference"
                value={paidToSource}
                onChange={(e) => setPaidToSource(e.target.value)}
                className={compactFieldClass}
              />
            </div>
          )}

          {/* Branch (Read-only visual field with locked indicator) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Branch
            </label>
            <div className="flex h-8 items-center justify-between rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)]/50 px-3 text-xs font-medium text-[var(--cs-text-secondary)]">
              <span className="truncate">{branchName}</span>
              <Lock className="size-3 shrink-0 text-[var(--cs-text-muted)]" />
            </div>
          </div>

          {/* Notes (Spans across) */}
          <div className="space-y-1 sm:col-span-1">
            <label
              htmlFor="entry-notes"
              className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]"
            >
              Notes
            </label>
            <textarea
              id="entry-notes"
              rows={2}
              placeholder="Add remarks or additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 text-xs text-[var(--cs-text)] outline-none transition placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/15 resize-none"
            />
          </div>
        </div>

        {/* Right Rail: Effect on Ledger Panel */}
        <div className="rounded-xl border border-[var(--cs-border-soft)] bg-stone-50/70 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                effect.direction === "outflow"
                  ? "bg-rose-50 border-rose-100 text-rose-600"
                  : effect.direction === "inflow"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                    : "bg-blue-50 border-blue-100 text-blue-600"
              }`}
            >
              {effect.direction === "outflow" ? (
                <ArrowDown className="size-5" />
              ) : effect.direction === "inflow" ? (
                <ArrowUp className="size-5" />
              ) : (
                <ArrowLeftRight className="size-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Effect on ledger
              </p>
              <p className="text-base font-bold text-[var(--cs-text)]">
                {effect.label}
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--cs-text-secondary)] leading-relaxed">
            {effect.desc}
          </p>

          <div className="border-t border-[var(--cs-border-soft)] pt-3 space-y-2.5 text-xs text-[var(--cs-text-secondary)]">
            <div className="flex items-start gap-2">
              <Calendar className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <span>Will appear in Today, Ledger, Day Close, and History.</span>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <span>Creates append-only transaction record.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <span>Helps maintain accurate and auditable financial records.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Local Prototype Notice Banner (Safe non-destructive notification) */}
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
          Record entry
        </Button>
      </div>
    </form>
  );
}
