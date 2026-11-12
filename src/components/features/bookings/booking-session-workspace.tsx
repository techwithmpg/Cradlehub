"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeftRight, CheckCircle2, Loader2, Sparkles, TimerReset } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { getBookingDurationMinutes } from "@/lib/bookings/booking-display";
import { AnimatedSessionTimer } from "./animated-session-timer";
import {
  commitSessionExtensionAction,
  previewSessionExtensionAction,
  type SessionExtensionPreview,
} from "@/lib/bookings/session-extension-actions";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";

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
  const router = useRouter();
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState(20);
  const [showCustom, setShowCustom] = useState(false);
  const [preview, setPreview] = useState<SessionExtensionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isPending, startTransition] = useTransition();

  const duration = getBookingDurationMinutes(line);
  const startedMs = Date.parse(line.session_started_at ?? "");
  const dueMs = Date.parse(line.session_due_at ?? "");
  const recordedPlanMinutes =
    Number.isFinite(startedMs) && Number.isFinite(dueMs) && dueMs > startedMs
      ? Math.max(1, Math.round((dueMs - startedMs) / 60_000))
      : null;

  const completed =
    line.status === "completed" ||
    line.booking_progress_status === "completed" ||
    Boolean(line.session_completed_at);

  const canExtend =
    !completed &&
    line.status !== "cancelled" &&
    line.status !== "no_show" &&
    (line.status === "in_progress" ||
      line.booking_progress_status === "session_started" ||
      line.booking_progress_status === "checked_in" ||
      line.status === "confirmed");

  useEffect(() => {
    if (selectedMinutes === null || selectedMinutes <= 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    previewSessionExtensionAction({
      bookingId: line.id,
      extraMinutes: selectedMinutes,
    })
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [line.id, selectedMinutes]);

  function handleConfirmExtension() {
    if (!selectedMinutes || !preview?.ok) return;
    startTransition(async () => {
      const res = await commitSessionExtensionAction({
        bookingId: line.id,
        extraMinutes: selectedMinutes,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSelectedMinutes(null);
      setPreview(null);
      notifyBookingsChanged();
      router.refresh();
    });
  }

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
                {canExtend
                  ? `Add time for ${recipientName}. Automatically syncs timer, checkout total, and next-booking conflicts.`
                  : "Available for active or checked-in sessions."}
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

          {canExtend ? (
            <>
              <div
                className="mt-3 flex flex-wrap gap-2"
                role="group"
                aria-label="Extension duration"
              >
                {[15, 30, 45, 60].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={selectedMinutes === minutes && !showCustom}
                    onClick={() => {
                      setSelectedMinutes(minutes);
                      setShowCustom(false);
                    }}
                    className={`min-h-9 rounded-full border px-4 text-sm font-semibold transition ${
                      selectedMinutes === minutes && !showCustom
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                        : "border-neutral-200 text-neutral-800 hover:bg-neutral-50"
                    }`}
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
                  className={`min-h-9 rounded-full border px-4 text-sm font-semibold transition ${
                    showCustom
                      ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                      : "border-neutral-200 text-neutral-800 hover:bg-neutral-50"
                  }`}
                >
                  Custom
                </button>
                {showCustom ? (
                  <label className="flex items-center gap-2 text-sm">
                    Minutes{" "}
                    <input
                      type="number"
                      min={5}
                      max={180}
                      step={5}
                      value={customMinutes}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setCustomMinutes(value);
                        setSelectedMinutes(value);
                      }}
                      className="h-10 w-20 rounded-lg border border-neutral-300 px-2 font-semibold"
                    />
                  </label>
                ) : null}
              </div>

              {loadingPreview ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                  <Loader2 className="size-4 animate-spin text-emerald-700" />
                  Checking therapist schedule, room availability, and FCFS auto-swap options…
                </div>
              ) : preview ? (
                <div className="mt-3 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 p-2.5 text-xs">
                    <div>
                      <span className="text-neutral-500 block">New Duration</span>
                      <strong className="text-neutral-900">
                        {preview.currentDurationMinutes}m → {preview.newDurationMinutes}m
                      </strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Extension Add-On</span>
                      <strong className="text-emerald-800">
                        +₱{preview.additionalPrice.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">New Service Total</span>
                      <strong className="text-neutral-950">
                        ₱{preview.newTotalPrice.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {preview.resolution.kind === "clear" ? (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                      <span>{preview.resolution.summary}</span>
                    </div>
                  ) : preview.resolution.kind === "domino_auto_swap" ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                      <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-amber-800" />
                      <div>
                        <p className="font-bold flex items-center gap-1">
                          <Sparkles className="size-3.5" />
                          Automatic Domino Re-Assignment Available
                        </p>
                        <p className="mt-0.5">{preview.resolution.summary}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                      <span>{preview.resolution.reason}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!preview.ok || isPending}
                      onClick={handleConfirmExtension}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0D5C43] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#163A2B] disabled:opacity-50"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Applying Extension…
                        </>
                      ) : preview.resolution.kind === "domino_auto_swap" ? (
                        `Extend +${selectedMinutes}m & Auto-Swap Next Booking (+₱${preview.additionalPrice.toFixed(2)})`
                      ) : (
                        `Confirm +${selectedMinutes}m Extension (+₱${preview.additionalPrice.toFixed(2)})`
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
