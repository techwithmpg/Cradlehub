"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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

function getStepperStages(bookingType: string): BookingProgressStatus[] {
  if (bookingType === "home_service") {
    return ["not_started", "travel_started", "arrived", "session_started", "completed"];
  }
  if (bookingType === "walkin") {
    return ["not_started", "checked_in", "session_started", "completed"];
  }
  // online
  return ["not_started", "session_started", "completed"];
}

type BookingProgressActionsProps = {
  booking: StaffPortalBooking;
};

export function BookingProgressActions({ booking }: BookingProgressActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentStatus = booking.booking_progress_status;
  const nextStatus = getNextBookingProgressStatus({
    bookingType: booking.type as "home_service" | "walkin" | "online",
    currentStatus,
  });
  const isTerminal = isBookingProgressTerminal(currentStatus);

  function handleAdvance(status: BookingProgressStatus) {
    if (isPending) return;
    startTransition(async () => {
      const result = await updateBookingProgressAction({ bookingId: booking.id, nextStatus: status });
      if (!result.ok) {
        alert(result.message);
      } else {
        router.refresh();
      }
    });
  }

  const stages = getStepperStages(booking.type);
  const currentIndex = stages.indexOf(currentStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
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
          return (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: isDone
                    ? "var(--cs-success)"
                    : isCurrent
                    ? "var(--cs-staff-accent)"
                    : "var(--cs-border-strong)",
                  display: "inline-block",
                }}
              />
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
        <TrackingTimer startTimestamp={booking.travel_started_at} label="Travel active" />
      )}
      {currentStatus === "checked_in" && booking.checked_in_at && (
        <TimestampLabel timestamp={booking.checked_in_at} label="Checked in" />
      )}
      {currentStatus === "arrived" && booking.arrived_at && (
        <TimestampLabel timestamp={booking.arrived_at} label="Arrived" />
      )}
      {currentStatus === "session_started" && booking.session_started_at && (
        <TrackingTimer startTimestamp={booking.session_started_at} label="Session active" />
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
            disabled={isPending}
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
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
              backgroundColor: "var(--cs-staff-accent)",
              color: "#fff",
              transition: "all var(--cs-duration) var(--cs-ease)",
              minHeight: 40,
              width: "100%",
            }}
          >
            {ACTION_CONFIG[nextStatus].icon}
            {isPending ? "Updating…" : ACTION_CONFIG[nextStatus].label}
          </button>
        )}

        {/* No-show button for walkin when allowed */}
        {booking.type === "walkin" &&
          (currentStatus === "not_started" || currentStatus === "checked_in") && (
            <button
              onClick={() => handleAdvance("no_show")}
              disabled={isPending}
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
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text-muted)",
                transition: "all var(--cs-duration) var(--cs-ease)",
                minHeight: 40,
                width: "100%",
              }}
            >
              <UserX size={14} />
              {isPending ? "Updating…" : "Mark No Show"}
            </button>
          )}
      </div>

      {isTerminal && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: currentStatus === "no_show" ? "var(--cs-warning-text)" : "var(--cs-success-text)",
            backgroundColor: currentStatus === "no_show" ? "var(--cs-warning-bg)" : "var(--cs-success-bg)",
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
