"use client";

import Link from "next/link";
import { useState } from "react";
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
    <section className="grid gap-2" aria-label="Front Desk duty context">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-base font-semibold text-foreground">Welcome, {duty.name}</p>
        <p className="text-sm text-muted-foreground">
          {duty.shiftLabel ? `${duty.shiftLabel} · ${branchName}` : branchName}
        </p>
      </div>
      {handoverConfirmed && duty.activeOperator ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          You are now the active Front Desk operator.
        </div>
      ) : null}
      {duty.handover && !later ? (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950"
        >
          <p className="font-semibold">Your {duty.handover.shiftLabel} may need a handover.</p>
          <p className="mt-1 text-sm">
            The open cash session is still under {duty.handover.outgoingName}. Review the current
            session before taking responsibility.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="rounded-lg bg-emerald-900 px-3 py-2 text-sm font-semibold text-white"
              href={`/crm/cash-flow?handover=${encodeURIComponent(duty.handover.sessionId)}`}
            >
              Review Handover
            </Link>
            <button
              type="button"
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold"
              onClick={() => setLater(true)}
            >
              Later
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
