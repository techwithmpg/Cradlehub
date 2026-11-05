"use client";

import { useState } from "react";
import { AlertCircle, TimerReset } from "lucide-react";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { getBookingDurationMinutes } from "@/lib/bookings/booking-display";
import { AnimatedSessionTimer } from "./animated-session-timer";

const PHILIPPINE_TIME = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});

function clock(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "Not recorded" : PHILIPPINE_TIME.format(time);
}

export function BookingSessionWorkspace({
  line,
  recipientName,
  onClose,
}: {
  line: WorkspaceBookingRow;
  recipientName: string;
  onClose: () => void;
}) {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState(10);
  const [showCustom, setShowCustom] = useState(false);
  const duration = getBookingDurationMinutes(line);
  const startedMs = Date.parse(line.session_started_at ?? "");
  const dueMs = Date.parse(line.session_due_at ?? "");
  const recordedPlanMinutes =
    Number.isFinite(startedMs) && Number.isFinite(dueMs) && dueMs > startedMs
      ? Math.max(1, Math.round((dueMs - startedMs) / 60_000))
      : null;
  const active =
    line.status === "in_progress" &&
    line.booking_progress_status === "session_started" &&
    recordedPlanMinutes !== null &&
    !line.session_completed_at;
  const completed =
    line.status === "completed" ||
    line.booking_progress_status === "completed" ||
    Boolean(line.session_completed_at);

  return (
    <div className="border-t border-neutral-200 bg-white px-4 py-3 sm:px-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
        <section
          aria-label="Session timer"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"
        >
          <AnimatedSessionTimer session={{ ...line, durationMinutes: duration }} />
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Started</dt>
              <dd className="font-semibold">{clock(line.session_started_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Planned end</dt>
              <dd className="font-semibold">{clock(line.session_due_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Planned duration</dt>
              <dd className="font-semibold">{recordedPlanMinutes ?? duration} min</dd>
            </div>
            {recordedPlanMinutes !== null && recordedPlanMinutes !== duration ? (
              <div>
                <dt className="text-xs text-neutral-500">Purchased duration</dt>
                <dd className="font-semibold">{duration} min</dd>
              </div>
            ) : null}
            {completed ? (
              <div>
                <dt className="text-xs text-neutral-500">Completed</dt>
                <dd className="font-semibold">{clock(line.session_completed_at)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section
          aria-label="Extend session"
          className="min-w-0 rounded-xl border border-neutral-200 p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-neutral-950">
                <TimerReset className="size-5 text-emerald-700" /> Extend Session
              </h3>
              <p className="text-xs text-neutral-600">
                {active
                  ? `Review more time for ${recipientName}.`
                  : "Available only while a service is in progress."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-9 rounded-lg border border-neutral-200 px-4 text-sm font-semibold hover:bg-neutral-50"
            >
              Keep original end time
            </button>
          </div>
          {active ? (
            <>
              {!line.order_id ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
                  This booking has no linked order. Ask a manager to review payment before adding time.
                </p>
              ) : null}
              <div
                className="mt-3 flex flex-wrap gap-2"
                role="group"
                aria-label="Extension duration"
              >
                {[15, 30, 45].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={selectedMinutes === minutes && !showCustom}
                    onClick={() => {
                      setSelectedMinutes(minutes);
                      setShowCustom(false);
                    }}
                    className={`min-h-9 rounded-full border px-4 text-sm font-semibold ${selectedMinutes === minutes && !showCustom ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-neutral-200 text-neutral-800"}`}
                  >
                    +{minutes} min
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={showCustom}
                  onClick={() => {
                    setShowCustom(true);
                    setSelectedMinutes(customMinutes);
                  }}
                  className={`min-h-9 rounded-full border px-4 text-sm font-semibold ${showCustom ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-neutral-200 text-neutral-800"}`}
                >
                  Custom
                </button>
                {showCustom ? (
                  <label className="flex items-center gap-2 text-sm">
                    Minutes{" "}
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={customMinutes}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setCustomMinutes(value);
                        setSelectedMinutes(value);
                      }}
                      className="h-10 w-20 rounded-lg border border-neutral-300 px-2"
                    />
                  </label>
                ) : null}
              </div>
              {selectedMinutes !== null ? (
                <div
                  role="status"
                  className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    +{selectedMinutes} min is a request only. Therapist, room, shift, hours, and
                    additional price cannot yet be verified together. The original session remains
                    unchanged.
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                disabled
                className="mt-3 min-h-9 rounded-lg bg-neutral-200 px-4 text-sm font-semibold text-neutral-500"
                title="Server availability and financial confirmation are not available"
              >
                Apply Extension
              </button>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
              This service cannot be extended in its current state.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
