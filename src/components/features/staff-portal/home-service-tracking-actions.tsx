"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, MapPin, Play, CheckCircle2 } from "lucide-react";
import { updateHomeServiceTrackingAction } from "@/app/(dashboard)/staff-portal/actions";
import type { StaffPortalBooking, TrackingStage } from "./types";
import { getTrackingStage, getNextTrackingStage } from "./types";

const STAGE_CONFIG: Record<
  TrackingStage,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  travel_started: {
    label: "Start Travel",
    icon: <Car size={14} />,
    color: "var(--cs-info-text)",
    bg: "var(--cs-info-bg)",
  },
  arrived: {
    label: "Arrived",
    icon: <MapPin size={14} />,
    color: "var(--cs-sand-dark)",
    bg: "var(--cs-sand-mist)",
  },
  session_started: {
    label: "Start Session",
    icon: <Play size={14} />,
    color: "var(--cs-owner-text)",
    bg: "var(--cs-owner-bg)",
  },
  completed: {
    label: "Complete",
    icon: <CheckCircle2 size={14} />,
    color: "var(--cs-success-text)",
    bg: "var(--cs-success-bg)",
  },
};

type HomeServiceTrackingActionsProps = {
  booking: StaffPortalBooking;
};

export function HomeServiceTrackingActions({ booking }: HomeServiceTrackingActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentStage = getTrackingStage(booking);
  const nextStage = getNextTrackingStage(booking);

  function handleStage(stage: TrackingStage) {
    startTransition(async () => {
      const result = await updateHomeServiceTrackingAction(booking.id, stage);
      if ("error" in result) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const stages: TrackingStage[] = ["travel_started", "arrived", "session_started", "completed"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.625rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
        {stages.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const isCompleted = currentStage === stage || (stage === "travel_started" && currentStage !== null) || (stage === "arrived" && (currentStage === "arrived" || currentStage === "session_started" || currentStage === "completed")) || (stage === "session_started" && (currentStage === "session_started" || currentStage === "completed"));
          const isNext = nextStage === stage;
          const isDisabled = !isNext || isPending;

          return (
            <button
              key={stage}
              onClick={() => isNext && !isPending && handleStage(stage)}
              disabled={isDisabled}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "0.375rem 0.625rem",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: "var(--cs-r-sm)",
                border: "none",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled && !isCompleted ? 0.5 : 1,
                backgroundColor: isCompleted ? "var(--cs-success-bg)" : isNext ? config.bg : "var(--cs-neutral-bg)",
                color: isCompleted ? "var(--cs-success-text)" : isNext ? config.color : "var(--cs-neutral-text)",
                transition: "all var(--cs-duration) var(--cs-ease)",
                minHeight: 36,
                flex: "1 1 auto",
                justifyContent: "center",
              }}
            >
              {isCompleted ? <CheckCircle2 size={14} /> : config.icon}
              {isCompleted ? "Done" : config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
