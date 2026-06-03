"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ChevronLeft } from "lucide-react";
import { DriverJobTimeline } from "./driver-job-timeline";
import { DriverStatusBadge } from "./driver-status-badge";
import { TrackingTimer } from "@/components/features/staff-portal/tracking-timer";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchStatus } from "@/features/dispatch/types";

type ActionDef = { label: string; nextStatus: "travel_started" | "arrived" };

function getAction(status: DispatchStatus): ActionDef | null {
  if (status === "ready" || status === "awaiting_driver") return { label: "Start Travel", nextStatus: "travel_started" };
  if (status === "in_route") return { label: "Mark Arrived", nextStatus: "arrived" };
  return null;
}

function getTimerStart(item: RealDispatchItem): string | null {
  return item.travelStartedAt ?? null;
}

export function DriverActiveJobPage({ job }: { job: RealDispatchItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const action = getAction(job.dispatchStatus);
  const timerStart = getTimerStart(job);
  const address = job.formattedAddress ?? job.area;

  function handleAction(nextStatus: "travel_started" | "arrived") {
    startTransition(async () => {
      await updateBookingProgressAction({ bookingId: job.id, nextStatus });
      router.refresh();
    });
  }

  const isTerminal = ["completed", "cancelled"].includes(job.dispatchStatus);

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem", position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Link href="/staff-portal/jobs" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--cs-border-soft)", backgroundColor: "var(--cs-surface-warm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cs-text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>Active Job</h1>
        </div>
        <DriverStatusBadge status={job.dispatchStatus} />
      </div>

      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {/* Timer */}
        {timerStart && !isTerminal && (
          <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)", textAlign: "center" }}>
            <TrackingTimer startTimestamp={timerStart} label="Elapsed Time" />
          </div>
        )}

        {/* Job card */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--cs-text)" }}>{job.customerName}</div>
          {address && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 13, color: "var(--cs-text-muted)" }}>
              <MapPin size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.4 }}>{address}</span>
            </div>
          )}
          <div style={{ marginTop: "0.25rem" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cs-text-muted)" }}>Service</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)", marginTop: 2 }}>{job.serviceName}</div>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cs-text-muted)", marginBottom: "0.75rem" }}>Progress</div>
          <DriverJobTimeline item={job} />
        </div>

        {/* Action button */}
        {action && (
          <button
            type="button"
            onClick={() => handleAction(action.nextStatus)}
            disabled={isPending}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0.75rem", borderRadius: 14, backgroundColor: isPending ? "var(--cs-surface-warm)" : "var(--cs-staff-accent)", color: isPending ? "var(--cs-text-muted)" : "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? "Updating…" : action.label}
          </button>
        )}

        {isTerminal && (
          <div style={{ backgroundColor: "var(--cs-success-bg)", borderRadius: 14, border: "1px solid rgba(90,138,106,0.25)", padding: "1rem 1.125rem", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-success)" }}>
              {job.dispatchStatus === "completed" ? "Job Completed ✓" : "Job Cancelled"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
