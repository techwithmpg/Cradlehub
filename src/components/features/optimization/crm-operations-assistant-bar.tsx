"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TieredCrmOperationsSummary } from "@/lib/optimization/assistant-summary";
import type { PredictiveConflictItem } from "@/lib/optimization/types";
import { OptimizationConflictCard } from "./optimization-conflict-card";
import {
  formatConflictIssueLabel,
  useCrmOptimizationAssistant,
} from "./use-crm-optimization-assistant";

type BarProps = {
  initialSummary?: TieredCrmOperationsSummary | null;
  branchId?: string;
  date?: string;
  surface: "intake" | "bookings";
  selectedBookingId?: string;
  onSelectBooking?: (bookingId: string) => void;
  onAfterMutation?: () => void;
  onSummaryChange?: (summary: TieredCrmOperationsSummary | null) => void;
};

export function collectBookingConflictsMap(
  summary: TieredCrmOperationsSummary | null | undefined
): Map<string, PredictiveConflictItem[]> {
  const map = new Map<string, PredictiveConflictItem[]>();
  if (!summary) return map;
  for (const conflict of [...summary.persistentActions, ...summary.earlyWarnings]) {
    for (const bookingId of conflict.affected_booking_ids) {
      const list = map.get(bookingId) ?? [];
      list.push(conflict);
      map.set(bookingId, list);
    }
  }
  return map;
}

