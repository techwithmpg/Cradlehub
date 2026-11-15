"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, UserCheck } from "lucide-react";
import { CrmAlertCard, CrmInfoCard } from "@/components/features/crm/shared/crm-cards";
import type { FrontDeskDutyContext } from "@/lib/queries/front-desk-duty";

export function FrontDeskDutyBanner({
  duty,
  handoverConfirmed,
  branchName,
}: {
  duty: FrontDeskDutyContext | null;
  handoverConfirmed: boolean;
  branchName: string;
}) {
  const [later, setLater] = useState(false);
  if (!duty) return null;
  return (
    <section className="grid gap-2.5" aria-label="Front Desk duty context">
      <CrmInfoCard
        title={`Welcome, ${duty.name}`}
        subtitle={duty.shiftLabel ? `${duty.shiftLabel} · ${branchName}` : branchName}
        icon={<UserCheck className="size-4" />}
        tone="success"
        compact
      />
      {handoverConfirmed && duty.activeOperator ? (
        <CrmAlertCard
          role="status"
          tone="success"
          compact
          icon={<CheckCircle2 className="size-4" />}
          title="You are now the active Front Desk operator."
        />
      ) : null}
      {duty.handover && !later ? (
        <CrmAlertCard
          role="status"
          tone="warning"
          compact
          icon={<AlertTriangle className="size-4" />}
          title={`Your ${duty.handover.shiftLabel} may need a handover.`}
          description={`The open cash session is still under ${duty.handover.outgoingName}. Review the current session before taking responsibility.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded-lg bg-[#1F4E33] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#163B26]"
                href={`/crm/cash-flow?handover=${encodeURIComponent(duty.handover.sessionId)}`}
              >
                Review Handover
              </Link>
              <button
                type="button"
                className="rounded-lg border border-[#EFE1BE] bg-white px-3 py-2 text-xs font-semibold text-[var(--cs-text)] transition hover:bg-[#FDF8EC]"
                onClick={() => setLater(true)}
              >
                Later
              </button>
            </div>
          }
        />
      ) : null}
    </section>
  );
}
