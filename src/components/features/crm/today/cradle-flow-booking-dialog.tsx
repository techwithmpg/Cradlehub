"use client";

import Link from "next/link";
import { Clock3, Home, MapPin, Phone, UserRound } from "lucide-react";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import {
  formatCradleFlowMoney,
  getCradleFlowPrimaryLabel,
  getCradleFlowStage,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";

function timeLabel(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  if (value.includes("T")) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
    }
  }
  const [hourRaw, minuteRaw] = value.split(":").map(Number);
  const hour = hourRaw ?? 0;
  return `${hour % 12 || 12}:${String(minuteRaw ?? 0).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--cs-text)]">{value}</div>
    </div>
  );
}

export function CradleFlowBookingDialog({
  booking,
  open,
  onOpenChange,
  onPrimary,
}: {
  booking: CradleFlowBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrimary: (booking: CradleFlowBooking) => void;
}) {
  if (!booking) return null;
  const homeService = booking.type === "home_service" || booking.delivery_type === "home_service";
  const stage = getCradleFlowStage(booking);
  const metadata = booking.metadata ?? {};
  const notes = typeof metadata.customer_notes === "string" ? metadata.customer_notes : "No notes";

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      size="lg"
      ariaLabel="Booking details"
      className="max-h-[88dvh]"
    >
      <AdminOverlayHeader
        title={booking.customer_name ?? "Booking details"}
        description={`${homeService ? "Home Service" : "In-spa"} · ${booking.booking_date} · ${timeLabel(booking.start_time)}`}
      />
      <AdminOverlayBody className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Current state
            </div>
            <div className="mt-1 text-lg font-extrabold capitalize text-[var(--cs-text)]">
              {(stage ?? "closed").replaceAll("_", " ")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-[var(--cs-text)]">
              {formatCradleFlowMoney(booking.price_paid ?? 0)}
            </div>
            <div className="text-xs font-bold uppercase text-[var(--cs-text-muted)]">
              {booking.payment_status === "paid" ? "Paid" : "Payment pending"}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Detail
            label="Customer"
            value={booking.customer_name ?? "Unnamed customer"}
            icon={<UserRound className="size-3" />}
          />
          <Detail
            label="Phone"
            value={booking.customer_phone ?? "Not recorded"}
            icon={<Phone className="size-3" />}
          />
          <Detail label="Service" value={booking.service_name ?? "Service"} />
          <Detail label="Guests" value="1 guest" />
          <Detail
            label="Therapist"
            value={booking.staff_name ?? "Needs assignment"}
            icon={<UserRound className="size-3" />}
          />
          <Detail
            label={homeService ? "Service address" : "Room"}
            value={
              homeService
                ? (booking.hs_address ?? "Address needs review")
                : (booking.resource_name ?? "Not assigned")
            }
            icon={homeService ? <Home className="size-3" /> : <MapPin className="size-3" />}
          />
        </div>

        <section>
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Service timeline
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Detail
              label="Booked"
              value={timeLabel(booking.start_time)}
              icon={<Clock3 className="size-3" />}
            />
            <Detail label="Started" value={timeLabel(booking.session_started_at)} />
            <Detail label="Completed" value={timeLabel(booking.session_completed_at)} />
          </div>
        </section>

        <Detail label="Notes" value={notes} />

        {booking.needs_staff_schedule_review || booking.dispatch_warning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {booking.staff_schedule_exception_label ??
              booking.dispatch_warning ??
              "This booking needs operational review."}
          </div>
        ) : null}
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/crm/bookings?bookingId=${booking.id}`}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--cs-border)] px-4 text-sm font-bold text-[var(--cs-text-secondary)]"
        >
          Open full booking
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="cs-btn cs-btn-secondary h-10 rounded-lg px-4"
          >
            Close
          </button>
          {stage ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onPrimary(booking);
              }}
              className="h-10 rounded-lg bg-[#164b36] px-4 text-sm font-bold text-white"
            >
              {getCradleFlowPrimaryLabel(booking)}
            </button>
          ) : null}
        </div>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
