"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  applyRecommendedFixAction,
  evaluateBranchOptimizationAction,
  type ApplyRecommendedFixResult,
} from "@/lib/actions/optimization-actions";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import {
  notifyOptimizationChanged,
  subscribeOptimizationSyncChannel,
} from "@/lib/optimization/client-events";
import {
  validCrmActionHrefForConflict,
  type TieredCrmOperationsSummary,
} from "@/lib/optimization/assistant-summary";
import type {
  PredictiveConflictItem,
  RecommendedStaffAction,
} from "@/lib/optimization/types";

export const SUPPORTED_DIRECT_APPLY_ACTIONS = new Set([
  "swap_therapist",
  "assign_therapist",
  "reassign_room",
  "assign_room",
  "assign_driver",
  "reassign_collection_driver",
  "prioritize_room_turnover",
]);

function canToastSafelyInBrowser(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  if (
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
    )
  ) {
    return false;
  }
  const active = document.activeElement;
  return !(
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}

export function formatConflictIssueLabel(issueType: PredictiveConflictItem["issue_type"]): string {
  switch (issueType) {
    case "home_service_to_onsite_collision":
      return "Home -> On-Site Risk";
    case "onsite_to_home_service_collision":
      return "On-Site -> Home Risk";
    case "driver_route_ripple":
      return "Driver Route Ripple";
    case "driver_unassigned_risk":
      return "Driver Needed";
    case "therapist_unassigned_risk":
      return "Therapist Needed";
    case "room_capacity_bottleneck":
      return "Room Conflict";
    case "room_turnover_collision":
      return "Room Turnover Risk";
    case "session_overrun_ripple":
      return "Session Overrun";
    case "location_or_gps_degraded":
      return "Location / GPS Review";
    case "rule_drift_or_cross_branch_gap":
      return "Branch Rule Alignment";
    case "earlier_slot_opportunity":
      return "Earlier Slot Option";
    default:
      return "Schedule Alert";
  }
}

