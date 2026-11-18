"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  applyRecommendedFixAction,
  evaluateBranchOptimizationAction,
} from "@/lib/actions/optimization-actions";
import type { TieredCrmOperationsSummary } from "@/lib/optimization/crm-operations-assistant";
import type {
  PredictiveConflictItem,
  RecommendedStaffAction,
} from "@/lib/optimization/types";

type Props = {
  initialSummary?: TieredCrmOperationsSummary | null;
  date?: string;
  compact?: boolean;
};

const SUPPORTED_DIRECT_APPLY = new Set([
  "swap_therapist",
  "assign_therapist",
  "reassign_room",
  "assign_room",
  "assign_driver",
  "prioritize_room_turnover",
]);

function ConflictItemRow({
  conflict,
  snapshotVersion,
  date,
  isPending,
  onApplied,
}: {
  conflict: PredictiveConflictItem;
  snapshotVersion: string;
  date?: string;
  isPending: boolean;
  onApplied: (nextSummary: TieredCrmOperationsSummary) => void;
}) {
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const firstAction: RecommendedStaffAction | undefined = conflict.recommended_actions[0];
  const canApply =
    Boolean(firstAction) &&
    SUPPORTED_DIRECT_APPLY.has(firstAction!.action_type) &&
    firstAction!.verified_feasible;

  async function handleApply(act: RecommendedStaffAction) {
    setBusyActionId(act.action_id);
    try {
      const res = await applyRecommendedFixAction({
        sourceSnapshotVersion: snapshotVersion,
        date,
        actionType: act.action_type,
        targetBookingId: act.target_booking_id,
        proposedStaffId: act.proposed_staff_id,
        proposedResourceId: act.proposed_resource_id,
        proposedDriverId: act.proposed_driver_id,
        confirmCustomerApproval: !act.requires_customer_approval,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      onApplied(res.summary);
    } finally {
      setBusyActionId(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--cs-border)] bg-white/80 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                conflict.severity === "critical"
                  ? "bg-red-100 text-red-800"
                  : conflict.severity === "high"
                    ? "bg-amber-100 text-amber-800"
                    : conflict.severity === "warning"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {conflict.severity}
            </span>
            <span className="font-semibold text-[var(--cs-text)]">
              Act before {conflict.latest_useful_action_time}
            </span>
          </div>
          <p className="mt-1.5 text-[var(--cs-text-secondary)] leading-relaxed">
            {conflict.predicted_impact}
          </p>
        </div>
      </div>

      {firstAction && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cs-border)] pt-2">
          <span className="text-[11px] font-medium text-[var(--cs-text-muted)]">
            {firstAction.label}
          </span>
          {canApply && !firstAction.requires_customer_approval && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending || busyActionId !== null}
              onClick={() => handleApply(firstAction)}
              className="h-7 rounded-lg px-2.5 text-[11px] font-semibold"
            >
              {busyActionId === firstAction.action_id ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Wrench className="mr-1 size-3" />
              )}
              Apply Verified Fix
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function CrmOptimizationAssistantPanel({
  initialSummary = null,
  date,
  compact = true,
}: Props) {
  const [summary, setSummary] = useState<TieredCrmOperationsSummary | null>(initialSummary);
  const [expanded, setExpanded] = useState(
    Boolean(
      initialSummary &&
        (initialSummary.persistentActions.length > 0 ||
          initialSummary.earlyWarnings.length > 0)
    )
  );
  const [isPending, startTransition] = useTransition();

  function runCheck(syncAlerts = true) {
    startTransition(async () => {
      const res = await evaluateBranchOptimizationAction({ date, syncAlerts });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSummary(res.summary);
      setExpanded(true);
      const actionCount = res.summary.persistentActions.length;
      if (actionCount > 0) {
        toast.warning(`${actionCount} schedule risk(s) need CRM attention.`);
      } else {
        toast.success("Unified schedule check passed with zero critical collisions.");
      }
    });
  }

  const persistentCount = summary?.persistentActions.length ?? 0;
  const warningCount = summary?.earlyWarnings.length ?? 0;
  const oppCount = summary?.quietOpportunities.length ?? 0;

  return (
    <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#155A33]" />
          <h3 className="text-sm font-bold text-[var(--cs-text)]">
            Operations Assistant
          </h3>
          {summary && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {persistentCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                  <AlertTriangle className="size-3" />
                  {persistentCount} action
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  Clear
                </span>
              )}
              {warningCount > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                  {warningCount} warning{warningCount === 1 ? "" : "s"}
                </span>
              )}
              {oppCount > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  {oppCount} earlier slot{oppCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => runCheck(true)}
            className="h-8 rounded-xl px-3 text-xs font-semibold"
          >
            {isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Run Check
          </Button>
          {summary && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse optimization details" : "Expand optimization details"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--cs-border)] text-[var(--cs-text-muted)] hover:bg-black/5"
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </div>
      </div>

      {!summary && (
        <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
          Checks unified on-site therapist/room capacity, room turnovers, and traffic-aware Home Service transitions without blocking active workflows.
        </p>
      )}

      {summary && expanded && (
        <div className="mt-3 space-y-2.5">
          {summary.persistentActions.length === 0 &&
            summary.earlyWarnings.length === 0 &&
            summary.quietOpportunities.length === 0 && (
              <p className="text-xs text-[var(--cs-text-muted)]">
                All therapist, room, turnover, and Home Service commitments align cleanly ({summary.engineSource === "python_ortools" ? "OR-Tools Engine" : "Deterministic Local Check"}).
              </p>
            )}

          {summary.persistentActions.slice(0, compact ? 4 : 10).map((conflict) => (
            <ConflictItemRow
              key={conflict.dedupe_key}
              conflict={conflict}
              snapshotVersion={summary.sourceSnapshotVersion}
              date={date}
              isPending={isPending}
              onApplied={setSummary}
            />
          ))}

          {summary.earlyWarnings.slice(0, compact ? 3 : 6).map((conflict) => (
            <ConflictItemRow
              key={conflict.dedupe_key}
              conflict={conflict}
              snapshotVersion={summary.sourceSnapshotVersion}
              date={date}
              isPending={isPending}
              onApplied={setSummary}
            />
          ))}

          {summary.quietOpportunities.slice(0, 2).map((opp) => (
            <div
              key={opp.dedupe_key}
              className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-2.5 text-[11px] text-emerald-900"
            >
              <span className="font-semibold">Quiet opportunity: </span>
              {opp.predicted_impact}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
