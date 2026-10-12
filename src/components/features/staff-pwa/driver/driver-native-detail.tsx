"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, Navigation } from "lucide-react";
import {
  StaffButton,
  StaffCard,
  StaffFeedback,
  StaffScreen,
  StaffScreenHeader,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import { invalidateStaffSafeMemory } from "@/components/features/staff-pwa/safe-memory";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import {
  getDriverNavigationUrl,
  getDriverProgressLabel,
  getNextDriverAction,
} from "@/lib/staff-pwa/driver-ui-model";
import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

function timeLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export function DriverNativeDetail({ job }: { job: RealDispatchItem }) {
  const router = useRouter();
  const [progress, setProgress] = useState(job.bookingProgressStatus);
  const [travelStartedAt, setTravelStartedAt] = useState(job.travelStartedAt);
  const [arrivedAt, setArrivedAt] = useState(job.arrivedAt);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const current = { ...job, bookingProgressStatus: progress };
  const action = getNextDriverAction(current);
  const navigationUrl = getDriverNavigationUrl(job);
  const destination = job.formattedAddress ?? job.area;

  function advance() {
    if (!action || pending) return;
    const next = action.nextStatus;
    startTransition(async () => {
      setError(null);
      setFeedback(null);
      try {
        const result = await updateBookingProgressAction({ bookingId: job.id, nextStatus: next });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setProgress(next);
        if (next === "travel_started") setTravelStartedAt(result.timestamp);
        else setArrivedAt(result.timestamp);
        setFeedback(next === "arrived" ? "Arrival confirmed." : "Travel started.");
        invalidateStaffSafeMemory(["driverToday", "driverTrips", "driverMap"]);
        router.refresh();
        if (next === "travel_started" && navigationUrl) window.location.assign(navigationUrl);
      } catch {
        setError("Trip update could not be confirmed. Refresh before retrying.");
      }
    });
  }

  return (
    <StaffScreen>
      <Link
        href="/staff/driver/trips"
        className="mb-4 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[#19563c]"
      >
        <ArrowLeft size={18} aria-hidden="true" /> Back to trips
      </Link>
      <StaffScreenHeader
        title="Trip details"
        subtitle={`${job.bookingDate} · ${formatTime12h(job.startTime)}`}
        trailing={
          <StaffStatusChip tone={progress === "not_started" ? "gold" : "green"}>
            {getDriverProgressLabel(current)}
          </StaffStatusChip>
        }
      />
      <StaffCard className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#76501a]">Customer</p>
        <h2 className="mt-1 text-lg font-semibold text-[#163a2b]">{job.customerName}</h2>
        <p className="mt-1 text-sm text-[#65746b]">{job.serviceName}</p>
        <div className="mt-4 space-y-2 text-sm text-[#526358]">
          <p className="flex items-start gap-2">
            <Clock3 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {formatTime12h(job.startTime)} – {formatTime12h(job.endTime)}
          </p>
          <p className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {destination ?? "Destination pending"}
          </p>
        </div>
        {navigationUrl ? (
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#c8a96b] px-4 text-sm font-semibold text-[#163a2b]"
          >
            <Navigation size={17} aria-hidden="true" /> Open in Maps
          </a>
        ) : null}
      </StaffCard>

      <StaffCard className="mt-5 p-4">
        <h2 className="text-sm font-semibold text-[#163a2b]">Trip progress</h2>
        <p className="mt-2 text-sm text-[#526358]">
          Current state: {getDriverProgressLabel(current)}
        </p>
        {travelStartedAt ? (
          <p className="mt-2 text-xs text-[#65746b]">Travel started {timeLabel(travelStartedAt)}</p>
        ) : null}
        {arrivedAt ? (
          <p className="mt-1 text-xs text-[#65746b]">Arrived {timeLabel(arrivedAt)}</p>
        ) : null}
        {job.sessionStartedAt ? (
          <p className="mt-1 text-xs text-[#65746b]">
            Service started {timeLabel(job.sessionStartedAt)}
          </p>
        ) : null}
        {job.completedAt ? (
          <p className="mt-1 text-xs text-[#65746b]">Completed {timeLabel(job.completedAt)}</p>
        ) : null}
        {progress === "arrived" ? (
          <p className="mt-3 text-xs text-[#65746b]">
            The assigned provider controls service start and completion.
          </p>
        ) : null}
      </StaffCard>

      {error ? (
        <StaffFeedback error className="mt-4">
          {error}
        </StaffFeedback>
      ) : null}
      {feedback ? <StaffFeedback className="mt-4">{feedback}</StaffFeedback> : null}
      {action ? (
        <StaffButton className="mt-5 w-full" onClick={advance} disabled={pending}>
          {pending ? "Updating…" : action.label}
        </StaffButton>
      ) : progress === "completed" ? (
        <StaffCard className="mt-5 p-5 text-center">
          <CheckCircle2 size={38} className="mx-auto text-[#19563c]" aria-hidden="true" />
          <p className="mt-2 text-base font-semibold">Service completed</p>
          <Link
            href="/staff/driver/trips"
            className="mt-3 inline-flex min-h-12 items-center text-sm font-semibold text-[#19563c]"
          >
            View trips
          </Link>
        </StaffCard>
      ) : null}
    </StaffScreen>
  );
}