export function CrmOperationsAssistantBar({
  initialSummary = null,
  branchId,
  date,
  surface,
  selectedBookingId,
  onSelectBooking,
  onAfterMutation,
  onSummaryChange,
}: BarProps) {
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
    toastEarlyWarnings: surface === "intake",
    onAfterMutation,
  });

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [onSummaryChange, summary]);

  const selectedBookingMatches =
    surface === "bookings" && selectedBookingId && summary
      ? [...summary.persistentActions, ...summary.earlyWarnings].filter((c) =>
          c.affected_booking_ids.includes(selectedBookingId)
        )
      : [];
  const selectedAlreadySpotlighted = Boolean(
    selectedBookingId &&
      ((initialSummary &&
        [...initialSummary.persistentActions, ...initialSummary.earlyWarnings].some((c) =>
          c.affected_booking_ids.includes(selectedBookingId)
        )) ||
        selectedBookingMatches.length > 0)
  );
  const [expanded, setExpanded] = useState(
    Boolean(initialSummary && initialSummary.persistentActions.length > 0 && !selectedAlreadySpotlighted)
  );
  const [showQuiet, setShowQuiet] = useState(false);

  if (!summary) {
    return (
      <div
        data-testid="crm-ops-assistant-bar"
        data-ops-status="loading"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--cs-border-soft)] bg-white px-3.5 py-2 text-xs text-[var(--cs-text-muted)]"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-[#1F4E33]" />
          <span>Checking schedule and dispatch commitments…</span>
        </div>
      </div>
    );
  }

  const persistentCount = summary.persistentActions.length;
  const warningCount = summary.earlyWarnings.length;
  const oppCount = summary.quietOpportunities.length;
  const isUnavailable = summary.status === "unavailable";
  const isDegraded = Boolean(summary.degradedReason) && !isUnavailable;

  const containerStyle = isUnavailable
    ? "border-stone-300 bg-stone-50"
    : persistentCount > 0
      ? "border-amber-300 bg-[#FFFBF2]"
      : warningCount > 0 || isDegraded
        ? "border-amber-200 bg-amber-50/70"
        : "border-[#CFE5D6] bg-[#EEF7F1]/75";

  return (
    <div className="space-y-2.5">
      <section
        aria-label="Operations Assistant"
        data-testid="crm-ops-assistant-bar"
        data-ops-status={summary.status}
        data-snapshot-version={summary.sourceSnapshotVersion}
        className={`rounded-xl border px-3.5 py-2.5 shadow-2xs transition-colors ${containerStyle}`}
      >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          {isUnavailable ? (
            <ShieldAlert className="size-4 shrink-0 text-stone-700" />
          ) : persistentCount > 0 || warningCount > 0 || isDegraded ? (
            <AlertTriangle className="size-4 shrink-0 text-amber-700" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-[#1F4E33]" />
          )}

          <span className="font-bold text-[var(--cs-text)]">Operations Assistant</span>

          {isUnavailable ? (
            <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[11px] font-semibold text-stone-800">
              Unavailable · Retry required
            </span>
          ) : (
            <>
              {persistentCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
                  {persistentCount} action needed
                </span>
              )}
              {warningCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                  {warningCount} early warning{warningCount === 1 ? "" : "s"}
                </span>
              )}
              {persistentCount === 0 && warningCount === 0 && !isDegraded && (
                <span className="font-medium text-[#1F4E33]">
                  All clear · Schedules, rooms &amp; Home Service aligned
                </span>
              )}
              {isDegraded && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  Degraded · Local safety checks only
                </span>
              )}
              <span className="hidden text-[11px] text-[var(--cs-text-muted)] sm:inline">
                ·{" "}
                {summary.engineSource === "python_ortools"
                  ? "OR-Tools Live"
                  : isDegraded
                    ? "Fallback Active"
                    : "Local Safety Checks"}
              </span>
            </>
          )}

          {oppCount > 0 && !isUnavailable && (
            <button
              type="button"
              onClick={() => setShowQuiet((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-[#CFE5D6] bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[#1F4E33] hover:bg-white"
            >
              <Sparkles className="size-3" />
              {oppCount} suggestion{oppCount === 1 ? "" : "s"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {surface === "intake" && (persistentCount > 0 || warningCount > 0) && (
            <Link
              href="/crm/schedule"
              className="hidden h-7 items-center rounded-lg border border-[var(--cs-border-soft)] bg-white px-2.5 text-[11px] font-semibold text-[var(--cs-text-secondary)] hover:bg-[#FAF8F5] sm:inline-flex"
            >
              Full Schedule
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => runManualCheck(true)}
            className="h-7 rounded-lg bg-white px-2.5 text-[11px] font-semibold"
          >
            {isPending ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3" />
            )}
            {isUnavailable ? "Retry" : "Check"}
          </Button>
          {(persistentCount > 0 || warningCount > 0) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse operational alerts" : "Expand operational alerts"}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--cs-border-soft)] bg-white px-2 text-[11px] font-semibold text-[var(--cs-text-secondary)] hover:bg-[#FAF8F5]"
            >
              <span>{expanded ? "Hide" : "Review"}</span>
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {(isUnavailable || isDegraded) && summary.degradedReason && (
        <p className="mt-1.5 text-[11px] text-[var(--cs-text-secondary)]">
          {summary.degradedReason}
        </p>
      )}

      {showQuiet && oppCount > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-[#CFE5D6]/80 pt-2">
          {summary.quietOpportunities.slice(0, 3).map((opp) => (
            <div
              key={opp.dedupe_key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[#CFE5D6] bg-white/80 px-2.5 py-1.5 text-[11px] text-[#1F4E33]"
            >
              <span>
                <strong>Optional fit:</strong> {opp.predicted_impact}
              </span>
              {opp.affected_booking_ids[0] && onSelectBooking ? (
                <button
                  type="button"
                  onClick={() => onSelectBooking(opp.affected_booking_ids[0]!)}
                  className="font-bold underline hover:no-underline"
                >
                  Open booking
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {!expanded && (persistentCount > 0 || warningCount > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--cs-text-secondary)]">
          <span className="truncate">
            <strong>
              {formatConflictIssueLabel(
                (summary.persistentActions[0] ?? summary.earlyWarnings[0])!.issue_type
              )}
              :
            </strong>{" "}
            {(summary.persistentActions[0] ?? summary.earlyWarnings[0])!.predicted_impact}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 font-bold text-[#1F4E33] underline hover:no-underline"
          >
            Resolve now
          </button>
        </div>
      )}

      {expanded && (persistentCount > 0 || warningCount > 0) && (
        <div className="mt-2.5 space-y-2 border-t border-amber-200/80 pt-2.5">
          {summary.persistentActions.slice(0, surface === "intake" ? 4 : 6).map((conflict) => (
            <OptimizationConflictCard
              key={conflict.dedupe_key}
              conflict={conflict}
              busyActionKey={busyActionKey}
              disabled={isPending}
              onApply={applyRecommendedAction}
              onSelectBooking={onSelectBooking}
              compact={surface === "bookings"}
            />
          ))}

          {summary.earlyWarnings.slice(0, 3).map((conflict) => (
            <OptimizationConflictCard
              key={conflict.dedupe_key}
              conflict={conflict}
              busyActionKey={busyActionKey}
              disabled={isPending}
              onApply={applyRecommendedAction}
              onSelectBooking={onSelectBooking}
              compact
            />
          ))}
        </div>
      )}
      </section>

      {selectedBookingMatches.length > 0 ? (
        <div
          data-testid="selected-booking-optimization-notice"
          className="space-y-2 rounded-xl border border-amber-300 bg-[#FFFBF2] p-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
            <AlertTriangle className="size-4 text-amber-700" />
            <span>
              Selected Booking Alert ({selectedBookingMatches.length} operational finding
              {selectedBookingMatches.length === 1 ? "" : "s"})
            </span>
          </div>
          {selectedBookingMatches.map((conflict) => (
            <OptimizationConflictCard
              key={conflict.dedupe_key}
              conflict={conflict}
              busyActionKey={busyActionKey}
              disabled={isPending}
              onApply={applyRecommendedAction}
              compact
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BookingOptimizationNotice({
  bookingId,
  initialSummary,
  branchId,
  date,
  onAfterMutation,
}: {
  bookingId?: string;
  initialSummary?: TieredCrmOperationsSummary | null;
  branchId?: string;
  date?: string;
  onAfterMutation?: () => void;
}) {
  const { summary, isPending, busyActionKey, applyRecommendedAction } =
    useCrmOptimizationAssistant({
      initialSummary,
      branchId,
      date,
      toastEarlyWarnings: false,
      onAfterMutation,
    });

  if (!bookingId || !summary) return null;

  const matching = [...summary.persistentActions, ...summary.earlyWarnings].filter((c) =>
    c.affected_booking_ids.includes(bookingId)
  );
  if (matching.length === 0) return null;

  return (
    <div
      data-testid="selected-booking-optimization-notice"
      className="space-y-2 rounded-xl border border-amber-300 bg-[#FFFBF2] p-3"
    >
      <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
        <AlertTriangle className="size-4 text-amber-700" />
        <span>
          Selected Booking Alert ({matching.length} operational finding
          {matching.length === 1 ? "" : "s"})
        </span>
      </div>
      {matching.map((conflict) => (
        <OptimizationConflictCard
          key={conflict.dedupe_key}
          conflict={conflict}
          busyActionKey={busyActionKey}
          disabled={isPending}
          onApply={applyRecommendedAction}
          compact
        />
      ))}
    </div>
  );
}
