import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";

export type SetupStatus = "ready" | "warning" | "error" | "info";

const STATUS_TO_TONE: Record<SetupStatus, CrmCardTone> = {
  ready: "success",
  warning: "warning",
  error: "danger",
  info: "info",
};

const STATUS_ICONS: Record<SetupStatus, ReactNode> = {
  ready: <CheckCircle2 className="size-4" />,
  warning: <AlertTriangle className="size-4" />,
  error: <AlertCircle className="size-4" />,
  info: <Info className="size-4" />,
};

export function SetupStatusCard({
  icon,
  label,
  value,
  sub,
  status,
  actionLabel,
  actionHref,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  status: SetupStatus;
  actionLabel?: string;
  actionHref?: string;
}) {
  const tone = STATUS_TO_TONE[status];
  const resolvedIcon = typeof icon === "string" ? STATUS_ICONS[status] : icon;

  return (
    <CrmStatCard
      title={label}
      value={value}
      subtitle={sub}
      icon={resolvedIcon}
      tone={tone}
      compact
      footer={
        actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--cs-border-soft)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1F4E33] transition hover:border-[#1F4E33]/40 hover:bg-[#EEF7F1]"
          >
            {actionLabel}
            <ChevronRight className="size-3.5" />
          </Link>
        ) : undefined
      }
    />
  );
}
