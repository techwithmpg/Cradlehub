"use client";

import type { ReactNode } from "react";
import {
  ShoppingCart,
  Calendar,
  Home,
  CreditCard,
  Gift,
  UserCheck,
  Wallet,
  ArrowLeftRight,
  Undo2,
  SlidersHorizontal,
  Plus,
  Percent,
  Users,
  Package,
} from "lucide-react";
import type { CashFlowEntry } from "@/lib/cash-flow/read-model";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { formatTime12h } from "@/lib/utils/time-format";
import { CashFlowStatus, PAYMENT_METHOD_ICONS, peso } from "./cash-flow-ui";

function formatSummaryDate(dateStr?: string, timeStr?: string) {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    return timeStr ? `${formatted} ${formatTime12h(timeStr)}` : formatted;
  } catch {
    return dateStr;
  }
}

function getSourceMeta(source?: string): {
  title: string;
  sub: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
} {
  switch (source) {
    case "expense":
      return {
        title: "Expense",
        sub: "Operational cost",
        icon: <ShoppingCart className="size-5" />,
        iconBg: "bg-rose-50 border-rose-100",
        iconColor: "text-rose-600",
      };
    case "tip":
      return {
        title: "Tip",
        sub: "Customer tip",
        icon: <Gift className="size-5" />,
        iconBg: "bg-pink-50 border-pink-100",
        iconColor: "text-pink-600",
      };
    case "staff_advance":
      return {
        title: "Staff Advance",
        sub: "Staff payment",
        icon: <UserCheck className="size-5" />,
        iconBg: "bg-slate-100 border-slate-200",
        iconColor: "text-slate-700",
      };
    case "petty_cash":
      return {
        title: "Petty Cash",
        sub: "Small cash use",
        icon: <Wallet className="size-5" />,
        iconBg: "bg-amber-50 border-amber-100",
        iconColor: "text-amber-600",
      };
    case "transfer":
      return {
        title: "Transfer",
        sub: "Move between accounts",
        icon: <ArrowLeftRight className="size-5" />,
        iconBg: "bg-blue-50 border-blue-100",
        iconColor: "text-blue-600",
      };
    case "refund":
      return {
        title: "Refund",
        sub: "Customer refund",
        icon: <Undo2 className="size-5" />,
        iconBg: "bg-rose-50 border-rose-100",
        iconColor: "text-rose-600",
      };
    case "adjustment":
      return {
        title: "Adjustment",
        sub: "Ledger adjustment",
        icon: <SlidersHorizontal className="size-5" />,
        iconBg: "bg-sky-50 border-sky-100",
        iconColor: "text-sky-600",
      };
    case "misc_income":
      return {
        title: "Misc Income",
        sub: "Other income",
        icon: <Plus className="size-5" />,
        iconBg: "bg-emerald-50 border-emerald-100",
        iconColor: "text-emerald-600",
      };
    case "commission_payout":
      return {
        title: "Commission Payout",
        sub: "Commission to staff",
        icon: <Percent className="size-5" />,
        iconBg: "bg-purple-50 border-purple-100",
        iconColor: "text-purple-600",
      };
    case "payroll":
      return {
        title: "Payroll Payout",
        sub: "Payroll disbursement",
        icon: <Users className="size-5" />,
        iconBg: "bg-neutral-100 border-neutral-200",
        iconColor: "text-neutral-700",
      };
    case "home_service":
      return {
        title: "Home Service",
        sub: "Dispatched booking",
        icon: <Home className="size-5" />,
        iconBg: "bg-amber-50 border-amber-100",
        iconColor: "text-amber-700",
      };
    case "booking":
    default:
      return {
        title: "Booking",
        sub: "Spa service booking",
        icon: <Calendar className="size-5" />,
        iconBg: "bg-emerald-50 border-emerald-100",
        iconColor: "text-emerald-700",
      };
  }
}

export function CashFlowTransactionSummary({
  transaction,
}: {
  transaction?: CashFlowEntry | null;
}) {
  const meta = getSourceMeta(transaction?.source);
  const methodLabel = transaction?.method
    ? PAYMENT_METHOD_LABELS[transaction.method as keyof typeof PAYMENT_METHOD_LABELS] ??
      transaction.method
    : "—";
  const methodIcon = transaction?.method
    ? PAYMENT_METHOD_ICONS[transaction.method] ?? <Package className="size-3.5" />
    : null;

  const reference =
    transaction?.reference ||
    (transaction?.id ? `#${transaction.id.slice(0, 8)}` : "—");

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-[var(--cs-text-secondary)]">
        Original transaction
      </p>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/40 p-3.5 sm:gap-6">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${meta.iconBg} ${meta.iconColor}`}
        >
          {meta.icon}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 sm:gap-x-8 flex-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Type
            </p>
            <p className="text-xs font-bold text-[var(--cs-text)]">
              {meta.title}
            </p>
            <p className="text-[10px] text-[var(--cs-text-muted)]">
              {meta.sub}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Amount
            </p>
            <p className="text-xs font-bold tabular-nums text-[var(--cs-text)]">
              {transaction ? peso(transaction.amount) : "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Payment Method
            </p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--cs-text)]">
              {methodIcon}
              <span>{methodLabel}</span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Description
            </p>
            <p className="truncate text-xs font-medium text-[var(--cs-text)]">
              {transaction?.service || transaction?.customer || "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Date & Time
            </p>
            <p className="text-xs font-medium text-[var(--cs-text)]">
              {formatSummaryDate(transaction?.date, transaction?.time)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Reference No.
            </p>
            <p className="font-mono text-xs font-semibold text-[var(--cs-text)]">
              {reference}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Status
            </p>
            <div className="pt-0.5">
              <CashFlowStatus tone={transaction?.paymentStatus ?? "neutral"}>
                {transaction?.paymentStatus ?? "—"}
              </CashFlowStatus>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
