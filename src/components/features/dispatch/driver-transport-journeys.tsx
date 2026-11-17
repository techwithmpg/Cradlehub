"use client";
import { journeyLabel } from "@/lib/driver/journey";
import type { DispatchJourney } from "@/lib/driver/dispatch";
export function DriverTransportJourneys({
  journeys,
  error,
}: {
  journeys?: DispatchJourney[];
  error?: string;
}) {
  if (!journeys && !error) return null;
  return (
    <section
      aria-label="Therapist transport and collection"
      className="rounded-xl border border-[#d8e1d0] bg-white p-4"
    >
      <h2 className="font-semibold text-[#163a2b]">Therapist transport and collection</h2>
      <p className="mt-1 text-xs text-[#65746b]">
        Service completion and transport completion are separate. Coordinates show the last
        authorized GPS report.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          {error}
        </p>
      ) : !journeys?.length ? (
        <p className="mt-3 text-sm text-[#65746b]">No open enrolled transport journeys.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {journeys.map(({ journey: j, driverName, location }) => (
            <li key={j.bookingId} className="rounded-lg bg-[#f7f5ee] p-3">
              <p className="text-sm font-semibold">{journeyLabel(j)}</p>
              <p className="mt-1 text-sm">
                {driverName ?? "Assigned driver"} · {j.therapistName ?? "Assigned therapist"}
              </p>
              <p className="mt-1 text-xs">
                {j.destination?.label ?? j.reason ?? "Awaiting service workflow"}
              </p>
              {location ? (
                <p className="mt-2 text-xs text-[#65746b]">
                  Last GPS: {location.lat.toFixed(5)}, {location.lng.toFixed(5)} ·{" "}
                  {location.recordedAt} · Verify freshness before acting
                </p>
              ) : (
                <p className="mt-2 text-xs text-[#65746b]">No GPS report for this journey.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
