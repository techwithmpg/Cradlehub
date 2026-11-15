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
import { CrmSectionCard, CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";
import type { CradleFlowFilter } from "./cradle-flow-display";

const PRIMARY: ReadonlyArray<{
  key: CradleFlowFilter;
  label: string;
  subtitle: string;
  Icon: typeof AlertTriangle;
  tone: CrmCardTone;
}> = [
  { key: "needs_action", label: "Needs Action", subtitle: "Missing room, therapist, or check", Icon: AlertTriangle, tone: "danger" },
  { key: "not_arrived", label: "Not Arrived", subtitle: "Scheduled and expected today", Icon: Clock3, tone: "warning" },
  { key: "waiting_arrived", label: "Waiting (Arrived)", subtitle: "Checked in at front desk", Icon: UserRoundCheck, tone: "warning" },
  { key: "in_service", label: "In Service", subtitle: "Session currently running", Icon: Play, tone: "success" },
  { key: "ready_to_pay", label: "Ready to Pay", subtitle: "Awaiting checkout settlement", Icon: WalletCards, tone: "info" },
  { key: "home_service", label: "Home Service", subtitle: "Out-of-branch visits today", Icon: Home, tone: "info" },
];

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
    <CrmSectionCard
      ariaLabel="Today's Cradle Flow summary"
      compact
      footer={
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-[var(--cs-text-secondary)]">
          <button
            type="button"
            onClick={() => onSelectFilter("completed")}
            className="inline-flex items-center gap-1.5 font-medium transition hover:text-[var(--cs-text)]"
          >
            <CheckCircle2 className="size-4 text-[#1F4E33]" aria-hidden="true" />
            Completed <strong className="tabular-nums text-[var(--cs-text)]">{counts.completed}</strong>
          </button>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Banknote className="size-4 text-[#1F4E33]" aria-hidden="true" />
            Collected <strong className="tabular-nums text-[var(--cs-text)]">{formatCradleFlowMoney(collectedRevenue)}</strong>
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {PRIMARY.map(({ key, label, subtitle, Icon, tone }) => (
          <CrmStatCard
            key={key}
            title={label}
            value={counts[key]}
            subtitle={subtitle}
            icon={<Icon className="size-4" aria-hidden="true" />}
            tone={key === "needs_action" && counts[key] === 0 ? "neutral" : tone}
            compact
            onClick={() => onSelectFilter(key)}
          />
        ))}
      </div>
    </CrmSectionCard>
  );
}
