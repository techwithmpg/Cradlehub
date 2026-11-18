"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  MoreHorizontal,
  Sparkles,
  UserCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  formatCradleFlowMoney,
  getCradleFlowAmountPaid,
  getCradleFlowBalance,
  getCradleFlowPrimaryLabel,
  getCradleFlowStage,
  getCradleFlowServiceRecipientName,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";
import { getCradleFlowDisplayStatus, isHomeServiceVisit } from "./cradle-flow-display";
import { formatBranchYmd } from "@/lib/engine/slot-time";
import type { CradleFlowGroup } from "./cradle-flow-display";
import { resolveBookingPartyIdentity } from "@/lib/bookings/booking-party-identity";
import { TherapistProvenanceBadge } from "@/components/features/bookings/therapist-provenance-badge";

function formatShortTherapistName(raw: string | null | undefined): string {
  if (!raw) return "Not assigned";
  const trimmed = raw.trim();
  const parenMatch = /\(([^)]+)\)\s*$/.exec(trimmed);
  if (parenMatch && parenMatch[1]?.trim()) {
    return parenMatch[1].trim();
  }
  return trimmed;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [hoursRaw, minutesRaw] = value.split(":").map(Number);
  const hours = hoursRaw ?? 0;
  return `${hours % 12 || 12}:${String(minutesRaw ?? 0).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function formatEndTime(start: string | null | undefined, durationMins: number | null | undefined): string | null {
  if (!start || !durationMins) return null;
  const [hRaw, mRaw] = start.split(":").map(Number);
  if (!Number.isFinite(hRaw)) return null;
  const total = (hRaw ?? 0) * 60 + (mRaw ?? 0) + durationMins;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${endH % 12 || 12}:${String(endM).padStart(2, "0")} ${endH >= 12 ? "PM" : "AM"}`;
}

