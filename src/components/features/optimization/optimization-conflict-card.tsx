"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { validCrmActionHrefForConflict } from "@/lib/optimization/assistant-summary";
import type { ApplyRecommendedFixResult } from "@/lib/actions/optimization-actions";
import type {
  PredictiveConflictItem,
  RecommendedStaffAction,
} from "@/lib/optimization/types";
import {
  formatConflictIssueLabel,
  SUPPORTED_DIRECT_APPLY_ACTIONS,
} from "./use-crm-optimization-assistant";

export type ConflictCardProps = {
  conflict: PredictiveConflictItem;
  busyActionKey: string | null;
  disabled?: boolean;
  onApply: (
    conflict: PredictiveConflictItem,
    action: RecommendedStaffAction,
    options?: { confirmCustomerApproval?: boolean }
  ) => Promise<ApplyRecommendedFixResult>;
  onSelectBooking?: (bookingId: string) => void;
  compact?: boolean;
};

function primaryLinkLabel(conflict: PredictiveConflictItem, href: string): string {
  if (href.startsWith("/crm/dispatch")) return "Open Dispatch";
  if (href.startsWith("/crm/bookings")) {
    return conflict.issue_type === "therapist_unassigned_risk"
      ? "Review Assignment"
      : "Review Booking";
  }
  return "Open Schedule";
}

export function OptimizationConflictCard({
  conflict,
  busyActionKey,
  disabled = false,
  onApply,
  onSelectBooking,
  compact = false,
}: ConflictCardProps) {
  const [confirmGuestId, setConfirmGuestId] = useState<string | null>(null);
  const firstAction = conflict.recommended_actions[0];
  const canApply =
    Boolean(firstAction) &&
    SUPPORTED_DIRECT_APPLY_ACTIONS.has(firstAction!.action_type) &&
    firstAction!.verified_feasible;
  const actionKey = firstAction ? `${conflict.dedupe_key}:${firstAction.action_id}` : null;
  const isBusy = Boolean(actionKey && busyActionKey === actionKey);
  const href = validCrmActionHrefForConflict(conflict);
  const firstBookingId = conflict.affected_booking_ids[0] ?? null;

  return (
    <div
      data-testid="ops-conflict-card"
      data-conflict-key={conflict.dedupe_key}
      data-assistant-tier={conflict.assistant_tier}
      className="rounded-xl border border-[var(--cs-border)] bg-white/95 p-3 text-xs shadow-2xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
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
            <span className="font-bold text-[var(--cs-text)]">
              {formatConflictIssueLabel(conflict.issue_type)}
            </span>
            <span className="text-[11px] font-semibold text-[#6B5D52]">
              · Act before {conflict.latest_useful_action_time}
            </span>
            {conflict.confidence_or_data_quality.status === "degraded_gps" && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                GPS / Location review
              </span>
            )}
          </div>

          <p className="mt-1.5 leading-relaxed text-[var(--cs-text-secondary)]">
            {conflict.predicted_impact}
          </p>
        </div>
      </div>

      {firstAction && (
        <div className="mt-2.5 border-t border-[var(--cs-border-soft)] pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-[#1E1916]">
                Recommended: {firstAction.label}
              </div>
              {!compact && firstAction.detail && firstAction.detail !== firstAction.label && (
                <p className="mt-0.5 text-[11px] text-[var(--cs-text-muted)]">
                  {firstAction.detail}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {onSelectBooking && firstBookingId && !href.startsWith("/crm/dispatch") ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || isBusy}
                  onClick={() => onSelectBooking(firstBookingId)}
                  className="h-7 rounded-lg px-2.5 text-[11px] font-semibold text-[#1F4E33] hover:bg-[#EEF7F1]"
                >
                  Review Booking
                </Button>
              ) : (
                <Link
                  href={href}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--cs-border-soft)] bg-[#FAF8F5] px-2.5 text-[11px] font-semibold text-[#1F4E33] transition hover:border-[#1F4E33]/40 hover:bg-[#EEF7F1]"
                >
                  <span>{primaryLinkLabel(conflict, href)}</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              )}

              {canApply && !firstAction.requires_customer_approval && (
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || isBusy || busyActionKey !== null}
                  onClick={() => void onApply(conflict, firstAction)}
                  className="h-7 rounded-lg bg-[#1F4E33] px-2.5 text-[11px] font-semibold text-white hover:bg-[#163B26]"
                >
                  {isBusy ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Wrench className="mr-1 size-3" />
                  )}
                  Apply Verified Fix
                </Button>
              )}

              {canApply && firstAction.requires_customer_approval && confirmGuestId !== firstAction.action_id && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || isBusy || busyActionKey !== null}
                  onClick={() => setConfirmGuestId(firstAction.action_id)}
                  className="h-7 rounded-lg border-amber-300 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                >
                  <ShieldAlert className="mr-1 size-3" />
                  Guest Approval Needed
                </Button>
              )}
            </div>
          </div>

          {canApply &&
            firstAction.requires_customer_approval &&
            confirmGuestId === firstAction.action_id && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50/90 px-2.5 py-2 text-[11px] text-amber-950">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                  <span>
                    Guest specifically chose this therapist. Confirm only if the guest agreed to{" "}
                    <strong>{firstAction.proposed_staff_name ?? "the substitute therapist"}</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmGuestId(null)}
                    className="h-7 rounded-md px-2 text-[11px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={disabled || isBusy || busyActionKey !== null}
                    onClick={() => {
                      void onApply(conflict, firstAction, { confirmCustomerApproval: true }).then(
                        () => setConfirmGuestId(null)
                      );
                    }}
                    className="h-7 rounded-md bg-amber-700 px-2.5 text-[11px] font-semibold text-white hover:bg-amber-800"
                  >
                    {isBusy ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1 size-3" />
                    )}
                    Confirm Guest OK & Swap
                  </Button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
