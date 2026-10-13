"use client";

import { CheckCircle2, Clock3, Home, MapPin, Stethoscope, UserRound } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BookingProgressActions } from "@/components/features/staff-portal/booking-progress-actions";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";
import { StaffCard, StaffStatusChip } from "@/components/features/staff-pwa/native-foundation";

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function progressLabel(progressStatus: string, bookingStatus: string): string {
  if (bookingStatus === "no_show") return "No Show";

  switch (progressStatus) {
    case "session_started":
      return "In Progress";
    case "checked_in":
      return "Checked In";
    case "travel_started":
      return "Traveling";
    case "arrived":
      return "Arrived";
    case "completed":
      return "Completed";
    default:
      return "Ready";
  }
}

type TherapistServiceProgressCardProps = {
  booking: StaffPortalBooking;
  showControls?: boolean;
};

export function TherapistServiceProgressCard({
  booking,
  showControls = true,
}: TherapistServiceProgressCardProps) {
  const service = firstRelation(booking.services);
  const customer = firstRelation(booking.customers);
  const isHome = booking.delivery_type === "home_service";

  const address =
    (booking.metadata?.address as string | undefined) ??
    (booking.metadata?.home_address as string | undefined) ??
    null;

  const label = progressLabel(booking.booking_progress_status, booking.status);
  const completedAt = booking.session_completed_at ?? booking.completed_at;
  const startAt = booking.session_started_at ?? booking.checked_in_at;
  const durationMinutes =
    startAt && completedAt
      ? Math.max(
          0,
          Math.round((new Date(completedAt).getTime() - new Date(startAt).getTime()) / 60000)
        )
      : null;
  const formatTimestamp = (value: string) =>
    new Date(value).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

  return (
    <StaffCard as="article" className="overflow-hidden">
      {!showControls && booking.booking_progress_status === "completed" ? (
        <div className="flex items-center gap-2 bg-[#163a2b] px-4 py-2.5 text-xs font-semibold text-white">
          <CheckCircle2 size={17} className="text-[#d9ba73]" />
          Service completed
        </div>
      ) : null}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={
              isHome
                ? "grid size-11 shrink-0 place-items-center rounded-full bg-[#F8EDD9] text-[#8E6122]"
                : "grid size-11 shrink-0 place-items-center rounded-full bg-[#ECF6EF] text-[#0D6548]"
            }
          >
            {isHome ? <Home size={20} /> : <Stethoscope size={20} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-[#1A3042]">
                  {service?.name ?? "Service"}
                </div>
                {service?.duration_minutes ? (
                  <div className="mt-0.5 text-[11px] text-[#7A8796]">
                    {service.duration_minutes} min
                  </div>
                ) : null}
              </div>

              <StaffStatusChip>{label}</StaffStatusChip>
            </div>

            <div className="mt-3 space-y-1.5 text-[12px] text-[#536477]">
              {customer ? (
                <div className="flex items-center gap-2">
                  <UserRound size={14} />
                  {customer.full_name}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Clock3 size={14} />
                <span className="tabular-nums">
                  {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                </span>
              </div>

              {isHome ? (
                address ? (
                  <div className="flex items-start gap-2">
                    <Home size={14} className="mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{address}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Home size={14} />
                    Home Service
                  </div>
                )
              ) : booking.branch_resources ? (
                <div className="flex items-center gap-2">
                  <MapPin size={14} />
                  {booking.branch_resources.name}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!showControls &&
      booking.booking_progress_status === "completed" &&
      (booking.checked_in_at || completedAt) ? (
        <div className="mx-4 mb-4 grid grid-cols-3 gap-2 rounded-[15px] bg-[#f3eee3] p-3 text-center text-[10px] text-[#65746b]">
          <div>
            <div className="font-bold text-[#163a2b]">
              {booking.checked_in_at ? formatTimestamp(booking.checked_in_at) : "—"}
            </div>
            Check-in
          </div>
          <div>
            <div className="font-bold text-[#163a2b]">
              {completedAt ? formatTimestamp(completedAt) : "—"}
            </div>
            Completed
          </div>
          <div>
            <div className="font-bold text-[#163a2b]">
              {durationMinutes !== null && Number.isFinite(durationMinutes)
                ? `${durationMinutes} min`
                : "—"}
            </div>
            Duration
          </div>
        </div>
      ) : null}

      {showControls ? (
        <div className="border-t border-[#EEE9E2] bg-[#FCFBF8] px-4 py-3">
          <BookingProgressActions booking={booking} />
        </div>
      ) : null}
    </StaffCard>
  );
}
