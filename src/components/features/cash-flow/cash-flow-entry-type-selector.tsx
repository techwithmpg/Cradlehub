"use client";

import type { ReactNode } from "react";
import {
  ShoppingCart,
  Gift,
  UserCheck,
  Wallet,
  ArrowLeftRight,
  Undo2,
  SlidersHorizontal,
  Plus,
  Percent,
  Users,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CashFlowEntryType =
  | "expense"
  | "tip"
  | "staff_advance"
  | "petty_cash"
  | "transfer"
  | "refund"
  | "adjustment"
  | "misc_income"
  | "commission_payout"
  | "payroll";

export interface EntryTypeOption {
  type: CashFlowEntryType;
  title: string;
  helper: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}

export const ENTRY_TYPE_OPTIONS: EntryTypeOption[] = [
  {
    type: "expense",
    title: "Expense",
    helper: "Operational cost",
    icon: <ShoppingCart className="size-4" />,
    iconBg: "bg-rose-50 border-rose-100",
    iconColor: "text-rose-600",
  },
  {
    type: "tip",
    title: "Tip",
    helper: "Customer tip",
    icon: <Gift className="size-4" />,
    iconBg: "bg-pink-50 border-pink-100",
    iconColor: "text-pink-600",
  },
  {
    type: "staff_advance",
    title: "Staff Advance",
    helper: "Staff payment",
    icon: <UserCheck className="size-4" />,
    iconBg: "bg-slate-100 border-slate-200",
    iconColor: "text-slate-700",
  },
  {
    type: "petty_cash",
    title: "Petty Cash",
    helper: "Small cash use",
    icon: <Wallet className="size-4" />,
    iconBg: "bg-amber-50 border-amber-100",
    iconColor: "text-amber-600",
  },
  {
    type: "transfer",
    title: "Transfer",
    helper: "Move between accounts",
    icon: <ArrowLeftRight className="size-4" />,
    iconBg: "bg-blue-50 border-blue-100",
    iconColor: "text-blue-600",
  },
  {
    type: "refund",
    title: "Refund",
    helper: "Customer refund",
    icon: <Undo2 className="size-4" />,
    iconBg: "bg-rose-50 border-rose-100",
    iconColor: "text-rose-600",
  },
  {
    type: "adjustment",
    title: "Adjustment",
    helper: "Ledger adjustment",
    icon: <SlidersHorizontal className="size-4" />,
    iconBg: "bg-sky-50 border-sky-100",
    iconColor: "text-sky-600",
  },
  {
    type: "misc_income",
    title: "Misc Income",
    helper: "Other income",
    icon: <Plus className="size-4" />,
    iconBg: "bg-emerald-50 border-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    type: "commission_payout",
    title: "Commission Payout",
    helper: "Commission to staff",
    icon: <Percent className="size-4" />,
    iconBg: "bg-purple-50 border-purple-100",
    iconColor: "text-purple-600",
  },
  {
    type: "payroll",
    title: "Payroll Payout",
    helper: "Payroll disbursement",
    icon: <Users className="size-4" />,
    iconBg: "bg-neutral-100 border-neutral-200",
    iconColor: "text-neutral-700",
  },
];

export function CashFlowEntryTypeSelector({
  value,
  onChange,
}: {
  value: CashFlowEntryType;
  onChange: (type: CashFlowEntryType) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-[var(--cs-text-secondary)]">
        Entry type
      </label>
      <div
        role="radiogroup"
        aria-label="Entry type"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
      >
        {ENTRY_TYPE_OPTIONS.map((opt) => {
          const isSelected = value === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.type)}
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
                  data-testid="selected-check"
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
  );
}
