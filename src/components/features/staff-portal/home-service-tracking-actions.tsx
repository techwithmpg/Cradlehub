"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, MapPin, Play, CheckCircle2 } from "lucide-react";
import { updateHomeServiceTrackingAction } from "@/app/(dashboard)/staff-portal/actions";
import {
  getNextHomeServiceTrackingStatus,
  type HomeServiceTrackingStatus,
} from "@/lib/home-service-tracking";
import type { StaffPortalBooking } from "./types";
import { TrackingTimer, TimestampLabel } from "./tracking-timer";

const STAGE_CONFIG: Record<
  HomeServiceTrackingStatus,
  { label: string; icon: React.ReactNode; activeLabel: string }
> = {
  not_started: {
    label: "Start Travel",
    icon: <Car size={14} />,
    activeLabel: "Travel",
  },
  travel_started: {
    label: "Mark Arrived",
    icon: <MapPin size={14} />,
    activeLabel: "Travel",
  },
  arrived: {
    label: "Start Session",
    icon: <Play size={14} />,
    activeLabel: "Arrived",
  },
  session_started: {
    label: "Complete Appointment",
    icon: <CheckCircle2 size={14} />,
    activeLabel: "Session",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 size={14} />,
    activeLabel: "Completed",
  },
};

type HomeServiceTrackingActionsProps = {
  booking: StaffPortalBooking;
};

export function HomeServiceTrackingActions({ booking }: HomeServiceTrackingActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentStatus = booking.home_service_tracking_status;
  const nextStatus = getNextHomeServiceTrackingStatus(currentStatus);

  function handleAdvance() {
    if (!nextStatus || isPending) return;
    startTransition(async () => {
      const result = await updateHomeServiceTrackingAction(booking.id, nextStatus);
      if (!result.ok) {
        alert(result.message);
      } else {
        router.refresh();
      }
    });
  }

  const stages: HomeServiceTrackingStatus[] = [
    "not_started",
    "travel_started",
    "arrived",
    "session_started",
    "completed",
  ];

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
          const isDone = currentIndex >= stageIndex;
          const isCurrent = currentIndex === stageIndex;
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
                {STAGE_CONFIG[stage].activeLabel}
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
      {currentStatus === "arrived" && booking.arrived_at && (
        <TimestampLabel timestamp={booking.arrived_at} label="Arrived" />
      )}
      {currentStatus === "session_started" && booking.session_started_at && (
        <TrackingTimer startTimestamp={booking.session_started_at} label="Session active" />
      )}
      {currentStatus === "completed" && booking.completed_at && (
        <TimestampLabel timestamp={booking.completed_at} label="Completed" />
      )}

      {/* Primary action button */}
      {nextStatus && (
        <button
          onClick={handleAdvance}
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
          {STAGE_CONFIG[nextStatus].icon}
          {isPending ? "Updating…" : STAGE_CONFIG[nextStatus].label}
        </button>
      )}

      {currentStatus === "completed" && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--cs-success-text)",
            backgroundColor: "var(--cs-success-bg)",
            padding: "6px 12px",
            borderRadius: "var(--cs-r-sm)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            alignSelf: "flex-start",
          }}
        >
          <CheckCircle2 size={14} />
          Appointment completed
        </div>
      )}
    </div>
  );
}
