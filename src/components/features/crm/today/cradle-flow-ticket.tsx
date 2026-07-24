"use client";

import { Clock3, Home, MapPin, MoreHorizontal, UserRound } from "lucide-react";
import {
  formatCradleFlowMoney,
  getCradleFlowPrimaryLabel,
  getCradleFlowStage,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";
import { cn } from "@/lib/utils";

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [hoursRaw, minutesRaw] = value.split(":").map(Number);
  const hours = hoursRaw ?? 0;
  return `${hours % 12 || 12}:${String(minutesRaw ?? 0).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function stageLabel(booking: CradleFlowBooking): string {
  const stage = getCradleFlowStage(booking);
  if (stage === "in_service") return "In Service";
  if (stage === "ready_to_pay") return "Ready to Pay";
  if (stage === "completed") return "Completed";
  return "Waiting";
}

export function CradleFlowTicket({
  booking,
  onOpen,
  onPrimary,
}: {
  booking: CradleFlowBooking;
  onOpen: (booking: CradleFlowBooking) => void;
  onPrimary: (booking: CradleFlowBooking) => void;
}) {
  const stage = getCradleFlowStage(booking) ?? "waiting";
  const isHomeService = booking.type === "home_service" || booking.delivery_type === "home_service";

  return (
    <article className="grid gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)] transition hover:border-[var(--cs-border-strong)] hover:shadow-[var(--cs-shadow-sm)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <button type="button" onClick={() => onOpen(booking)} className="min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-extrabold text-[var(--cs-text)]">
            {booking.customer_name ?? "Unnamed customer"}
          </h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              stage === "waiting" && "bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]",
              stage === "in_service" && "bg-emerald-100 text-emerald-900",
              stage === "ready_to_pay" && "bg-amber-100 text-amber-900",
              stage === "completed" && "bg-stone-100 text-stone-700"
            )}
          >
            {stageLabel(booking)}
          </span>
          {isHomeService ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cs-warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--cs-warning-text)]">
              <Home className="size-3" /> Home Service
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--cs-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" />
            {formatTime(booking.start_time)}
            {booking.service_duration ? ` · ${booking.service_duration} min` : ""}
          </span>
          <span>{booking.service_name ?? "Service"}</span>
        </div>

        <div className="mt-3 grid gap-1.5 text-xs text-[var(--cs-text-secondary)] sm:grid-cols-2">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound className="size-3.5 shrink-0 text-[var(--cs-sand)]" />
            <span className="truncate">Therapist: {booking.staff_name ?? "Needs assignment"}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-[var(--cs-sand)]" />
            <span className="truncate">
              {isHomeService
                ? (booking.hs_address ?? "Address needs review")
                : `Room: ${booking.resource_name ?? "Not assigned"}`}
            </span>
          </span>
        </div>
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] pt-3 lg:min-w-52 lg:justify-end lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <div className="lg:text-right">
          <div className="text-base font-extrabold tabular-nums text-[var(--cs-text)]">
            {formatCradleFlowMoney(booking.price_paid ?? 0)}
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {booking.payment_status === "paid" ? "Paid" : "Payment pending"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onPrimary(booking)}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#164b36] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0e3d2b]"
        >
          {getCradleFlowPrimaryLabel(booking)}
        </button>
        <button
          type="button"
          onClick={() => onOpen(booking)}
          className="grid size-9 place-items-center rounded-lg border border-[var(--cs-border)] text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface-warm)]"
          aria-label={`More actions for ${booking.customer_name ?? "booking"}`}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </article>
  );
}
