import { CheckCircle2, Circle, Clock } from "lucide-react";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type TimelineStage = {
  label: string;
  timestamp: string | null;
  done: boolean;
  active: boolean;
};

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

function buildTimeline(item: RealDispatchItem): TimelineStage[] {
  const prog = item.bookingProgressStatus;
  const done = (s: string) => {
    const order = ["not_started", "travel_started", "arrived", "session_started", "completed"];
    return order.indexOf(prog) > order.indexOf(s);
  };
  const active = (s: string) => prog === s;

  return [
    { label: "On the Way", timestamp: item.travelStartedAt, done: done("travel_started"), active: active("travel_started") },
    { label: "Arrived", timestamp: item.arrivedAt, done: done("arrived"), active: active("arrived") },
    { label: "In Progress", timestamp: item.sessionStartedAt, done: done("session_started"), active: active("session_started") },
    { label: "Completed", timestamp: item.completedAt, done: done("completed") || prog === "completed", active: false },
  ];
}

export function DriverJobTimeline({ item }: { item: RealDispatchItem }) {
  const stages = buildTimeline(item);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {stages.map((stage) => (
        <div key={stage.label} style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          {stage.done ? (
            <CheckCircle2 size={18} color="var(--cs-success)" style={{ flexShrink: 0 }} />
          ) : stage.active ? (
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid var(--cs-staff-accent)", flexShrink: 0 }} />
          ) : (
            <Circle size={18} color="var(--cs-border)" style={{ flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: stage.active || stage.done ? 600 : 400, color: stage.done ? "var(--cs-text)" : stage.active ? "var(--cs-staff-accent)" : "var(--cs-text-muted)" }}>
              {stage.label}
            </span>
            {stage.timestamp && (
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--cs-text-muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Clock size={10} />
                {formatTs(stage.timestamp)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
