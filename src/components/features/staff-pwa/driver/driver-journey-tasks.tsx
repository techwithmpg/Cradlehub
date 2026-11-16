"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTime12h } from "@/lib/utils/time-format";
import { MapPin, Navigation } from "lucide-react";
import {
  journeyLabel,
  nextJourneyAction,
  journeySchema,
  travellingStages,
  type DriverJourney,
} from "@/lib/driver/journey";
export function DriverJourneyTasks({
  journeys,
  error,
  navigationPane = false,
}: {
  journeys: DriverJourney[];
  error?: string;
  navigationPane?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState<DriverJourney | null>(null);
  async function confirm(j: DriverJourney) {
    const action = nextJourneyAction(j);
    if (!action) return;
    start(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/staff/driver/journeys", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bookingId: j.bookingId,
            requestId: crypto.randomUUID(),
            expectedRevision: j.revision,
            action: action.action,
          }),
        });
        const result = await response.json();
        const verified = journeySchema.safeParse(result.journey);
        if (!response.ok || !result.ok || !verified.success) {
          setMessage(result.message ?? "The journey was not confirmed. Refresh before retrying.");
          router.refresh();
          return;
        }
        setCurrent(verified.data);
        router.refresh();
      } catch {
        setMessage("Connection lost. Refresh the journey before acting again.");
      }
    });
  }
  return (
    <section aria-label="Transport journeys">
      {error && (
        <p role="alert" className="my-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </p>
      )}
      {journeys
        .filter((j) => j.stage !== "complete")
        .map((original) => {
          const j =
            current?.bookingId === original.bookingId && current.revision >= original.revision
              ? current
              : original;
          const action = nextJourneyAction(j);
          return (
            <article
              key={j.bookingId}
              className="mt-4 rounded-2xl border border-[#d8e1d0] bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64795f]">
                {j.leg ?? "Service and collection"}
              </p>
              <h2 className="mt-2 text-lg font-bold text-[#163a2b]">{journeyLabel(j)}</h2>
              <p className="mt-2 text-sm text-[#65746b]">
                Therapist: {j.therapistName ?? "Assigned provider"}
              </p>
              {j.customerName && (
                <p className="mt-1 text-sm text-[#65746b]">Customer: {j.customerName}</p>
              )}
              {j.bookingDate && j.startTime && (
                <p className="mt-2 text-sm font-semibold text-[#53675b]">
                  Appointment: {j.bookingDate} · {formatTime12h(j.startTime)}
                </p>
              )}
              {j.pickupLabel && (
                <p className="mt-2 text-sm text-[#65746b]">Pickup: {j.pickupLabel}</p>
              )}
              {j.customerAddress && j.leg === "pickup" && (
                <p className="mt-1 text-sm text-[#65746b]">
                  Customer destination: {j.customerAddress}
                </p>
              )}
              {j.destination && (
                <p className="mt-3 flex gap-2 text-sm text-[#65746b]">
                  <MapPin size={17} />
                  {j.destination.label}
                </p>
              )}
              {(action?.action === "start" || travellingStages.has(j.stage)) && navigationPane ? (
                <p className="mt-4 rounded-xl bg-[#f7f4ec] p-4 text-sm text-[#53675b]">
                  Open this trip in the CradleHub Android app for live navigation and GPS arrival.
                </p>
              ) : action?.action === "start" || travellingStages.has(j.stage) ? (
                <a
                  href={`/staff/driver/map?bookingId=${encodeURIComponent(j.bookingId)}&launch=native`}
                  className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#185d40] px-4 font-semibold text-white"
                >
                  <Navigation size={18} />
                  {travellingStages.has(j.stage) ? "Resume navigation" : "View route"}
                </a>
              ) : action ? (
                <button
                  disabled={pending}
                  onClick={() => void confirm(j)}
                  className="mt-4 min-h-12 w-full rounded-xl bg-[#185d40] px-4 font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Confirming…" : action.label}
                </button>
              ) : (
                <p className="mt-3 text-xs text-[#65746b]">
                  {j.reason ??
                    "Status comes from the authorized service workflow. Collection is tracked separately."}
                </p>
              )}
            </article>
          );
        })}
      {message && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </p>
      )}
    </section>
  );
}
