"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { updateBookingStatusAction } from "@/app/(dashboard)/manager/bookings/actions";
import { canCancelBooking, canChangeBookingStatus } from "@/lib/permissions";

type BookingTransitionStatus = "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";

type TransitionAction = {
  label: string;
  status: BookingTransitionStatus;
  danger?: boolean;
};

const TRANSITIONS: Record<string, TransitionAction[]> = {
  pending: [
    { label: "Confirm", status: "confirmed" },
    { label: "Cancel", status: "cancelled", danger: true },
  ],
  confirmed: [
    { label: "Start", status: "in_progress" },
    { label: "Complete", status: "completed" },
    { label: "Cancel", status: "cancelled", danger: true },
    { label: "No Show", status: "no_show", danger: true },
  ],
  in_progress: [
    { label: "Complete", status: "completed" },
    { label: "Cancel", status: "cancelled", danger: true },
  ],
};

type StatusAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;
type ActionScope = "all" | "status" | "cancel";
type TriggerVariant = "default" | "icon" | "panelSecondary" | "panelDanger";

type BookingActionMenuProps = {
  bookingId: string;
  currentStatus: string;
  userRole?: string;
  onUpdate?: () => void;
  statusAction?: StatusAction;
  actionScope?: ActionScope;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  triggerVariant?: TriggerVariant;
  fullWidth?: boolean;
  emptyBehavior?: "hide" | "disabled";
};

export function BookingActionMenu({
  bookingId,
  currentStatus,
  userRole,
  onUpdate,
  statusAction,
  actionScope = "all",
  triggerLabel = "Actions",
  triggerAriaLabel,
  triggerVariant = "default",
  fullWidth = false,
  emptyBehavior = "hide",
}: BookingActionMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const permittedActions = (TRANSITIONS[currentStatus] ?? []).filter((action) => {
    if (!userRole) return true;
    if (action.status === "cancelled") {
      return canCancelBooking(userRole);
    }
    return canChangeBookingStatus(userRole);
  });

  const actions = permittedActions.filter((action) => {
    if (actionScope === "cancel") return action.status === "cancelled";
    if (actionScope === "status") return action.status !== "cancelled";
    return true;
  });
  const hasActions = actions.length > 0;
  const directAction = actionScope === "cancel" ? actions[0] : undefined;

  if (!hasActions && emptyBehavior === "hide") return null;

  function closeFeedbackAfterDelay() {
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function handleAction(status: BookingTransitionStatus) {
    setOpen(false);
    startTransition(async () => {
      const callAction = statusAction ?? updateBookingStatusAction;
      const result = await callAction({ bookingId, status });
      if (!result.success) {
        setFeedback(result.error ?? "Failed to update booking");
        closeFeedbackAfterDelay();
        return;
      }
      onUpdate?.();
      router.refresh();
    });
  }

  function handleTriggerClick() {
    if (directAction) {
      handleAction(directAction.status);
      return;
    }
    if (hasActions) {
      setOpen((current) => !current);
    }
  }

  const triggerStyle = getTriggerButtonStyle(triggerVariant, fullWidth, isPending || !hasActions);
  const menuLabel = triggerVariant === "icon" ? triggerAriaLabel ?? "Open booking actions" : triggerAriaLabel;

  return (
    <div style={{ position: "relative", display: fullWidth ? "block" : "inline-block", width: fullWidth ? "100%" : undefined }}>
      {feedback && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            right: 0,
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: "0.75rem",
            color: "#991B1B",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {feedback}
        </div>
      )}

      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={isPending || !hasActions}
        style={triggerStyle}
        aria-haspopup={directAction ? undefined : "menu"}
        aria-expanded={directAction ? undefined : open}
        aria-label={menuLabel}
        title={menuLabel}
      >
        {isPending
          ? <Loader2 className="animate-spin" style={{ width: 13, height: 13, display: "inline" }} />
          : triggerVariant === "icon"
            ? <MoreHorizontal aria-hidden="true" style={{ width: 15, height: 15 }} />
            : (
                <>
                  {triggerLabel}
                  {!directAction && hasActions && <span aria-hidden="true"> ▾</span>}
                </>
              )}
      </button>

      {open && hasActions && !directAction && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              zIndex: 20,
              minWidth: 140,
              overflow: "hidden",
            }}
          >
            {actions.map((action) => (
              <button
                key={action.status}
                type="button"
                onClick={() => handleAction(action.status)}
                style={{
                  width: "100%",
                  display: "block",
                  padding: "8px 12px",
                  textAlign: "left",
                  border: "none",
                  backgroundColor: "transparent",
                  fontSize: "0.875rem",
                  color: action.danger ? "#DC2626" : "var(--cs-text)",
                  cursor: "pointer",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getTriggerButtonStyle(
  variant: TriggerVariant,
  fullWidth: boolean,
  disabled: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : undefined,
  };

  if (variant === "icon") {
    return {
      ...base,
      width: 30,
      height: 30,
      padding: 0,
      border: "1px solid var(--cs-border)",
      backgroundColor: "var(--cs-surface)",
      color: "var(--cs-text-muted)",
    };
  }

  if (variant === "panelSecondary") {
    return {
      ...base,
      height: 38,
      padding: "0 0.875rem",
      border: "1px solid var(--cs-border)",
      backgroundColor: "var(--cs-surface-warm)",
      color: "var(--cs-text)",
      fontSize: "0.8125rem",
      fontWeight: 600,
    };
  }

  if (variant === "panelDanger") {
    return {
      ...base,
      height: 38,
      padding: "0 0.875rem",
      border: "1px solid #FECACA",
      backgroundColor: "#FFF7F7",
      color: "#B91C1C",
      fontSize: "0.8125rem",
      fontWeight: 600,
    };
  }

  return {
    ...base,
    padding: "4px 10px",
    border: "1px solid var(--cs-border)",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
    fontSize: "0.8125rem",
  };
}
