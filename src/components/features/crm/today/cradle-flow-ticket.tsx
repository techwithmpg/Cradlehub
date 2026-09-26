"use client";

import { Home, MapPin, MoreHorizontal, User } from "lucide-react";
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

function stageBadgeStyle(stage: string | null) {
  switch (stage) {
    case "in_service":
      return "bg-emerald-50 text-emerald-800 border-emerald-200/60";
    case "ready_to_pay":
      return "bg-amber-50 text-amber-800 border-amber-200/60";
    case "completed":
      return "bg-stone-100 text-stone-700 border-stone-200/60";
    case "waiting":
    default:
      return "bg-[#FAF2EB] text-[#8C623E] border-[#F0E0D2]";
  }
}

function stageLabel(booking: CradleFlowBooking): string {
  const stage = getCradleFlowStage(booking);
  if (stage === "in_service") return "IN SERVICE";
  if (stage === "ready_to_pay") return "READY TO PAY";
  if (stage === "completed") return "COMPLETED";
  return "WAITING";
}

const AVATAR_PALETTES = [
  "bg-rose-50 text-rose-700 border-rose-200/60",
  "bg-amber-50 text-amber-700 border-amber-200/60",
  "bg-orange-50 text-orange-700 border-orange-200/60",
  "bg-sky-50 text-sky-700 border-sky-200/60",
  "bg-purple-50 text-purple-700 border-purple-200/60",
  "bg-teal-50 text-teal-700 border-teal-200/60",
  "bg-emerald-50 text-emerald-700 border-emerald-200/60",
];

function getAvatarPalette(name?: string | null): string {
  if (!name) return AVATAR_PALETTES[0]!;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTES.length;
  }
  return AVATAR_PALETTES[hash]!;
}

function getInitials(name?: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
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
  const stage = getCradleFlowStage(booking);
  const isHomeService = booking.type === "home_service" || booking.delivery_type === "home_service";
  const initials = getInitials(booking.customer_name);
  const palette = getAvatarPalette(booking.customer_name);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-white p-3 sm:p-3.5 transition-all hover:border-stone-300 hover:shadow-xs sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Avatar + Details */}
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        {/* Avatar */}
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold tracking-tight",
            palette
          )}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(booking)}
              className="truncate text-left text-sm font-bold text-[var(--cs-text)] hover:text-emerald-800 transition-colors"
            >
              {booking.customer_name ?? "Unnamed customer"}
            </button>
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
                stageBadgeStyle(stage)
              )}
            >
              {stageLabel(booking)}
            </span>
            {isHomeService ? (
              <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                <Home className="size-2.5" /> Home Service
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--cs-text-muted)]">
            <span className="font-medium text-[var(--cs-text-secondary)]">
              {formatTime(booking.start_time)}
              {booking.service_duration ? ` · ${booking.service_duration} min` : ""}
            </span>
            <span>·</span>
            <span className="truncate font-normal">{booking.service_name ?? "Service"}</span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-[var(--cs-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <User className="size-3 text-stone-400" />
              <span>Therapist: {booking.staff_name ?? "Not assigned"}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 text-stone-400" />
              <span className="truncate">
                {isHomeService
                  ? (booking.hs_address ?? "Address review")
                  : `Room: ${booking.resource_name ?? "Not assigned"}`}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: Amount + Payment Status + Action + Overflow */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] pt-2.5 sm:border-t-0 sm:pt-0 shrink-0">
        <div className="text-left sm:text-right">
          <div className="text-sm font-bold tabular-nums text-[var(--cs-text)]">
            {formatCradleFlowMoney(booking.price_paid ?? 0)}
          </div>
          <div
            className={cn(
              "text-[9px] font-bold tracking-wider uppercase",
              booking.payment_status === "paid" ? "text-emerald-700" : "text-[var(--cs-text-muted)]"
            )}
          >
            {booking.payment_status === "paid" ? "Paid" : "Payment Pending"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPrimary(booking)}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-[#0B472C] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#083823] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 shrink-0"
        >
          {getCradleFlowPrimaryLabel(booking)}
        </button>

        <button
          type="button"
          onClick={() => onOpen(booking)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--cs-border-soft)] text-stone-400 hover:bg-stone-50 hover:text-stone-700 transition"
          aria-label={`More actions for ${booking.customer_name ?? "booking"}`}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </article>
  );
}
