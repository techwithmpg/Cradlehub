"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { Car, MapPin, Play, CheckCircle2, ClipboardCheck, UserX } from "lucide-react";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import {
  getNextBookingProgressStatus,
  getBookingProgressLabel,
  isBookingProgressTerminal,
  type BookingProgressStatus,
} from "@/lib/bookings/progress";
import type { StaffPortalBooking } from "./types";
import { TrackingTimer, TimestampLabel } from "./tracking-timer";
import { PremiumActionOverlay } from "@/components/shared/motion/premium-action-overlay";
import { PremiumSuccessToast } from "@/components/shared/motion/premium-success-toast";
import { PremiumInlineSpinner } from "@/components/shared/motion/premium-inline-spinner";
import { LivePulseIndicator } from "@/components/shared/motion/live-pulse-indicator";
import { MotionStatusDot } from "@/components/shared/motion/motion-status-dot";

const ACTION_CONFIG: Record<
  BookingProgressStatus,
  { label: string; icon: React.ReactNode; activeLabel: string }
> = {
  not_started: {
    label: "Start",
    icon: <Play size={14} />,
    activeLabel: "Waiting",
  },
  checked_in: {
    label: "Check In",
    icon: <ClipboardCheck size={14} />,
    activeLabel: "Checked in",
  },
  travel_started: {
    label: "Start Travel",
    icon: <Car size={14} />,
    activeLabel: "Travel",
  },
  arrived: {
    label: "Mark Arrived",
    icon: <MapPin size={14} />,
    activeLabel: "Arrived",
  },
  session_started: {
    label: "Start Session",
    icon: <Play size={14} />,
    activeLabel: "Session",
  },
  completed: {
    label: "Complete",
    icon: <CheckCircle2 size={14} />,
    activeLabel: "Completed",
  },
  no_show: {
    label: "No Show",
    icon: <UserX size={14} />,
    activeLabel: "No show",
  },
};

type ActionFeedback = {
  type: "idle" | "loading" | "success" | "error";
  title: string;
  description?: string;
  variant?: "success" | "warning" | "error";
};

type ProgressFeedback = {
  loadingTitle: string;
  loadingDescription: string;
  successTitle: string;
  successDescription: string;
  variant?: "success" | "warning" | "error";
};

function getProgressFeedback(status: BookingProgressStatus): ProgressFeedback {
  switch (status) {
    case "travel_started":
      return {
        loadingTitle: "Starting travel...",
        loadingDescription: "We're notifying the customer and front desk.",
        successTitle: "Travel started",
        successDescription: "Customer and front desk have been notified.",
      };
    case "arrived":
      return {
        loadingTitle: "Confirming arrival...",
        loadingDescription: "We're updating the booking timeline.",
        successTitle: "Arrival confirmed",
        successDescription: "The booking timeline has been updated.",
      };
    case "checked_in":
      return {
        loadingTitle: "Checking in...",
        loadingDescription: "We're updating the in-spa booking status.",
        successTitle: "Checked in",
        successDescription: "The guest has been marked as checked in.",
      };
    case "session_started":
      return {
        loadingTitle: "Starting session...",
        loadingDescription: "We're syncing the service timeline.",
        successTitle: "Session started",
        successDescription: "The service is now in progress.",
      };
    case "completed":
      return {
        loadingTitle: "Completing session...",
        loadingDescription: "We're finalizing the service record.",
        successTitle: "Session completed",
        successDescription: "The service record has been finalized.",
      };
    case "no_show":
      return {
        loadingTitle: "Marking no-show...",
        loadingDescription: "We're updating the booking record.",
        successTitle: "No-show marked",
        successDescription: "The booking has been updated.",
        variant: "warning",
      };
    default:
      return {
        loadingTitle: "Updating status...",
        loadingDescription: "Please wait while we sync this booking.",
        successTitle: "Status updated",
        successDescription: "The booking has been updated.",
      };
  }
}

function getStepperStages(bookingType: string): BookingProgressStatus[] {
  if (bookingType === "home_service") {
    return ["not_started", "travel_started", "arrived", "session_started", "completed"];
  }
  // in_spa (walkin + online)
  return ["not_started", "checked_in", "session_started", "completed"];
}

type BookingProgressActionsProps = {
  booking: StaffPortalBooking;
  /** Called after a successful progress update (optional, for modal context). */
  onSuccess?: () => void;
};