export function useCrmOptimizationAssistant(params: {
  initialSummary?: TieredCrmOperationsSummary | null;
  branchId?: string;
  date?: string;
  toastEarlyWarnings?: boolean;
  onAfterMutation?: () => void;
}) {
  const { initialSummary = null, branchId, date, toastEarlyWarnings = false, onAfterMutation } =
    params;
  const router = useRouter();
  const [summary, setSummary] = useState<TieredCrmOperationsSummary | null>(initialSummary);
  const [isSyncing, setIsSyncing] = useState(false);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mountedRef = useRef(true);
  const prevInitialRef = useRef(initialSummary);
  const abortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyInFlightRef = useRef(false);
  const summaryEpochRef = useRef(0);
  const seenEarlyKeysRef = useRef<Set<string>>(
    new Set((initialSummary?.earlyWarnings ?? []).map((item) => item.dedupe_key))
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  if (prevInitialRef.current !== initialSummary) {
    prevInitialRef.current = initialSummary;
    if (initialSummary) {
      setSummary(initialSummary);
    }
  }

  const resolvedBranchId = branchId ?? summary?.branchId;
  const resolvedDate = date ?? summary?.date;

  // Present restrained Level B toast ONLY when newly detected in active workspace and safe.
  useEffect(() => {
    if (!toastEarlyWarnings || !summary) return;
    if (summary.status === "unavailable") return;
    const unseen = summary.earlyWarnings.filter(
      (item) => !seenEarlyKeysRef.current.has(item.dedupe_key)
    );
    for (const item of unseen) {
      seenEarlyKeysRef.current.add(item.dedupe_key);
    }
    if (unseen.length === 0 || !canToastSafelyInBrowser()) return;

    const top = unseen[0]!;
    const href = validCrmActionHrefForConflict(top);
    toast.warning(`${formatConflictIssueLabel(top.issue_type)} (${top.latest_useful_action_time})`, {
      id: `opt-warn:${top.dedupe_key}`,
      description: top.predicted_impact,
      duration: 7_000,
      action: {
        label: href.includes("dispatch") ? "Open Dispatch" : "Review",
        onClick: () => router.push(href),
      },
    });
  }, [toastEarlyWarnings, summary, router]);

  const fetchLatestSummary = useCallback(async () => {
    if (!mountedRef.current || applyInFlightRef.current) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const epoch = summaryEpochRef.current;
    setIsSyncing(true);

    try {
      const sp = new URLSearchParams();
      if (resolvedDate) sp.set("date", resolvedDate);
      if (resolvedBranchId) sp.set("branchId", resolvedBranchId);

      const resp = await fetch(`/api/optimization/evaluate?${sp.toString()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        applyInFlightRef.current ||
        summaryEpochRef.current !== epoch
      ) {
        return;
      }

      if (!resp.ok) {
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                status: "unavailable",
                degradedReason:
                  "Operations Assistant could not refresh right now. Retrying automatically on next change.",
              }
            : null
        );
        return;
      }

      const json = (await resp.json()) as {
        ok?: boolean;
        summary?: TieredCrmOperationsSummary;
      };
      if (
        mountedRef.current &&
        !applyInFlightRef.current &&
        summaryEpochRef.current === epoch &&
        json?.summary
      ) {
        setSummary(json.summary);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      if (!mountedRef.current || applyInFlightRef.current || summaryEpochRef.current !== epoch) return;
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              status: "unavailable",
              degradedReason:
                "Operations Assistant lost connection while refreshing. Retry when ready.",
            }
          : null
      );
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [resolvedBranchId, resolvedDate]);

  useEffect(() => {
    if (initialSummary) return;
    const timer = window.setTimeout(() => {
      void fetchLatestSummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSummary, fetchLatestSummary]);

  useEffect(() => {
    return subscribeOptimizationSyncChannel((detail) => {
      if (detail.branchId && resolvedBranchId && detail.branchId !== resolvedBranchId) return;
      if (detail.date && resolvedDate && detail.date !== resolvedDate) return;

      const maybeSummary = detail.summary as TieredCrmOperationsSummary | undefined;
      if (
        maybeSummary &&
        typeof maybeSummary === "object" &&
        typeof maybeSummary.sourceSnapshotVersion === "string" &&
        Array.isArray(maybeSummary.persistentActions) &&
        (!resolvedBranchId || maybeSummary.branchId === resolvedBranchId) &&
        (!resolvedDate || maybeSummary.date === resolvedDate)
      ) {
        setSummary(maybeSummary);
        return;
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void fetchLatestSummary();
      }, 150);
    });
  }, [resolvedBranchId, resolvedDate, fetchLatestSummary]);

  const runManualCheck = useCallback(
    (syncAlerts = true) => {
      startTransition(async () => {
        const res = await evaluateBranchOptimizationAction({
          date: resolvedDate,
          syncAlerts,
        });
        if (!res.success) {
          if (res.summary) setSummary(res.summary);
          toast.error(res.error);
          return;
        }
        setSummary(res.summary);
        notifyOptimizationChanged({
          branchId: res.summary.branchId,
          date: res.summary.date,
          reason: "manual_check",
          summary: res.summary,
        });
        if (res.summary.status === "degraded") {
          toast.warning(
            res.summary.degradedReason ??
              "Optimizer service offline; showing local safety checks only."
          );
        } else if (res.summary.persistentActions.length > 0) {
          toast.warning(
            `${res.summary.persistentActions.length} operational schedule issue(s) need CRM action.`
          );
        } else {
          toast.success("Unified schedule check passed with zero critical collisions.");
        }
      });
    },
    [resolvedDate]
  );

  const applyRecommendedAction = useCallback(
    async (
      conflict: PredictiveConflictItem,
      action: RecommendedStaffAction,
      options?: { confirmCustomerApproval?: boolean }
    ): Promise<ApplyRecommendedFixResult> => {
      const snapshotVersion = summary?.sourceSnapshotVersion ?? conflict.source_snapshot_version;
      applyInFlightRef.current = true;
      summaryEpochRef.current += 1;
      abortRef.current?.abort();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setBusyActionKey(`${conflict.dedupe_key}:${action.action_id}`);

      try {
        const res = await applyRecommendedFixAction({
          sourceSnapshotVersion: snapshotVersion,
          date: resolvedDate,
          actionType: action.action_type as Parameters<
            typeof applyRecommendedFixAction
          >[0] extends infer P
            ? P extends { actionType: infer A }
              ? A
              : never
            : never,
          targetBookingId: action.target_booking_id,
          proposedStaffId: action.proposed_staff_id,
          proposedResourceId: action.proposed_resource_id,
          proposedDriverId: action.proposed_driver_id,
          confirmCustomerApproval:
            options?.confirmCustomerApproval ?? !action.requires_customer_approval,
        });

        if (!res.success) {
          if (res.summary) {
            setSummary(res.summary);
            notifyOptimizationChanged({
              branchId: res.summary.branchId,
              date: res.summary.date,
              reason: "stale_reconciled",
              summary: res.summary,
            });
          }
          if (res.code === "CONFLICT_ALREADY_RESOLVED") {
            toast.info(res.error);
            notifyBookingsChanged();
            onAfterMutation?.();
            router.refresh();
          } else if (res.code !== "CUSTOMER_APPROVAL_REQUIRED") {
            toast.error(res.error);
          }
          return res;
        }

        setSummary(res.summary);
        toast.success(res.message);
        notifyBookingsChanged();
        notifyOptimizationChanged({
          branchId: res.summary.branchId,
          date: res.summary.date,
          reason: "action_applied",
          summary: res.summary,
        });
        onAfterMutation?.();
        router.refresh();
        return res;
      } finally {
        applyInFlightRef.current = false;
        summaryEpochRef.current += 1;
        if (mountedRef.current) setBusyActionKey(null);
      }
    },
    [summary?.sourceSnapshotVersion, resolvedDate, onAfterMutation, router]
  );

  return {
    summary,
    isPending,
    isSyncing,
    busyActionKey,
    refreshSummary: fetchLatestSummary,
    runManualCheck,
    applyRecommendedAction,
    setSummary,
  };
}
