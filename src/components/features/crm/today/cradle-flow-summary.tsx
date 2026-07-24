import { Banknote, CheckCircle2, Clock3, Home, PlayCircle, WalletCards } from "lucide-react";
import type { CradleFlowCounts } from "@/lib/crm/cradle-flow";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";

const SUMMARY_ITEMS = [
  { key: "waiting", label: "Waiting", Icon: Clock3 },
  { key: "in_service", label: "In Service", Icon: PlayCircle },
  { key: "ready_to_pay", label: "Ready to Pay", Icon: WalletCards },
  { key: "completed", label: "Completed", Icon: CheckCircle2 },
  { key: "homeService", label: "Home Service", Icon: Home },
] as const;

export function CradleFlowSummary({
  counts,
  collectedRevenue,
}: {
  counts: CradleFlowCounts;
  collectedRevenue: number;
}) {
  return (
    <section
      className="grid overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)] sm:grid-cols-3 xl:grid-cols-6"
      aria-label="Today's Cradle Flow summary"
    >
      {SUMMARY_ITEMS.map(({ key, label, Icon }) => (
        <div
          key={key}
          className="flex min-h-20 items-center gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3 sm:[&:nth-child(3n+1)]:border-l-0 xl:border-b-0 xl:border-l"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]">
            <Icon className="size-4" />
          </span>
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              {label}
            </span>
            <span className="mt-1 block text-xl font-bold tabular-nums text-[var(--cs-text)]">
              {counts[key]}
            </span>
          </span>
        </div>
      ))}
      <div className="flex min-h-20 items-center gap-3 border-[var(--cs-border-soft)] px-4 py-3 xl:border-l">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
          <Banknote className="size-4" />
        </span>
        <span>
          <span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Collected
          </span>
          <span className="mt-1 block text-lg font-bold tabular-nums text-[var(--cs-success-text)]">
            {formatCradleFlowMoney(collectedRevenue)}
          </span>
        </span>
      </div>
    </section>
  );
}