export function BookingProgressActions({ booking, onSuccess }: BookingProgressActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { isOffline } = useNetworkStatus();
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>({
    type: "idle",
    title: "",
  });

  const currentStatus = booking.booking_progress_status;
  const nextStatus = getNextBookingProgressStatus({
    bookingType: (booking.delivery_type ?? "in_spa") as "home_service" | "in_spa",
    currentStatus,
  });
  const isTerminal = isBookingProgressTerminal(currentStatus);

  function handleAdvance(status: BookingProgressStatus) {
    if (isPending || isOffline) return;
    const feedback = getProgressFeedback(status);
    setActionFeedback({
      type: "loading",
      title: feedback.loadingTitle,
      description: feedback.loadingDescription,
    });
    startTransition(async () => {
      const result = await updateBookingProgressAction({
        bookingId: booking.id,
        nextStatus: status,
      });
      if (!result.ok) {
        setActionFeedback({
          type: "error",
          title: "Update failed",
          description: result.message + (isOffline ? " Check your connection and try again." : ""),
          variant: "error",
        });
        setTimeout(() => setActionFeedback({ type: "idle", title: "" }), 4000);
      } else {
        setActionFeedback({
          type: "success",
          title: feedback.successTitle,
          description: feedback.successDescription,
          variant: feedback.variant ?? "success",
        });
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
        setTimeout(() => setActionFeedback({ type: "idle", title: "" }), 3000);
      }
    });
  }

  const stages = getStepperStages(booking.delivery_type ?? "in_spa");
  const currentIndex = stages.indexOf(currentStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
      {/* Premium loading overlay */}
      <PremiumActionOverlay
        open={actionFeedback.type === "loading"}
        title={actionFeedback.title}
        description={actionFeedback.description}
      />

      {/* Success / error toast */}
      <PremiumSuccessToast
        open={actionFeedback.type === "success" || actionFeedback.type === "error"}
        title={actionFeedback.title}
        description={actionFeedback.description}
        variant={actionFeedback.variant}
      />

      {/* Compact stepper */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: "var(--cs-text-muted)",
          flexWrap: "wrap",
        }}
      >
        {stages.slice(1).map((stage, i) => {
          const stageIndex = i + 1;
          const isDone = currentIndex >= stageIndex || isTerminal;
          const isCurrent = currentIndex === stageIndex && !isTerminal;
          const dotState = isDone
            ? "done"
            : isCurrent
            ? "active"
            : currentStatus === "no_show"
            ? "warning"
            : "pending";
          return (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MotionStatusDot state={dotState} />
              <span
                style={{
                  fontWeight: isCurrent ? 600 : 400,
                  color: isDone || isCurrent ? "var(--cs-text)" : "var(--cs-text-muted)",
                }}
              >
                {ACTION_CONFIG[stage].activeLabel}
              </span>
              {i < stages.slice(1).length - 1 && (
                <span style={{ color: "var(--cs-border-strong)", marginLeft: 2, marginRight: 2 }}>
                  &mdash;
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Status-specific info */}
      {currentStatus === "travel_started" && booking.travel_started_at && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <LivePulseIndicator label="Travel active" />
          <TrackingTimer startTimestamp={booking.travel_started_at} label="Travel active" />
        </div>
      )}
      {currentStatus === "checked_in" && booking.checked_in_at && (
        <TimestampLabel timestamp={booking.checked_in_at} label="Checked in" />
      )}
      {currentStatus === "arrived" && booking.arrived_at && (
        <TimestampLabel timestamp={booking.arrived_at} label="Arrived" />
      )}
      {currentStatus === "session_started" && booking.session_started_at && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <LivePulseIndicator label="Session active" tone="gold" />
          <TrackingTimer startTimestamp={booking.session_started_at} label="Session active" />
        </div>
      )}
      {currentStatus === "completed" && booking.session_completed_at && (
        <TimestampLabel timestamp={booking.session_completed_at} label="Completed" />
      )}
      {currentStatus === "no_show" && booking.no_show_at && (
        <TimestampLabel timestamp={booking.no_show_at} label="No show" />
      )}

      {/* Primary action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {nextStatus && !isTerminal && (
          <button
            onClick={() => handleAdvance(nextStatus)}
            disabled={isPending || isOffline}
            className="active:scale-[0.98]"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "0.5rem 0.875rem",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--cs-r-md)",
              border: "none",
              cursor: isPending || isOffline ? "not-allowed" : "pointer",
              opacity: isPending || isOffline ? 0.6 : 1,
              backgroundColor: "var(--cs-staff-accent)",
              color: "#fff",
              transition:
                "transform var(--cs-duration) var(--cs-ease), opacity var(--cs-duration) var(--cs-ease)",
              minHeight: 40,
              width: "100%",
            }}
          >
            {isPending ? (
              <>
                <PremiumInlineSpinner />
                Updating…
              </>
            ) : (
              <>
                {ACTION_CONFIG[nextStatus].icon}
                {ACTION_CONFIG[nextStatus].label}
              </>
            )}
          </button>
        )}

        {/* No-show button for in-spa when allowed */}
        {(booking.delivery_type ?? "in_spa") === "in_spa" &&
          (currentStatus === "not_started" || currentStatus === "checked_in") && (
            <button
              onClick={() => handleAdvance("no_show")}
              disabled={isPending || isOffline}
              className="active:scale-[0.98]"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "0.5rem 0.875rem",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--cs-r-md)",
                border: "1px solid var(--cs-border-strong)",
                cursor: isPending || isOffline ? "not-allowed" : "pointer",
                opacity: isPending || isOffline ? 0.6 : 1,
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text-muted)",
                transition:
                  "transform var(--cs-duration) var(--cs-ease), opacity var(--cs-duration) var(--cs-ease)",
                minHeight: 40,
                width: "100%",
              }}
            >
              {isPending ? (
                <>
                  <span
                    className="animate-spin shrink-0"
                    style={{
                      display: "inline-block",
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      border: "2px solid rgba(156,136,120,0.25)",
                      borderTopColor: "var(--cs-text-muted)",
                    }}
                  />
                  Updating…
                </>
              ) : (
                <>
                  <UserX size={14} />
                  Mark No Show
                </>
              )}
            </button>
          )}
      </div>

      {isTerminal && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color:
              currentStatus === "no_show"
                ? "var(--cs-warning-text)"
                : "var(--cs-success-text)",
            backgroundColor:
              currentStatus === "no_show"
                ? "var(--cs-warning-bg)"
                : "var(--cs-success-bg)",
            padding: "6px 12px",
            borderRadius: "var(--cs-r-sm)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            alignSelf: "flex-start",
          }}
        >
          <CheckCircle2 size={14} />
          {getBookingProgressLabel(currentStatus)}
        </div>
      )}
    </div>
  );
}
