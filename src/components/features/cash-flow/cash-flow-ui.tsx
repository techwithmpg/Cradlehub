import type { ReactNode } from "react";
import {
  Banknote,
  Smartphone,
  CreditCard,
  Building,
  Package,
  Calendar,
  Home,
  ShoppingCart,
  Gift,
  UserCheck,
  Users,
  Percent,
  Wallet,
  ArrowLeftRight,
  Undo2,
  SlidersHorizontal,
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);

export const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-medium text-[var(--cs-text)] outline-none transition placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/15";

export const compactFieldClass =
  "h-8 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 text-xs font-medium text-[var(--cs-text)] outline-none transition placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/15 shadow-xs";

export type StatusTone = "neutral" | "success" | "warning" | "info" | "error" | "paid" | "pending" | "unpaid" | "refunded";

const STATUS_TONE: Record<string, string> = {
  neutral: "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  unpaid: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  refunded: "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)]",
};

export function CashFlowStatus({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: StatusTone | string;
  className?: string;
}) {
  const resolvedTone = STATUS_TONE[tone] ?? STATUS_TONE.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        resolvedTone,
        className
      )}
    >
      {children}
    </span>
  );
}

const DOT_TONES: Record<string, string> = {
  green: "bg-emerald-600",
  sand: "bg-[#C4966E]",
  blue: "bg-blue-600",
  coral: "bg-rose-500",
  neutral: "bg-[var(--cs-text-muted)]",
};

