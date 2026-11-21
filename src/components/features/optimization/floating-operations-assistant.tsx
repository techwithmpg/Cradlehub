"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Minus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  validCrmActionHrefForConflict,
  type TieredCrmOperationsSummary,
} from "@/lib/optimization/assistant-summary";
import type {
  PredictiveConflictItem,
  RecommendedStaffAction,
} from "@/lib/optimization/types";
import { OptimizationConflictCard } from "./optimization-conflict-card";
import {
  formatConflictIssueLabel,
  SUPPORTED_DIRECT_APPLY_ACTIONS,
  useCrmOptimizationAssistant,
} from "./use-crm-optimization-assistant";

export type OperationsAssistantContext =
  | "intake"
  | "bookings"
  | "dispatch"
  | "schedule"
  | "operations";

export type AssistantPromptAdapterInput = {
  context: OperationsAssistantContext;
  query: string;
  branchId?: string;
  date?: string;
  summary: TieredCrmOperationsSummary | null;
};

export type AssistantPromptAdapterOutput = {
  replyText: string;
  filterQuery?: string;
  triggerCheck?: boolean;
};

/**
 * Pluggable query/AI adapter:
 * - Today: deterministic local filtering + optimizer check triggers.
 * - Later: swap or wrap with an LLM endpoint without changing the UI.
 */
export type OperationsAssistantAdapter = {
  mode: "local-optimizer" | "llm-agent";
  ask: (input: AssistantPromptAdapterInput) => Promise<AssistantPromptAdapterOutput>;
};

const defaultLocalAdapter: OperationsAssistantAdapter = {
  mode: "local-optimizer",
  async ask({ context, query, summary }) {
    const trimmed = query.trim();
    const q = trimmed.toLowerCase();

    if (!trimmed) {
      return { replyText: "", filterQuery: "" };
    }

    if (q === "check" || q === "run check" || q === "refresh" || q === "optimize") {
      return {
        replyText: "Running unified schedule and dispatch optimization check…",
        triggerCheck: true,
      };
    }

    const all = summary ? [...summary.persistentActions, ...summary.earlyWarnings] : [];
    const matches = all.filter((c) => {
      const label = formatConflictIssueLabel(c.issue_type).toLowerCase();
      return (
        label.includes(q) ||
        c.predicted_impact.toLowerCase().includes(q) ||
        c.severity.toLowerCase().includes(q) ||
        c.recommended_actions.some((a) => a.label.toLowerCase().includes(q))
      );
    });

    return {
      replyText:
        matches.length > 0
          ? `Filtered to ${matches.length} ${context} finding${matches.length === 1 ? "" : "s"} matching "${trimmed}".`
          : `No findings matched "${trimmed}" in ${context}. Clear filter to view all ${all.length}.`,
      filterQuery: trimmed,
    };
  },
};

const CONTEXT_CONFIG: Record<
  OperationsAssistantContext,
  {
    label: string;
    placeholder: string;
    defaultTag: string;
  }
> = {
  intake: {
    label: "Intake context",
    placeholder: "Ask what needs attention...",
    defaultTag: "Intake",
  },
  bookings: {
    label: "Bookings context",
    placeholder: "Ask about bookings...",
    defaultTag: "Bookings",
  },
  dispatch: {
    label: "Dispatch context",
    placeholder: "Ask about dispatch...",
    defaultTag: "Dispatch",
  },
  schedule: {
    label: "Schedule context",
    placeholder: "Ask about schedule...",
    defaultTag: "Schedule",
  },
  operations: {
    label: "Operations context",
    placeholder: "Ask what needs attention...",
    defaultTag: "Operations",
  },
};

function isAllowedOperationsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/crm") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/owner")
  );
}

function deriveContextFromPathname(pathname: string | null): OperationsAssistantContext {
  if (!pathname) return "operations";
  if (pathname.startsWith("/crm/today")) return "intake";
  if (pathname.startsWith("/crm/bookings")) return "bookings";
  if (pathname.startsWith("/crm/dispatch")) return "dispatch";
  if (pathname.startsWith("/crm/schedule")) return "schedule";
  return "operations";
}

