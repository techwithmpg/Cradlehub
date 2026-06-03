"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, Navigation, ChevronLeft } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import { DriverJobStatusStepper } from "./driver-job-status-stepper";
import { DriverStatusBadge } from "./driver-status-badge";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchStatus } from "@/features/dispatch/types";

type JobDetailItem = RealDispatchItem & { durationMinutes: number | null; notes: string | null };

type ActionBtn = { label: string; nextStatus: "travel_started" | "arrived" };

function getDriverAction(status: DispatchStatus): ActionBtn | null {
  switch (status) {
    case "ready":
    case "awaiting_driver":
      return { label: "Start Travel", nextStatus: "travel_started" };
    case "in_route":
      return { label: "Mark Arrived", nextStatus: "arrived" };
    default:
      return null;
  }
}

function getNavUrl(item: RealDispatchItem): string | null {
  if (item.lat !== null && item.lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
  }
  if (item.formattedAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.formattedAddress)}`;
  }
  return null;
}

export function DriverJobDetailsPage({ job }: { job: JobDetailItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const action = getDriverAction(job.dispatchStatus);
  const navUrl = getNavUrl(job);
  const address = job.formattedAddress ?? job.area;

  function handleAction(nextStatus: "travel_started" | "arrived") {
    startTransition(async () => {
      await updateBookingProgressAction({ bookingId: job.id, nextStatus });
      router.refresh();
    });
  }

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem", position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Link href="/staff-portal/jobs" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--cs-border-soft)", backgroundColor: "var(--cs-surface-warm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cs-text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>Job Details</h1>
        </div>
        <DriverStatusBadge status={job.dispatchStatus} />
      </div>

      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {/* Time */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "var(--cs-text)" }}>
          <Clock size={16} color="var(--cs-staff-accent)" />
          {formatTime12h(job.startTime)} – {formatTime12h(job.endTime)}
        </div>

        {/* Customer card */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cs-text-muted)" }}>Customer</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--cs-text)" }}>{job.customerName}</div>

          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cs-text-muted)", marginTop: "0.25rem" }}>Address</div>
          {address ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 13, color: "var(--cs-text)" }}>
              <MapPin size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.5 }}>{address}</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>No address available</div>
          )}

          {navUrl && (
            <a href={navUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: "0.25rem", padding: "0.5rem 0.875rem", borderRadius: 10, border: "1px solid var(--cs-border)", backgroundColor: "var(--cs-surface-warm)", color: "var(--cs-staff-accent)", textDecoration: "none", fontSize: 12, fontWeight: 600, alignSelf: "flex-start" }}>
              <Navigation size={13} />
              View on Map
            </a>
          )}
        </div>

        {/* Service info */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cs-text-muted)" }}>Service</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)" }}>{job.serviceName}</div>
          {job.durationMinutes && (
            <div style={{ fontSize: 12, color: "var(--cs-text-muted)" }}>Duration: {job.durationMinutes} min</div>
          )}
          {job.notes && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cs-text-muted)", marginTop: "0.375rem" }}>Notes</div>
              <div style={{ fontSize: 13, color: "var(--cs-text)", lineHeight: 1.5 }}>{job.notes}</div>
            </>
          )}
        </div>

        {/* Status stepper */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cs-text-muted)", marginBottom: "0.75rem" }}>Update Status</div>
          <DriverJobStatusStepper status={job.dispatchStatus} />
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
      </div>
    </div>
  );
}
