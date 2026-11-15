"use client";

import { CheckCircle2, Clock, PhoneCall } from "lucide-react";
import { WaitlistFollowupTable, type WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { CrmStatCard } from "@/components/features/crm/shared/crm-cards";

type CallbackFollowupPanelProps = {
  rows: WaitlistRow[];
};

export function CallbackFollowupPanel({ rows }: CallbackFollowupPanelProps) {
  const waitingCount = rows.filter((row) => row.status === "waiting").length;
  const contactedCount = rows.filter((row) => row.status === "contacted").length;
  const convertedCount = rows.filter((row) => row.status === "converted").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <CrmStatCard
          title="Waiting"
          value={waitingCount}
          subtitle="Awaiting callback"
          icon={<Clock className="size-4" />}
          tone="warning"
          compact
        />
        <CrmStatCard
          title="Contacted"
          value={contactedCount}
          subtitle="Follow-up sent"
          icon={<PhoneCall className="size-4" />}
          tone="info"
          compact
        />
        <CrmStatCard
          title="Converted"
          value={convertedCount}
          subtitle="Booked from callback"
          icon={<CheckCircle2 className="size-4" />}
          tone="success"
          compact
        />
      </div>
      <WaitlistFollowupTable rows={rows} />
    </div>
  );
}
