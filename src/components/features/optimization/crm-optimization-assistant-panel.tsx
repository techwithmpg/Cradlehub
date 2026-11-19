"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TieredCrmOperationsSummary } from "@/lib/optimization/assistant-summary";
import { OptimizationConflictCard } from "./optimization-conflict-card";
import { useCrmOptimizationAssistant } from "./use-crm-optimization-assistant";

type Props = {
  initialSummary?: TieredCrmOperationsSummary | null;
  branchId?: string;
  date?: string;
  compact?: boolean;
};

export function CrmOptimizationAssistantPanel({
  initialSummary = null,
  branchId,
  date,
  compact = true,
}: Props) {
  const {
    summary,
    isPending,
    busyActionKey,
    runManualCheck,
    applyRecommendedAction,
  } = useCrmOptimizationAssistant({
    initialSummary,
    branchId,
    date,
    toastEarlyWarnings: false,
  });

  const [expanded, setExpanded] = useState(
    Boolean(
      initialSummary &&
        (initialSummary.persistentActions.length > 0 ||
          initialSummary.earlyWarnings.length > 0 ||
          initialSummary.status === "degraded" ||
          initialSummary.status === "unavailable")
    )
  );

  const persistentCount = summary?.persistentActions.length ?? 0;
  const warningCount = summary?.earlyWarnings.length ?? 0;
  const oppCount = summary?.quietOpportunities.length ?? 0;
  const isUnavailable = summary?.status === "unavailable";
  const isDegraded = Boolean(summary?.degradedReason) && !isUnavailable;

  return (
    <section
      data-testid="crm-optimization-panel"
      data-ops-status={summary?.status ?? "loading"}
      className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isUnavailable ? (
            <ShieldAlert className="size-4 text-stone-700" />
          ) : (
            <Sparkles className="size-4 text-[#155A33]" />
          )}
          <h3 className="text-sm font-bold text-[var(--cs-text)]">Operations Assistant</h3>
          {summary && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {isUnavailable ? (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 font-semibold text-stone-800">
                  Unavailable
                </span>
              ) : persistentCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                  <AlertTriangle className="size-3" />
                  {persistentCount} action
                </span>
              ) : isDegraded ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                  <AlertTriangle className="size-3" />
                  Degraded · Local Safety Only
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  Clear
                </span>
              )}
              {warningCount > 0 && !isUnavailable && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                  {warningCount} warning{warningCount === 1 ? "" : "s"}
                </span>
              )}
              {oppCount > 0 && !isUnavailable && (
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
            onClick={() => {
              setExpanded(true);
              runManualCheck(true);
            }}
            className="h-8 rounded-xl px-3 text-xs font-semibold"
          >
            {isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            {isUnavailable ? "Retry Check" : "Run Check"}
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
          Checks unified on-site therapist/room capacity, room turnovers, and traffic-aware Home
          Service transitions without blocking active workflows.
        </p>
      )}

      {summary && (isUnavailable || isDegraded) && summary.degradedReason && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
          {summary.degradedReason}
        </p>
      )}

      {summary && !isUnavailable && expanded && (
        <div className="mt-3 space-y-2.5">
          {summary.persistentActions.length === 0 &&
            summary.earlyWarnings.length === 0 &&
            summary.quietOpportunities.length === 0 &&
            !isDegraded && (
              <p className="text-xs text-[var(--cs-text-muted)]">
                All therapist, room, turnover, and Home Service commitments align cleanly (
                {summary.engineSource === "python_ortools"
                  ? "OR-Tools Engine"
                  : "Local Safety Checks"}
                ).
              </p>
            )}

          {summary.persistentActions.slice(0, compact ? 4 : 10).map((conflict) => (
            <OptimizationConflictCard
              key={conflict.dedupe_key}
              conflict={conflict}
              busyActionKey={busyActionKey}
              disabled={isPending}
              onApply={applyRecommendedAction}
              compact={compact}
            />
          ))}

          {summary.earlyWarnings.slice(0, compact ? 3 : 6).map((conflict) => (
            <OptimizationConflictCard
              key={conflict.dedupe_key}
              conflict={conflict}
              busyActionKey={busyActionKey}
              disabled={isPending}
              onApply={applyRecommendedAction}
              compact={compact}
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