function contextTagForConflict(
  conflict: PredictiveConflictItem,
  fallbackTag: string
): string {
  const href = validCrmActionHrefForConflict(conflict);
  if (href.startsWith("/crm/dispatch")) return "Dispatch";
  if (href.startsWith("/crm/schedule")) return "Schedule";
  if (href.startsWith("/crm/bookings")) return "Bookings";
  return fallbackTag;
}

function secondaryActionLabel(
  conflict: PredictiveConflictItem,
  context: OperationsAssistantContext,
  href: string
): string {
  if (href.startsWith("/crm/dispatch")) return "Open Dispatch";
  if (href.startsWith("/crm/schedule")) return "Open Schedule";
  if (context === "intake") return "Review Booking";
  if (context === "dispatch") return "Review Routes";
  return "Review Booking";
}

export type OperationsAssistantBridgeProps = {
  context?: OperationsAssistantContext;
  initialSummary?: TieredCrmOperationsSummary | null;
  branchId?: string;
  date?: string;
  selectedBookingId?: string;
  onSelectBooking?: (bookingId: string) => void;
  onAfterMutation?: () => void;
  onSummaryChange?: (summary: TieredCrmOperationsSummary | null) => void;
};

type BridgeState = {
  context?: OperationsAssistantContext;
  initialSummary?: TieredCrmOperationsSummary | null;
  branchId?: string;
  date?: string;
  selectedBookingId?: string;
  onSelectBooking?: (bookingId: string) => void;
  onAfterMutation?: () => void;
  onSummaryChange?: (summary: TieredCrmOperationsSummary | null) => void;
};

type OperationsAssistantStoreValue = {
  defaultBranchId?: string;
  bridge: BridgeState;
};

const OperationsAssistantStoreContext = createContext<OperationsAssistantStoreValue | null>(null);
const OperationsAssistantSetterContext = createContext<React.Dispatch<React.SetStateAction<BridgeState>> | null>(null);

export function OperationsAssistantProvider({
  branchId,
  children,
}: {
  branchId?: string;
  children: ReactNode;
}) {
  const [bridge, setBridge] = useState<BridgeState>({});

  const value = useMemo<OperationsAssistantStoreValue>(
    () => ({
      defaultBranchId: branchId,
      bridge,
    }),
    [branchId, bridge]
  );

  return (
    <OperationsAssistantSetterContext.Provider value={setBridge}>
      <OperationsAssistantStoreContext.Provider value={value}>
        {children}
        <PersistentOperationsAssistant />
      </OperationsAssistantStoreContext.Provider>
    </OperationsAssistantSetterContext.Provider>
  );
}

/**
 * Page-level connector: feeds initialSummary, date, selectedBookingId, and callbacks
 * from Intake, Bookings, Dispatch, or Schedule into the single persistent assistant.
 */