export function CashFlowMetric({
  label,
  value,
  detail,
  icon,
  iconBg = "bg-emerald-50 text-emerald-700 border-emerald-100",
  dotTone = "green",
  comparison,
  compact = false,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  icon?: ReactNode;
  iconBg?: string;
  dotTone?: "green" | "sand" | "blue" | "coral" | "neutral";
  comparison?: {
    text: string;
    direction?: "up" | "down";
    tone?: "positive" | "negative" | "neutral";
  } | null;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        compact ? "p-3.5" : "p-4"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border",
            compact ? "size-7.5" : "size-8",
            iconBg
          )}
        >
          {icon ?? <Banknote className={compact ? "size-3.5" : "size-4"} />}
        </div>
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            DOT_TONES[dotTone] ?? DOT_TONES.green
          )}
        />
      </div>

      <p
        className={cn(
          "font-bold uppercase tracking-wider text-[var(--cs-text-muted)]",
          compact ? "mt-2 text-[10px]" : "mt-3 text-[11px]"
        )}
      >
        {label}
      </p>

      <p
        className={cn(
          "truncate font-bold tabular-nums tracking-tight text-[var(--cs-text)]",
          compact ? "mt-0.5 text-xl" : "mt-1 text-2xl"
        )}
      >
        {value}
      </p>

      {comparison ? (
        <p
          className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            compact ? "mt-0.5 text-[11px]" : "mt-1",
            comparison.tone === "positive"
              ? "text-emerald-700"
              : comparison.tone === "negative"
                ? "text-rose-700"
                : "text-[var(--cs-text-muted)]"
          )}
        >
          {comparison.direction === "down" ? (
            <TrendingDown className="size-3" />
          ) : (
            <TrendingUp className="size-3" />
          )}
          {comparison.text}
        </p>
      ) : null}

      {detail ? (
        <div
          className={cn(
            "text-[var(--cs-text-muted)]",
            compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"
          )}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function CashFlowPanel({
  title,
  description,
  rightAction,
  children,
  className,
}: {
  title: string;
  description?: string;
  rightAction?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[var(--cs-text)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const PAYMENT_METHOD_ICONS: Record<string, ReactNode> = {
  cash: <Banknote className="size-4 text-emerald-600" />,
  gcash: <Smartphone className="size-4 text-indigo-600" />,
  maya: <CreditCard className="size-4 text-sky-600" />,
  card: <CreditCard className="size-4 text-blue-600" />,
  pay_on_site: <Building className="size-4 text-[#8A6347]" />,
  other: <Package className="size-4 text-[#8A6347]" />,
};

export type CoverageCategoryItem = {
  key: string;
  name: string;
  amount: number;
  countLabel: string;
  icon: ReactNode;
  iconBg: string;
};

export function CashFlowCoverageTiles({
  items,
  onSelectCategory,
}: {
  items: CoverageCategoryItem[];
  onSelectCategory?: (key: string) => void;
}) {
  const automaticKeys = new Set(["bookings", "home_service", "payments"]);

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const isClickable = Boolean(onSelectCategory) && !automaticKeys.has(item.key);
        return (
          <div
            key={item.key}
            onClick={() => {
              if (isClickable) onSelectCategory?.(item.key);
            }}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelectCategory?.(item.key);
              }
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/60 p-2.5 transition-all",
              isClickable
                ? "cursor-pointer hover:border-emerald-600/40 hover:bg-[var(--cs-surface-warm)] hover:shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-700 outline-none"
                : "hover:bg-[var(--cs-surface-warm)]"
            )}
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                item.iconBg
              )}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--cs-text)]">
                {item.name}
              </p>
              <p className="font-bold tabular-nums text-sm text-[var(--cs-text)]">
                {peso(item.amount)}
              </p>
              <p className="truncate text-[11px] text-[var(--cs-text-muted)]">
                {item.countLabel}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function buildStandardCoverageItems(
  bookingCollected: number,
  bookingPaidCount: number,
  homeServiceCollected: number,
  homeServicePaidCount: number,
  totalPaymentsCollected: number,
  totalTransactionsCount: number
): CoverageCategoryItem[] {
  return [
    {
      key: "bookings",
      name: "Bookings",
      amount: bookingCollected,
      countLabel: `${bookingPaidCount} paid`,
      icon: <Calendar className="size-4 text-emerald-700" />,
      iconBg: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
    {
      key: "home_service",
      name: "Home Service",
      amount: homeServiceCollected,
      countLabel: `${homeServicePaidCount} paid`,
      icon: <Home className="size-4 text-amber-700" />,
      iconBg: "bg-amber-50 text-amber-700 border-amber-100",
    },
    {
      key: "payments",
      name: "Payments",
      amount: totalPaymentsCollected,
      countLabel: `${totalTransactionsCount} transactions`,
      icon: <CreditCard className="size-4 text-blue-700" />,
      iconBg: "bg-blue-50 text-blue-700 border-blue-100",
    },
    {
      key: "expenses",
      name: "Expenses",
      amount: 0,
      countLabel: "No records",
      icon: <ShoppingCart className="size-4 text-rose-700" />,
      iconBg: "bg-rose-50 text-rose-700 border-rose-100",
    },
    {
      key: "tips",
      name: "Tips",
      amount: 0,
      countLabel: "No records",
      icon: <Gift className="size-4 text-pink-700" />,
      iconBg: "bg-pink-50 text-pink-700 border-pink-100",
    },
    {
      key: "staff_advances",
      name: "Staff Advances",
      amount: 0,
      countLabel: "No records",
      icon: <UserCheck className="size-4 text-[#6B5D52]" />,
      iconBg: "bg-[#F7F2EB] text-[#6B5D52] border-[#EAE4DC]",
    },
    {
      key: "payroll",
      name: "Payroll",
      amount: 0,
      countLabel: "No records",
      icon: <Users className="size-4 text-[#6B5D52]" />,
      iconBg: "bg-[#F7F2EB] text-[#6B5D52] border-[#EAE4DC]",
    },
    {
      key: "commission_payouts",
      name: "Commission Payouts",
      amount: 0,
      countLabel: "No records",
      icon: <Percent className="size-4 text-[#6B5D52]" />,
      iconBg: "bg-[#F7F2EB] text-[#6B5D52] border-[#EAE4DC]",
    },
    {
      key: "petty_cash",
      name: "Petty Cash",
      amount: 0,
      countLabel: "No records",
      icon: <Wallet className="size-4 text-amber-700" />,
      iconBg: "bg-amber-50 text-amber-700 border-amber-100",
    },
    {
      key: "transfers",
      name: "Transfers",
      amount: 0,
      countLabel: "No records",
      icon: <ArrowLeftRight className="size-4 text-[#6B5D52]" />,
      iconBg: "bg-[#F7F2EB] text-[#6B5D52] border-[#EAE4DC]",
    },
    {
      key: "refunds",
      name: "Refunds",
      amount: 0,
      countLabel: "No records",
      icon: <Undo2 className="size-4 text-rose-700" />,
      iconBg: "bg-rose-50 text-rose-700 border-rose-100",
    },
    {
      key: "adjustments",
      name: "Adjustments",
      amount: 0,
      countLabel: "No records",
      icon: <SlidersHorizontal className="size-4 text-sky-700" />,
      iconBg: "bg-sky-50 text-sky-700 border-sky-100",
    },
    {
      key: "misc_income",
      name: "Misc Income",
      amount: 0,
      countLabel: "No records",
      icon: <Plus className="size-4 text-emerald-700" />,
      iconBg: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
  ];
}