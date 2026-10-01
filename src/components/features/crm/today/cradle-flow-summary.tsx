import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Home,
  Play,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";
import type { CradleFlowFilter } from "./cradle-flow-display";

const PRIMARY = [
  { key: "needs_action", label: "Needs Action", Icon: AlertTriangle, tone: "border-red-100 bg-red-50 text-red-700" },
  { key: "not_arrived", label: "Not Arrived", Icon: Clock3, tone: "border-orange-100 bg-orange-50 text-orange-800" },
  { key: "waiting_arrived", label: "Waiting (Arrived)", Icon: UserRoundCheck, tone: "border-amber-100 bg-amber-50 text-amber-800" },
  { key: "in_service", label: "In Service", Icon: Play, tone: "border-emerald-100 bg-emerald-50 text-emerald-800" },
  { key: "ready_to_pay", label: "Ready to Pay", Icon: WalletCards, tone: "border-violet-100 bg-violet-50 text-violet-800" },
  { key: "home_service", label: "Home Service", Icon: Home, tone: "border-blue-100 bg-blue-50 text-blue-700" },
] as const;

export function CradleFlowSummary({
  counts,
  collectedRevenue,
  onSelectFilter,
}: {
  counts: Record<CradleFlowFilter, number>;
  collectedRevenue: number;
  onSelectFilter: (filter: CradleFlowFilter) => void;
}) {
  return (
    <section
      className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-2 shadow-[var(--cs-shadow-xs)] sm:p-3"
      aria-label="Today's Cradle Flow summary"
    >
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-6">
        {PRIMARY.map(({ key, label, Icon, tone }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectFilter(key)}
            className={`flex min-h-[4.5rem] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${tone}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[10px] font-bold leading-tight">{label}</span>
              <span className="mt-0.5 block text-xl font-extrabold tabular-nums leading-none">
                {counts[key]}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 px-2 pb-0.5 pt-2.5 text-xs text-[var(--cs-text-secondary)]">
        <button type="button" onClick={() => onSelectFilter("completed")} className="inline-flex items-center gap-1.5 hover:text-[var(--cs-text)]">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          Completed <strong className="tabular-nums">{counts.completed}</strong>
        </button>
        <span className="inline-flex items-center gap-1.5">
          <Banknote className="size-4 text-emerald-600" aria-hidden="true" />
          Collected <strong className="tabular-nums">{formatCradleFlowMoney(collectedRevenue)}</strong>
        </span>
      </div>
    </section>
  );
}
