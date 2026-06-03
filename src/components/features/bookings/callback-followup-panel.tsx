"use client";

import { WaitlistFollowupTable, type WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";

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
        <SummaryCard label="Waiting" value={waitingCount} />
        <SummaryCard label="Contacted" value={contactedCount} />
        <SummaryCard label="Converted" value={convertedCount} />
      </div>
      <WaitlistFollowupTable rows={rows} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]">
      <div className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-[var(--cs-text)] tabular-nums">{value}</div>
    </div>
  );
}
