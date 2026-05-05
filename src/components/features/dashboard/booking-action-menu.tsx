"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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

type BookingActionMenuProps = {
  bookingId: string;
  currentStatus: string;
  userRole?: string;
  onUpdate?: () => void;
};

export function BookingActionMenu({
  bookingId,
  currentStatus,
  userRole,
  onUpdate,
}: BookingActionMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const actions = (TRANSITIONS[currentStatus] ?? []).filter((action) => {
    if (!userRole) return true;
    if (action.status === "cancelled") {
      return canCancelBooking(userRole);
    }
    return canChangeBookingStatus(userRole);
  });
  if (!actions?.length) return null;

  function closeFeedbackAfterDelay() {
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function handleAction(status: BookingTransitionStatus) {
    setOpen(false);
    startTransition(async () => {
      const result = await updateBookingStatusAction({ bookingId, status });
      if (!result.success) {
        setFeedback(result.error ?? "Failed to update booking");
        closeFeedbackAfterDelay();
        return;
      }
      onUpdate?.();
      router.refresh();
    });
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
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
        onClick={() => setOpen((current) => !current)}
        disabled={isPending}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--cs-border)",
          backgroundColor: "var(--cs-surface)",
          color: "var(--cs-text)",
          fontSize: "0.8125rem",
          cursor: "pointer",
          opacity: isPending ? 0.5 : 1,
        }}
      >
        {isPending
          ? <Loader2 className="animate-spin" style={{ width: 13, height: 13, display: "inline" }} />
          : "Actions ▾"}
      </button>

      {open && (
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
