"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Navigation, ShieldAlert } from "lucide-react";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import { invalidateStaffSafeMemory } from "@/components/features/staff-pwa/safe-memory";
import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

/**
 * One focused entry point for a specific, server-authorized Driver assignment.
 *
 * The first tap is the notice: it opens this route automatically. The only
 * driver mutation is Start Trip, using the EXISTING server-authorized action.
 * The follow-on in-app navigation request is a same-origin page URL that the
 * approved Android companion intercepts. A normal browser uses the existing
 * combined PWA map as its fallback instead.
 *
 * No local state, URL parameter or push payload grants booking authority.
 */
export function DriverFocusedTripRoute({
  job,
  verifiedDestination,
}: {
  job: RealDispatchItem;
  verifiedDestination: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isReady = job.bookingProgressStatus === "not_started";
  const isEnRoute = job.bookingProgressStatus === "travel_started" &&
    job.dispatchStatus === "in_route";
  const canNavigate = (isReady || isEnRoute) &&
    ["confirmed", "in_progress"].includes(job.bookingStatus) &&
    verifiedDestination;
  const destination = job.formattedAddress ?? job.area ?? "Destination awaiting CRM verification";
  const nativeUrl = `/staff/driver/map?bookingId=${encodeURIComponent(job.id)}&nativeNavigation=1`;

  function startTrip() {
    if (pending || !canNavigate) return;
    if (isEnRoute) {
      // The Android WebView intercepts this explicit same-origin route request
      // and rechecks authorization against /api/staff/driver/native-itinerary.
      window.location.assign(nativeUrl);
      return;
    }
    if (!isReady) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await updateBookingProgressAction({
          bookingId: job.id,
          nextStatus: "travel_started",
        });
        if (!result.ok) {
          setError(result.message ?? "Could not start this trip.");
          return;
        }
        invalidateStaffSafeMemory(["driverToday", "driverTrips", "driverMap"]);
        // NEVER navigate before the server has confirmed Start Trip.
        // A web PWA without the Android companion lands on the in-app road map.
        window.location.assign(nativeUrl);
      } catch {
        setError("Could not start this trip. Check the connection and try again.");
      }
    });
  }

  return (
    <main className="mx-auto min-h-[70dvh] max-w-lg px-4 pb-8 pt-5">
      <Link
        href="/staff/driver"
        className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[#19563c]"
      >
        <ArrowLeft size={18} aria-hidden="true" /> My trips
      </Link>
      <header className="mt-3 rounded-[26px] bg-[linear-gradient(150deg,#174332,#092c20)] px-5 py-7 text-white">
        <p className="text-sm font-medium text-[#dfca92]">
          {isEnRoute ? "Travel in progress" : isReady ? "Assigned Home Service trip" : "Trip status"}
        </p>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.03em]">
          {isEnRoute ? "Continue your route" : isReady ? "Ready to go?" : "Trip status updated"}
        </h1>
        <p className="mt-1 text-sm text-white/75">
          {isEnRoute ? "Resume your navigation to the customer." :
            isReady ? "One tap starts your trip and opens navigation." :
            "Your trip is being managed in CradleHub."}
        </p>
      </header>

      <section aria-label="Assigned trip" className="mt-5 rounded-3xl border border-[#e2dfd6] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#795d32]">Destination</p>
        <h2 className="mt-2 break-words text-xl font-semibold text-[#163a2b]">{job.customerName}</h2>
        <p className="mt-1 text-sm text-[#65746b]">{job.serviceName}</p>
        <div className="mt-5 flex items-center gap-3 text-sm text-[#526358]">
          <Clock3 size={20} className="shrink-0" aria-hidden="true" />
          {formatTime12h(job.startTime)}
        </div>
        <div className="mt-4 flex items-start gap-3 text-sm text-[#526358]">
          <MapPin size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="break-words">{destination}</span>
        </div>
      </section>

      {error ? (
        <p role="alert" className="mt-4 rounded-2xl bg-[#fff0ee] p-4 text-sm text-[#9d3434]">
          {error}
        </p>
      ) : null}
      {!verifiedDestination && (isReady || isEnRoute) ? (
        <p role="status" className="mt-4 flex gap-2 rounded-2xl border border-[#e5c992] bg-[#fff8e9] p-4 text-sm text-[#79501a]">
          <ShieldAlert size={20} className="shrink-0" aria-hidden="true" />
          CRM must verify this destination&apos;s GPS before navigation can start.
        </p>
      ) : null}

      {canNavigate ? (
        <button
          type="button"
          onClick={startTrip}
          disabled={pending}
          className="mt-5 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#0d6548] px-5 text-lg font-semibold text-white shadow-[0_8px_22px_rgba(13,101,72,.18)] disabled:opacity-60"
        >
          <Navigation size={24} aria-hidden="true" />
          {pending ? "Starting trip…" : isEnRoute ? "Resume Navigation" : "Start Trip"}
        </button>
      ) : (
        <p className="mt-5 rounded-2xl border border-[#e2dfd6] bg-[#f7f3eb] p-4 text-center text-sm text-[#526358]">
          This trip cannot be started from its current status. Check Trips or contact CRM.
        </p>
      )}
      <div className="mt-4 text-center">
        <Link href={`/staff/driver/trips/${encodeURIComponent(job.id)}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[#19563c] underline underline-offset-4">
          Trip details
        </Link>
      </div>
    </main>
  );
}
