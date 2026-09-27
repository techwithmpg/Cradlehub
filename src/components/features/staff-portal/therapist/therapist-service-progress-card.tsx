"use client";

import {
  Clock3,
  Home,
  MapPin,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BookingProgressActions } from "@/components/features/staff-portal/booking-progress-actions";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function progressLabel(
  progressStatus: string,
  bookingStatus: string
): string {
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

  const label = progressLabel(
    booking.booking_progress_status,
    booking.status
  );

  return (
    <article className="overflow-hidden rounded-[22px] border border-[#EAE5DD] bg-white shadow-[0_7px_24px_rgba(30,41,59,0.055)]">
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

              <span className="rounded-full bg-[#E3F5E8] px-2.5 py-1 text-[10px] font-bold text-[#16734C]">
                {label}
              </span>
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

      {showControls ? (
        <div className="border-t border-[#EEE9E2] bg-[#FCFBF8] px-4 py-3">
          <BookingProgressActions booking={booking} />
        </div>
      ) : null}
    </article>
  );
}