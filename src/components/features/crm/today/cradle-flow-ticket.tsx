"use client";

import { Home, MapPin, MoreHorizontal, UserRound } from "lucide-react";
import {
  formatCradleFlowMoney,
  getCradleFlowAmountPaid,
  getCradleFlowBalance,
  getCradleFlowPrimaryLabel,
  getCradleFlowStage,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";
import {
  getCradleFlowDisplayStatus,
  isHomeServiceVisit,
} from "./cradle-flow-display";

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [hoursRaw, minutesRaw] = value.split(":").map(Number);
  const hours = hoursRaw ?? 0;
  return `${hours % 12 || 12}:${String(minutesRaw ?? 0).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

export function CradleFlowTicket({
  booking,
  onOpen,
  onPrimary,
  onAssignRoom,
  onAssignTherapist,
}: {
  booking: CradleFlowBooking;
  onOpen: (booking: CradleFlowBooking) => void;
  onPrimary: (booking: CradleFlowBooking) => void;
  onAssignRoom: (booking: CradleFlowBooking) => void;
  onAssignTherapist: (booking: CradleFlowBooking) => void;
}) {
  const stage = getCradleFlowStage(booking);
  const homeService = isHomeServiceVisit(booking);
  const missingRoom = !homeService && !booking.resource_id && stage === "waiting";
  const missingTherapist = !booking.staff_name && stage === "waiting";
  const due = getCradleFlowBalance(booking);
  const paid = getCradleFlowAmountPaid(booking);
  const accent = stage === "ready_to_pay" ? "bg-violet-500"
    : stage === "in_service" ? "bg-emerald-500"
      : homeService ? "bg-blue-500"
        : stage === "completed" ? "bg-emerald-600" : "bg-orange-500";
  const statusTone = stage === "ready_to_pay" ? "bg-violet-50 text-violet-800"
    : stage === "in_service" ? "bg-emerald-50 text-emerald-800"
      : stage === "completed" ? "bg-stone-100 text-stone-700"
        : "bg-amber-50 text-amber-800";

  return (
    <article className="relative grid gap-2 overflow-hidden rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-3 shadow-[var(--cs-shadow-xs)] transition hover:border-[var(--cs-border-strong)] sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center lg:grid-cols-[4.5rem_minmax(0,1fr)_9rem_auto] lg:gap-3">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} aria-hidden="true" />
      <div className="pl-1 text-sm font-extrabold tabular-nums text-[var(--cs-text)]">
        {formatTime(booking.start_time)}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => onOpen(booking)} className="truncate text-left text-sm font-extrabold text-[var(--cs-text)] hover:underline">
            {booking.customer_name ?? "Unnamed customer"}
          </button>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone}`}>
            {getCradleFlowDisplayStatus(booking)}
          </span>
          {homeService ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              <Home className="size-3" aria-hidden="true" /> Home Service
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--cs-text-muted)]">
          <span>{booking.order_id ? `Order ${booking.order_id.slice(0, 8)}` : `Booking ${booking.id.slice(0, 8)}`}</span>
          <span aria-hidden="true">·</span>
          <span>{booking.service_name ?? "Service not recorded"}</span>
          {booking.service_duration ? <><span aria-hidden="true">·</span><span>{booking.service_duration} min</span></> : null}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--cs-text-secondary)]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
            Therapist: {booking.staff_name ?? "Not assigned"}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {homeService ? (booking.hs_address ?? "Address needs review") : `Room: ${booking.resource_name ?? (missingRoom ? "Not assigned" : "Room details unavailable")}`}
          </span>
        </div>
      </div>

      <div className="border-t border-[var(--cs-border-soft)] pt-2 text-xs sm:col-start-2 lg:col-auto lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
        <div className="font-extrabold tabular-nums text-[var(--cs-text)]">
          {formatCradleFlowMoney(booking.price_paid ?? 0)}
          <span className="ml-1 font-normal text-[var(--cs-text-muted)]">service total</span>
        </div>
        <div className="mt-0.5 tabular-nums text-[var(--cs-text-muted)]">
          {booking.order_id ? "Order " : ""}{formatCradleFlowMoney(paid)} paid · {formatCradleFlowMoney(due)} due
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:col-start-2 lg:col-auto">
        <button
          type="button"
          onClick={() => onPrimary(booking)}
          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#164b36] px-3 text-[11px] font-bold text-white transition hover:bg-[#0e3d2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          {getCradleFlowPrimaryLabel(booking)}
        </button>
        {missingRoom ? (
          <button type="button" onClick={() => onAssignRoom(booking)} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--cs-border)] px-2 text-[11px] font-bold text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]">
            Assign Room
          </button>
        ) : null}
        {missingTherapist ? (
          <button type="button" onClick={() => onAssignTherapist(booking)} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--cs-border)] px-2 text-[11px] font-bold text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]">
            Assign Therapist
          </button>
        ) : null}
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