export function CradleFlowTicket({
  booking,
  group,
  businessDate,
  onOpen,
  onOpenGroup,
  onPrimary,
  onAssignRoom,
  onAssignTherapist,
  primaryPending = false,
}: {
  booking: CradleFlowBooking;
  group?: CradleFlowGroup;
  businessDate: string;
  onOpen: (booking: CradleFlowBooking) => void;
  onOpenGroup?: (group: CradleFlowGroup) => void;
  onPrimary: (booking: CradleFlowBooking) => void;
  onAssignRoom: (booking: CradleFlowBooking) => void;
  onAssignTherapist: (booking: CradleFlowBooking) => void;
  primaryPending?: boolean;
}) {
  // ── Multi-Service / Group Booking Card ──────────────────────────────────────
  if (group && group.orderId && group.serviceCount > 1) {
    const guests = [...new Set(group.lines.map(getCradleFlowServiceRecipientName))];
    const stageLabel = {
      waiting: "Waiting",
      in_service: "In Service",
      ready_to_pay: "Ready to Pay",
      completed: "Completed",
    }[group.stage];

    const isPaid = (group.payment.due ?? 0) <= 0 && (group.payment.paid ?? 0) > 0;

    return (
      <article className="group relative overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-2xs transition hover:border-[#1F4E33]/40 hover:shadow-md">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-[#1F4E33]" aria-hidden="true" />

        {/* Top Bar: Time, Group Organizer & Financial Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EDE4] bg-[#FCFBF9] px-4 py-3 pl-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F4E33] px-2.5 py-1 text-xs font-extrabold tabular-nums text-white">
              <Clock className="size-3.5" />
              {formatTime(group.startTime)}
            </span>

            <button
              type="button"
              onClick={() => onOpenGroup?.(group)}
              className="text-left text-base font-extrabold tracking-tight text-[#1E1916] hover:text-[#1F4E33] hover:underline"
            >
              {group.organizerName}
            </button>

            <span className="rounded-md border border-[#E6D5B8] bg-[#FDF8EC] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#8A5A19]">
              Group · {group.guestCount} Guests · {group.serviceCount} Services
            </span>

            <span className="font-mono text-xs font-medium text-[#8C7E70]">
              #{group.orderNumber ?? group.orderId.slice(0, 8)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#F0ECE5] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#493F37]">
              {stageLabel}
            </span>

            <div className="flex items-center gap-2 rounded-lg border border-[#E5DEC9] bg-white px-2.5 py-1 text-xs tabular-nums">
              <span className="font-extrabold text-[#1E1916]">
                {group.payment.total === null ? "—" : formatCradleFlowMoney(group.payment.total)}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                  isPaid
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {isPaid
                  ? "PAID"
                  : group.payment.due !== null
                    ? `${formatCradleFlowMoney(group.payment.due)} DUE`
                    : "ORDER"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Guests List + Primary Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 pl-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#5C5349]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9C8878] block">
                Service Recipients
              </span>
              <span className="font-bold text-[#1E1916]">
                {guests.join(", ")}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9C8878] block">
                Assignments
              </span>
              <span className="font-medium text-[#5C5349]">
                Therapists & rooms assigned per guest line
              </span>
            </div>
            {group.attentionSummary.length > 0 ? (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                  Attention Required
                </span>
                <span className="font-bold text-amber-900">
                  {group.attentionSummary.join(" · ")}
                </span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onOpenGroup?.(group)}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#1F4E33] px-4 text-xs font-bold text-white shadow-2xs transition hover:bg-[#163B26]"
          >
            Open Group ({group.serviceCount})
          </button>
        </div>
      </article>
    );
  }

  // ── Individual Service Line Card ────────────────────────────────────────────
  const party = resolveBookingPartyIdentity({
    bookedBy: booking.customer_name,
    serviceRecipient: getCradleFlowServiceRecipientName(booking),
  });
  const stage = getCradleFlowStage(booking);
  const homeService = isHomeServiceVisit(booking);
  const missingRoom = !homeService && !booking.resource_id && stage === "waiting";
  const missingTherapist = !booking.staff_name && stage === "waiting";
  const due = getCradleFlowBalance(booking);
  const paid = getCradleFlowAmountPaid(booking);
  const orderPayable = booking.order_id ? booking.order_total_amount ?? null : null;
  const displayTotal = booking.order_id ? orderPayable : booking.price_paid ?? null;
  const endTimeLabel = formatEndTime(booking.start_time, booking.service_duration);
  const isPaid = due <= 0 && paid > 0;

  const accent =
    stage === "ready_to_pay"
      ? "bg-violet-600"
      : stage === "in_service"
        ? "bg-emerald-600"
        : homeService
          ? "bg-blue-600"
          : stage === "completed"
            ? "bg-stone-500"
            : "bg-amber-500";

  const statusTone =
    stage === "ready_to_pay"
      ? "border-violet-200 bg-violet-50 text-violet-900"
      : stage === "in_service"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : stage === "completed"
          ? "border-stone-200 bg-stone-100 text-stone-700"
          : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-2xs transition hover:border-[#1F4E33]/40 hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} aria-hidden="true" />

      {/* ── TIER 1: Header Strip (Schedule, Full Guest Identity, Status & Payment) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EDE4] bg-[#FCFBF9] px-4 py-2.5 pl-5">
        {/* Left: Time Badge + Full Customer Name + Booker + Order Ref */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] bg-white px-2.5 py-1 text-xs font-extrabold tabular-nums text-[#1E1916] shadow-2xs">
            <Clock className="size-3.5 text-[#1F4E33]" />
            <span>{formatTime(booking.start_time)}</span>
            {endTimeLabel ? (
              <span className="font-medium text-[#8C7E70]">– {endTimeLabel}</span>
            ) : null}
            <span className="rounded bg-[#F4F0EA] px-1.5 py-0.2 text-[10px] font-bold text-[#6B5D52]">
              {booking.service_duration ? `${booking.service_duration}m` : "60m"}
            </span>
          </div>

          {booking.booking_date > businessDate ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#EEF7F1] px-2 py-1 text-[11px] font-bold text-[#1F4E33]">
              <Calendar className="size-3" />
              {formatBranchYmd(booking.booking_date, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => onOpen(booking)}
            className="text-left text-[15px] font-extrabold tracking-tight text-[#1E1916] hover:text-[#1F4E33] hover:underline"
          >
            {party.serviceFor}
          </button>

          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              party.isGuest
                ? "border border-amber-200/80 bg-amber-50 text-amber-900"
                : "border border-emerald-200/80 bg-emerald-50 text-emerald-900"
            }`}
          >
            {party.roleLabel}
          </span>

          {party.bookedBy && party.bookedBy !== party.serviceFor ? (
            <span className="text-xs text-[#6B5D52]">
              Booked by <strong className="font-semibold text-[#1E1916]">{party.bookedBy}</strong>
            </span>
          ) : null}

          <span className="font-mono text-xs text-[#8C7E70]">
            · {booking.order_id ? `Order #${booking.order_id.slice(0, 8)}` : `Ref #${booking.id.slice(0, 8)}`}
          </span>
        </div>

        {/* Right: Workflow Stage Chip & Payment Summary Pill */}
        <div className="flex flex-wrap items-center gap-2">
          {homeService ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
              <Home className="size-3" /> Home Service
            </span>
          ) : null}

          <span
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${statusTone}`}
          >
            {getCradleFlowDisplayStatus(booking)}
          </span>

          <div className="flex items-center gap-2 rounded-lg border border-[#E2DDD5] bg-white px-2.5 py-1 text-xs tabular-nums shadow-2xs">
            <Wallet className="size-3.5 text-[#1F4E33]" />
            <span className="font-extrabold text-[#1E1916]">
              {displayTotal === null ? "—" : formatCradleFlowMoney(displayTotal)}
            </span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-900">
                <CheckCircle2 className="size-2.5" /> PAID
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-900">
                {booking.order_id && orderPayable === null
                  ? "TBD"
                  : `${formatCradleFlowMoney(due)} DUE`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── TIER 2: Body Grid (Service, Full Therapist Name, Room & Action Buttons) ── */}
      <div className="flex flex-col justify-between gap-3 px-4 py-3 pl-5 lg:flex-row lg:items-center">
        {/* 3 Spacious Assignment Columns — No cramped truncation */}
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Column 1: Service */}
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF7F1] text-[#1F4E33]">
              <Sparkles className="size-3.5" />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
                Treatment Service
              </span>
              <span className="block text-xs font-extrabold text-[#1E1916]">
                {booking.service_name ?? "Service not recorded"}
              </span>
            </div>
          </div>

          {/* Column 2: Therapist */}
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#F5F2EE] text-[#5C5349]">
              <UserRound className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
                  Therapist
                </span>
                <TherapistProvenanceBadge booking={booking} />
              </div>
              <span className="block text-xs font-bold text-[#1E1916]">
                {formatShortTherapistName(booking.staff_name)}
              </span>
            </div>
          </div>

          {/* Column 3: Room or Home Service Address */}
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                !homeService && !booking.resource_name
                  ? "bg-amber-50 text-amber-800"
                  : "bg-[#F5F2EE] text-[#5C5349]"
              }`}
            >
              <MapPin className="size-3.5" />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
                {homeService ? "Service Destination" : "Assigned Room"}
              </span>
              {homeService ? (
                <span className="block text-xs font-bold text-[#1E1916]">
                  {booking.hs_address ?? "Address needs review"}
                </span>
              ) : booking.resource_name ? (
                <span className="block text-xs font-extrabold text-[#1F4E33]">
                  {booking.resource_name}
                </span>
              ) : (
                <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                  Not assigned
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#F2EDE4] pt-2.5 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <button
            type="button"
            onClick={() => onPrimary(booking)}
            disabled={primaryPending}
            aria-busy={primaryPending}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#1F4E33] px-4 text-xs font-bold text-white shadow-2xs transition hover:bg-[#163B26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E33] disabled:opacity-60"
          >
            {primaryPending
              ? booking.status === "pending" ||
                booking.status === "pending_payment" ||
                booking.status === "pending_crm_confirmation"
                ? "Confirming…"
                : booking.booking_progress_status === "checked_in"
                  ? "Starting…"
                  : "Checking in…"
              : getCradleFlowPrimaryLabel(booking, businessDate)}
          </button>

          {missingRoom ? (
            <button
              type="button"
              onClick={() => onAssignRoom(booking)}
              className="inline-flex h-9 items-center rounded-xl border border-[#DCD4CA] bg-white px-3 text-xs font-bold text-[#493F37] transition hover:border-[#1F4E33] hover:bg-[#FAF8F5]"
            >
              Assign Room
            </button>
          ) : null}

          {missingTherapist ? (
            <button
              type="button"
              onClick={() => onAssignTherapist(booking)}
              className="inline-flex h-9 items-center rounded-xl border border-[#DCD4CA] bg-white px-3 text-xs font-bold text-[#493F37] transition hover:border-[#1F4E33] hover:bg-[#FAF8F5]"
            >
              Assign Therapist
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onOpen(booking)}
            className="grid size-9 place-items-center rounded-xl border border-[#DCD4CA] bg-white text-[#786D61] transition hover:border-[#1F4E33] hover:bg-[#FAF8F5] hover:text-[#1E1916]"
            aria-label={`More actions for ${getCradleFlowServiceRecipientName(booking)}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