export function OperationsAssistantBridge({
  context,
  initialSummary,
  branchId,
  date,
  selectedBookingId,
  onSelectBooking,
  onAfterMutation,
  onSummaryChange,
}: OperationsAssistantBridgeProps) {
  const setBridge = useContext(OperationsAssistantSetterContext);
  const callbacksRef = useRef({
    onSelectBooking,
    onAfterMutation,
    onSummaryChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelectBooking,
      onAfterMutation,
      onSummaryChange,
    };
  });

  const stableSelectBooking = useCallback((bookingId: string) => {
    callbacksRef.current.onSelectBooking?.(bookingId);
  }, []);

  const stableAfterMutation = useCallback(() => {
    callbacksRef.current.onAfterMutation?.();
  }, []);

  const stableSummaryChange = useCallback((summary: TieredCrmOperationsSummary | null) => {
    callbacksRef.current.onSummaryChange?.(summary);
  }, []);

  const hasSelectBooking = Boolean(onSelectBooking);
  const hasAfterMutation = Boolean(onAfterMutation);
  const hasSummaryChange = Boolean(onSummaryChange);

  useEffect(() => {
    if (!setBridge) return;
    setBridge((prev) => {
      const next: BridgeState = {
        context,
        initialSummary,
        branchId,
        date,
        selectedBookingId,
        onSelectBooking: hasSelectBooking ? stableSelectBooking : undefined,
        onAfterMutation: hasAfterMutation ? stableAfterMutation : undefined,
        onSummaryChange: hasSummaryChange ? stableSummaryChange : undefined,
      };
      if (
        prev.context === next.context &&
        prev.initialSummary === next.initialSummary &&
        prev.branchId === next.branchId &&
        prev.date === next.date &&
        prev.selectedBookingId === next.selectedBookingId &&
        prev.onSelectBooking === next.onSelectBooking &&
        prev.onAfterMutation === next.onAfterMutation &&
        prev.onSummaryChange === next.onSummaryChange
      ) {
        return prev;
      }
      return next;
    });
  }, [
    setBridge,
    context,
    initialSummary,
    branchId,
    date,
    selectedBookingId,
    hasSelectBooking,
    hasAfterMutation,
    hasSummaryChange,
    stableSelectBooking,
    stableAfterMutation,
    stableSummaryChange,
  ]);

  useEffect(() => {
    if (!setBridge) return;
    return () => {
      setBridge((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    };
  }, [setBridge]);

  return null;
}

export function PersistentOperationsAssistant({
  adapter = defaultLocalAdapter,
}: {
  adapter?: OperationsAssistantAdapter;
}) {
  const pathname = usePathname();
  const isOperationalRoute = isAllowedOperationsPath(pathname);
  const store = useContext(OperationsAssistantStoreContext);
  const bridge = store?.bridge ?? {};
  const context: OperationsAssistantContext =
    bridge.context ?? deriveContextFromPathname(pathname);
  const branchId = bridge.branchId ?? store?.defaultBranchId;
  const date = bridge.date;
  const selectedBookingId = bridge.selectedBookingId;
  const onSelectBooking = bridge.onSelectBooking;
  const onAfterMutation = bridge.onAfterMutation;
  const onSummaryChange = bridge.onSummaryChange;

  const {
    summary,
    isPending,
    busyActionKey,
    runManualCheck,
    applyRecommendedAction,
  } = useCrmOptimizationAssistant({
    initialSummary: bridge.initialSummary ?? null,
    branchId,
    date,
    toastEarlyWarnings: context === "intake",
    onAfterMutation,
  });

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [onSummaryChange, summary]);

  const [isOpen, setIsOpen] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [assistantNote, setAssistantNote] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [expandedDetailKeys, setExpandedDetailKeys] = useState<Record<string, boolean>>({});

  const cfg = CONTEXT_CONFIG[context];

  const allFindings = useMemo(() => {
    if (!summary || summary.status === "unavailable") return [];
    const combined = [...summary.persistentActions, ...summary.earlyWarnings];
    if (!selectedBookingId) return combined;
    const matching = combined.filter((c) => c.affected_booking_ids.includes(selectedBookingId));
    const rest = combined.filter((c) => !c.affected_booking_ids.includes(selectedBookingId));
    return [...matching, ...rest];
  }, [summary, selectedBookingId]);

  const visibleFindings = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return allFindings;
    return allFindings.filter((c) => {
      const label = formatConflictIssueLabel(c.issue_type).toLowerCase();
      return (
        label.includes(q) ||
        c.predicted_impact.toLowerCase().includes(q) ||
        c.severity.toLowerCase().includes(q) ||
        c.recommended_actions.some((a) => a.label.toLowerCase().includes(q))
      );
    });
  }, [allFindings, filterQuery]);

  const activeCount = allFindings.length;
  const oppCount =
    summary?.status === "unavailable" ? 0 : (summary?.quietOpportunities.length ?? 0);
  const badgeCount = activeCount > 0 ? activeCount : oppCount;
  const isUnavailable = summary?.status === "unavailable";
  const isDegraded = Boolean(summary?.degradedReason) && !isUnavailable;

  async function handlePromptSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const raw = promptInput;
    setPromptInput("");
    setIsAsking(true);
    try {
      const res = await adapter.ask({
        context,
        query: raw,
        branchId,
        date,
        summary,
      });
      setFilterQuery(res.filterQuery ?? "");
      setAssistantNote(res.replyText || null);
      if (res.triggerCheck) {
        runManualCheck(true);
      }
    } finally {
      setIsAsking(false);
    }
  }

  function handleResolveNow(
    conflict: PredictiveConflictItem,
    firstAction: RecommendedStaffAction | undefined
  ) {
    const canDirectApply =
      Boolean(firstAction) &&
      SUPPORTED_DIRECT_APPLY_ACTIONS.has(firstAction!.action_type) &&
      firstAction!.verified_feasible &&
      !firstAction!.requires_customer_approval;

    if (canDirectApply && firstAction) {
      void applyRecommendedAction(conflict, firstAction);
      return;
    }

    setExpandedDetailKeys((prev) => ({
      ...prev,
      [conflict.dedupe_key]: !prev[conflict.dedupe_key],
    }));
  }

  if (!isOperationalRoute) return null;

  return (
    <div
      data-testid="floating-operations-assistant"
      data-assistant-context={context}
      data-ops-status={summary?.status ?? "loading"}
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 md:bottom-7 md:right-7"
    >
      {isOpen && (
        <section
          role="dialog"
          aria-label="Operations Assistant"
          className={cn(
            "flex w-[calc(100vw-2rem)] max-w-[410px] flex-col overflow-hidden rounded-[22px] border border-[#D6E4DA] bg-[#F7FBF8] shadow-2xl",
            "animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-200"
          )}
          style={{ maxHeight: "min(76vh, 620px)" }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#E3EDE6] bg-[#F7FBF8] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#DFF2E6] text-[#155A33]">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-bold leading-tight text-[#1A241E]">
                  Operations Assistant
                </h2>
                <p className="truncate text-xs font-medium text-[#5B6B61]">
                  {!summary
                    ? `Syncing · ${cfg.label}`
                    : `${activeCount} active finding${activeCount === 1 ? "" : "s"} · ${cfg.label}`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => runManualCheck(true)}
                disabled={isPending}
                title="Re-evaluate optimizer"
                aria-label="Run optimizer check"
                className="inline-flex size-7 items-center justify-center rounded-full border border-[#DCE6DF] bg-white text-[#3F4E45] transition hover:bg-[#EEF6F0] disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize"
                aria-label="Minimize Operations Assistant"
                className="inline-flex size-7 items-center justify-center rounded-full border border-[#DCE6DF] bg-white text-[#3F4E45] transition hover:bg-[#EEF6F0]"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterQuery("");
                  setAssistantNote(null);
                  setIsOpen(false);
                }}
                title="Close"
                aria-label="Close Operations Assistant"
                className="inline-flex size-7 items-center justify-center rounded-full border border-[#DCE6DF] bg-white text-[#3F4E45] transition hover:bg-[#EEF6F0]"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
            {(isUnavailable || isDegraded) && summary?.degradedReason && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <p>{summary.degradedReason}</p>
                  {isUnavailable && (
                    <button
                      type="button"
                      onClick={() => runManualCheck(true)}
                      className="mt-1 font-bold text-[#155A33] underline"
                    >
                      Retry check
                    </button>
                  )}
                </div>
              </div>
            )}

            {assistantNote && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#CFE5D6] bg-white px-3 py-2 text-xs text-[#1E3528]">
                <span>{assistantNote}</span>
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterQuery("");
                      setAssistantNote(null);
                    }}
                    className="shrink-0 font-bold text-[#155A33] underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {!summary && (
              <div className="flex items-center gap-2 rounded-2xl border border-[#E2ECE5] bg-white p-3.5 text-xs text-[#5B6B61]">
                <Loader2 className="size-4 animate-spin text-[#155A33]" />
                <span>Checking schedule, room, and dispatch commitments…</span>
              </div>
            )}

            {summary && !isUnavailable && visibleFindings.length === 0 && (
              <div className="rounded-2xl border border-[#DCE9E0] bg-white p-4 text-xs shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-[#155A33]">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    {filterQuery
                      ? "No findings match your filter"
                      : "All clear in " + cfg.label.replace(" context", "")}
                  </span>
                </div>
                <p className="mt-1 text-[#5B6B61]">
                  {filterQuery
                    ? "Clear the filter above or run a fresh optimizer check."
                    : "Schedules, rooms, and Home Service routes align with branch rules."}
                </p>
              </div>
            )}

            {visibleFindings.map((conflict, idx) => {
              const firstAction = conflict.recommended_actions[0];
              const actionKey = firstAction
                ? `${conflict.dedupe_key}:${firstAction.action_id}`
                : null;
              const isBusy = Boolean(actionKey && busyActionKey === actionKey);
              const href = validCrmActionHrefForConflict(conflict);
              const firstBookingId = conflict.affected_booking_ids[0] ?? null;
              const isCritical = conflict.severity === "critical" || conflict.severity === "high";
              const tagLabel = contextTagForConflict(conflict, cfg.defaultTag);
              const detailExpanded = Boolean(expandedDetailKeys[conflict.dedupe_key]);

              return (
                <div
                  key={`${conflict.dedupe_key}-${idx}`}
                  data-testid="ops-assistant-finding-card"
                  data-conflict-key={conflict.dedupe_key}
                  className="rounded-2xl border border-[#E2E8E4] bg-white p-3.5 shadow-2xs"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                        isCritical
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                      )}
                    >
                      <AlertTriangle className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-[13px] font-bold text-[#1A241E]">
                            {formatConflictIssueLabel(conflict.issue_type)}
                          </h3>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                              isCritical
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-900"
                            )}
                          >
                            {isCritical ? "Critical" : "Warning"}
                          </span>
                        </div>
                        <span className="rounded-full border border-[#E2E8E4] bg-[#F8FAF9] px-2 py-0.5 text-[10px] font-semibold text-[#5B6B61]">
                          {tagLabel}
                        </span>
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-[#4C5951]">
                        {conflict.predicted_impact}
                      </p>

                      {firstAction && (
                        <p className="mt-1 text-[11px] font-medium text-[#155A33]">
                          Suggested: {firstAction.label}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending || isBusy}
                          onClick={() => handleResolveNow(conflict, firstAction)}
                          className="h-8 rounded-lg bg-[#155A33] px-3 text-xs font-semibold text-white hover:bg-[#0F4426]"
                        >
                          {isBusy ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : firstAction &&
                            SUPPORTED_DIRECT_APPLY_ACTIONS.has(firstAction.action_type) &&
                            firstAction.verified_feasible &&
                            !firstAction.requires_customer_approval ? (
                            <Wrench className="mr-1.5 size-3.5" />
                          ) : null}
                          <span>Resolve now</span>
                          <ArrowRight className="ml-1.5 size-3.5" />
                        </Button>

                        {onSelectBooking &&
                        firstBookingId &&
                        !href.startsWith("/crm/dispatch") ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectBooking(firstBookingId)}
                            className="h-8 rounded-lg border-[#DCE4DF] bg-white px-3 text-xs font-semibold text-[#1A241E] hover:bg-[#F4F8F5]"
                          >
                            {secondaryActionLabel(conflict, context, href)}
                          </Button>
                        ) : (
                          <Link
                            href={href}
                            className="inline-flex h-8 items-center rounded-lg border border-[#DCE4DF] bg-white px-3 text-xs font-semibold text-[#1A241E] transition hover:bg-[#F4F8F5]"
                          >
                            {secondaryActionLabel(conflict, context, href)}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {detailExpanded && (
                    <div className="mt-3 border-t border-[#E6ECE8] pt-2.5">
                      <OptimizationConflictCard
                        conflict={conflict}
                        busyActionKey={busyActionKey}
                        disabled={isPending}
                        onApply={applyRecommendedAction}
                        onSelectBooking={onSelectBooking}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {summary &&
              !isUnavailable &&
              summary.quietOpportunities.slice(0, 2).map((opp, idx) => {
                const oppHref = validCrmActionHrefForConflict(opp);
                const oppBookingId = opp.affected_booking_ids[0] ?? null;
                return (
                  <div
                    key={`${opp.dedupe_key}-opp-${idx}`}
                    className="rounded-2xl border border-[#E2E8E4] bg-white p-3.5 shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                        <Info className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <h3 className="text-[13px] font-bold text-[#1A241E]">
                            {formatConflictIssueLabel(opp.issue_type)}
                          </h3>
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                            Info
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[#4C5951]">
                          {opp.predicted_impact}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {oppBookingId && onSelectBooking ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onSelectBooking(oppBookingId)}
                              className="h-8 rounded-lg bg-[#155A33] px-3 text-xs font-semibold text-white hover:bg-[#0F4426]"
                            >
                              <span>Open Booking</span>
                              <ArrowRight className="ml-1.5 size-3.5" />
                            </Button>
                          ) : (
                            <Link
                              href={oppHref}
                              className="inline-flex h-8 items-center rounded-lg bg-[#155A33] px-3 text-xs font-semibold text-white transition hover:bg-[#0F4426]"
                            >
                              <span>Review Opportunity</span>
                              <ArrowRight className="ml-1.5 size-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <form
            onSubmit={handlePromptSubmit}
            className="border-t border-[#E3EDE6] bg-white px-3 py-2.5"
          >
            <div className="flex items-center gap-2 rounded-xl border border-[#DCE6DF] bg-[#F8FBF9] px-2.5 py-1.5 focus-within:border-[#155A33] focus-within:bg-white">
              <Sparkles className="size-4 shrink-0 text-[#155A33]" />
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={cfg.placeholder}
                aria-label={cfg.placeholder}
                className="min-w-0 flex-1 bg-transparent text-xs text-[#1A241E] outline-none placeholder:text-[#6B7B71]"
              />
              <button
                type="submit"
                disabled={isAsking}
                aria-label="Send prompt"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#155A33] text-white transition hover:bg-[#0F4426] disabled:opacity-50"
              >
                {isAsking ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? "Minimize Operations Assistant"
            : `Open Operations Assistant (${badgeCount} active)`
        }
        className="relative flex size-14 items-center justify-center rounded-full bg-[#155A33] text-white shadow-[0_8px_24px_rgba(21,90,51,0.38)] transition hover:scale-105 hover:bg-[#0F4426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155A33] focus-visible:ring-offset-2"
      >
        <Sparkles className="size-6" />
        {badgeCount > 0 && (
          <span
            data-testid="ops-assistant-badge"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#D93829] px-1 text-[11px] font-bold leading-none text-white"
          >
            {badgeCount}
          </span>
        )}
      </button>
    </div>
  );
}

/**
 * Backward-compatible alias that delegates to OperationsAssistantBridge when inside
 * OperationsAssistantProvider, or renders standalone if mounted outside CrmLayout.
 */
export function FloatingOperationsAssistant(props: OperationsAssistantBridgeProps) {
  const store = useContext(OperationsAssistantStoreContext);
  if (store) {
    return <OperationsAssistantBridge {...props} />;
  }
  return (
    <OperationsAssistantProvider branchId={props.branchId}>
      <OperationsAssistantBridge {...props} />
    </OperationsAssistantProvider>
  );
}


