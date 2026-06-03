import { CheckCircle2, Circle } from "lucide-react";
import type { DispatchStatus } from "@/features/dispatch/types";

type Stage = { key: string; label: string };

const STAGES: Stage[] = [
  { key: "assigned", label: "Assigned" },
  { key: "in_route", label: "On the Way" },
  { key: "arrived_at_customer", label: "Arrived" },
  { key: "service_started", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

function getStageIndex(status: DispatchStatus): number {
  switch (status) {
    case "awaiting_driver":
    case "ready": return 0;
    case "in_route": return 1;
    case "arrived_at_customer": return 2;
    case "service_started": return 3;
    case "completed": return 4;
    default: return 0;
  }
}

export function DriverJobStatusStepper({ status }: { status: DispatchStatus }) {
  const currentIndex = getStageIndex(status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {STAGES.map((stage, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {isDone ? (
              <CheckCircle2 size={18} color="var(--cs-success)" />
            ) : isCurrent ? (
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid var(--cs-staff-accent)", backgroundColor: "var(--cs-staff-accent)", flexShrink: 0 }} />
            ) : (
              <Circle size={18} color="var(--cs-border)" />
            )}
            <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : isDone ? 500 : 400, color: isDone ? "var(--cs-text)" : isCurrent ? "var(--cs-staff-accent)" : "var(--cs-text-muted)" }}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
