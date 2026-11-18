"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Home,
  MapPin,
  Phone,
  Sparkles,
  Truck,
  UserCheck,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { resolveBookingPartyIdentity } from "@/lib/bookings/booking-party-identity";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { assignBookingTherapistAction } from "@/app/(dashboard)/crm/bookings/actions";
import { updateWorkQueueBookingStatusAction } from "@/app/(dashboard)/crm/today/actions";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import { getAssignmentRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { TherapistProvenanceBadge } from "@/components/features/bookings/therapist-provenance-badge";
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
  getCradleFlowPaymentStatus,
  getCradleFlowAmountPaid,
  getCradleFlowBalance,
  type CradleFlowBooking,
  getCradleFlowServiceRecipientName,
} from "@/lib/crm/cradle-flow";
import { getCradleFlowDisplayStatus } from "./cradle-flow-display";

function formatShortTherapistName(raw: string | null | undefined): string {
  if (!raw) return "Not assigned";
  const trimmed = raw.trim();
  const parenMatch = /\(([^)]+)\)\s*$/.exec(trimmed);
  if (parenMatch && parenMatch[1]?.trim()) {
    return parenMatch[1].trim();
  }
  return trimmed;
}

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

function computeEndTime(start: string | null | undefined, durationMins: number | null | undefined): string | null {
  if (!start || !durationMins) return null;
  const [hRaw, mRaw] = start.split(":").map(Number);
  if (!Number.isFinite(hRaw)) return null;
  const total = (hRaw ?? 0) * 60 + (mRaw ?? 0) + durationMins;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${endH % 12 || 12}:${String(endM).padStart(2, "0")} ${endH >= 12 ? "PM" : "AM"}`;
}

function readMetadataNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function CradleFlowBookingDialog({
  booking,
  businessDate,
  open,
  onOpenChange,
  onPrimary,
  primaryPending = false,
  onAssignRoom,
  onAssignTherapist,
}: {
  booking: CradleFlowBooking | null;
  businessDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrimary: (booking: CradleFlowBooking) => void;
  primaryPending?: boolean;
  onAssignRoom: (booking: CradleFlowBooking) => void;
  onAssignTherapist: (booking: CradleFlowBooking) => void;
}) {
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, startCancelTransition] = useTransition();

  if (!booking) return null;

  const recipientName = getCradleFlowServiceRecipientName(booking);
  const partyIdentity = resolveBookingPartyIdentity({
    bookedBy: booking.customer_name,
    serviceRecipient: recipientName,
  });
  const homeService = booking.type === "home_service" || booking.delivery_type === "home_service";
  const stage = getCradleFlowStage(booking);
  const displayStatus = getCradleFlowDisplayStatus(booking);
  const orderPayable = booking.order_id ? booking.order_total_amount ?? null : null;
  const displayTotal = booking.order_id ? orderPayable : booking.price_paid ?? null;
  const paidAmount = getCradleFlowAmountPaid(booking);
  const dueAmount = getCradleFlowBalance(booking);
  const isPaid = getCradleFlowPaymentStatus(booking) === "paid" || (dueAmount <= 0 && paidAmount > 0);
  const endTimeLabel = computeEndTime(booking.start_time, booking.service_duration ?? 60);

  const metadata = booking.metadata ?? {};
  const notes =
    typeof metadata.customer_notes === "string" && metadata.customer_notes.trim()
      ? metadata.customer_notes.trim()
      : null;

  const isUnconfirmed = ["pending", "pending_payment", "pending_crm_confirmation"].includes(
    booking.status
  );
  const hasArrived =
    Boolean(booking.checked_in_at) ||
    ["checked_in", "in_service", "completed"].includes(booking.booking_progress_status ?? "");
  const hasStarted =
    Boolean(booking.session_started_at) ||
    ["in_service", "completed"].includes(booking.booking_progress_status ?? "");
  const hasCompleted =
    Boolean(booking.session_completed_at) ||
    booking.booking_progress_status === "completed" ||
    booking.status === "completed";

  const missingRoom = !homeService && !booking.resource_id && stage !== "completed";
  const missingTherapist = !booking.staff_id && stage !== "completed";

  const pricingBreakdownRaw = metadata.pricing_breakdown;
  const pricingBreakdown =
    pricingBreakdownRaw &&
    typeof pricingBreakdownRaw === "object" &&
    !Array.isArray(pricingBreakdownRaw)
      ? (pricingBreakdownRaw as Record<string, unknown>)
      : null;

  const homeServiceDistanceKm =
    readMetadataNumber(metadata.home_service_distance_km) ??
    readMetadataNumber(pricingBreakdown?.distance_km) ??
    readMetadataNumber(pricingBreakdown?.home_service_distance_km);

  const homeServiceTravelFee =
    readMetadataNumber(metadata.home_service_travel_fee) ??
    readMetadataNumber(pricingBreakdown?.travel_fee) ??
    readMetadataNumber(pricingBreakdown?.home_service_travel_fee);

  const handleCopyPhone = () => {
    if (!booking.customer_phone) return;
    void navigator.clipboard.writeText(booking.customer_phone);
    setCopiedPhone(true);
    toast.success("Phone number copied");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason.");
      return;
    }
    startCancelTransition(async () => {
      try {
        const res = await updateWorkQueueBookingStatusAction({
          bookingId: booking.id,
          status: "cancelled",
          cancellationReason: cancelReason.trim(),
        } as any);
        if (!res?.success) {
          toast.error((res as any)?.error ?? "Could not cancel booking.");
          return;
        }
        toast.success(`Booking for ${recipientName} cancelled.`);
        setCancelOpen(false);
        setCancelReason("");
        onOpenChange(false);
        notifyBookingsChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not cancel booking.");
      }
    });
  };

  const timelineSteps = [
    {
      key: "booked",
      label: "Booked",
      time: timeLabel(booking.start_time),
      done: true,
      active: isUnconfirmed,
    },
    {
      key: "confirmed",
      label: "Confirmed",
      time: isUnconfirmed ? "Awaiting" : "Confirmed",
      done: !isUnconfirmed,
      active: !isUnconfirmed && !hasArrived,
    },
    {
      key: "arrived",
      label: "Arrived",
      time: booking.checked_in_at ? timeLabel(booking.checked_in_at) : hasArrived ? "Checked in" : "Pending",
      done: hasArrived,
      active: hasArrived && !hasStarted,
    },
    {
      key: "started",
      label: "In Service",
      time: booking.session_started_at ? timeLabel(booking.session_started_at) : "Not recorded",
      done: hasStarted,
      active: hasStarted && !hasCompleted,
    },
    {
      key: "completed",
      label: "Completed",
      time: booking.session_completed_at ? timeLabel(booking.session_completed_at) : "Not recorded",
      done: hasCompleted,
      active: hasCompleted,
    },
  ];

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCancelOpen(false);
        onOpenChange(next);
      }}
      placement="center"
      size="lg"
      ariaLabel="Booking details"
      className="max-h-[90dvh]"
    >
      <AdminOverlayHeader
        title={recipientName}
        description={`${homeService ? "Home Service" : "In-Spa Visit"} · ${booking.booking_date} · ${timeLabel(booking.start_time)}${endTimeLabel ? ` – ${endTimeLabel}` : ""} (${booking.service_duration ?? 60} min) · ${booking.order_id ? `Order #${booking.order_id.slice(0, 8)}` : `Ref #${booking.id.slice(0, 8)}`}`}
      />

      <AdminOverlayBody className="grid gap-3.5">
        {/* ── 1. TOP HERO STRIP: Operational State + Payment Status ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5DEC9] bg-gradient-to-r from-[#FCFBF9] to-[#F6F3EC] px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
                Operational State
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold text-[#1E1916]">
                  {displayStatus}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    partyIdentity.isGuest
                      ? "border border-amber-200 bg-amber-50 text-amber-900"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {partyIdentity.roleLabel}
                </span>
                {missingRoom ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    <AlertTriangle className="size-3" /> Room Required
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Financial Pill */}
          <div className="flex items-center gap-3 rounded-xl border border-[#E2DDD5] bg-white px-3.5 py-2 shadow-2xs">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-lg font-extrabold tabular-nums text-[#1E1916]">
                  {displayTotal === null ? "—" : formatCradleFlowMoney(displayTotal)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    isPaid
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {isPaid ? <CheckCircle2 className="size-3" /> : null}
                  {isPaid ? "PAID" : "BALANCE DUE"}
                </span>
              </div>
              <div className="text-[11px] font-medium tabular-nums text-[#786D61]">
                {booking.order_id ? "Order: " : ""}
                <strong className="text-emerald-800">{formatCradleFlowMoney(paidAmount)} paid</strong>
                {" · "}
                <span className={dueAmount > 0 ? "font-bold text-amber-900" : ""}>
                  {formatCradleFlowMoney(dueAmount)} due
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. DIRECTLY ACTIONABLE ASSIGNMENT CARDS (Therapist & Room) ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Actionable Therapist Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5DEC9] bg-white p-3.5 shadow-2xs">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF7F1] text-[#1F4E33]">
                <UserRound className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
                    Assigned Therapist
                  </span>
                  <TherapistProvenanceBadge booking={booking} />
                </div>
                <div className="mt-0.5 truncate text-sm font-extrabold text-[#1E1916]">
                  {formatShortTherapistName(booking.staff_name)}
                </div>
              </div>
            </div>

            {stage !== "completed" ? (
              <button
                type="button"
                onClick={() => {
                  if (homeService) {
                    setAssignmentOpen((v) => !v);
                  } else {
                    onOpenChange(false);
                    onAssignTherapist(booking);
                  }
                }}
                className="shrink-0 rounded-lg border border-[#DCD4CA] bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-bold text-[#1F4E33] transition hover:border-[#1F4E33] hover:bg-[#EEF7F1]"
              >
                {booking.staff_id ? "Change" : "Assign"}
              </button>
            ) : null}
          </div>

          {/* Actionable Room / Home Service Location Card */}
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 shadow-2xs ${
              missingRoom
                ? "border-amber-300 bg-amber-50/40"
                : "border-[#E5DEC9] bg-white"
            }`}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  missingRoom
                    ? "bg-amber-100 text-amber-900"
                    : "bg-[#F5F2EE] text-[#5C5349]"
                }`}
              >
                {homeService ? <Home className="size-4" /> : <MapPin className="size-4" />}
              </span>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
                  {homeService ? "Service Address" : "Treatment Room"}
                </span>
                <div
                  className={`mt-0.5 truncate text-sm font-extrabold ${
                    missingRoom ? "text-amber-900" : "text-[#1E1916]"
                  }`}
                >
                  {homeService
                    ? (booking.hs_address ?? "Address needs review")
                    : (booking.resource_name ?? "Not assigned")}
                </div>
              </div>
            </div>

            {stage !== "completed" && !homeService ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onAssignRoom(booking);
                }}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  missingRoom
                    ? "bg-[#1F4E33] text-white hover:bg-[#163B26]"
                    : "border border-[#DCD4CA] bg-[#FAF8F5] text-[#1F4E33] hover:border-[#1F4E33] hover:bg-[#EEF7F1]"
                }`}
              >
                {booking.resource_id ? "Change" : "Assign Room"}
              </button>
            ) : null}
          </div>
        </div>

        {/* ── 3. CLEAN 2-COLUMN GUEST & TREATMENT DETAILS LEDGER ── */}
        <div className="rounded-xl border border-[#E5DEC9] bg-white p-3.5">
          <div className="mb-2.5 flex items-center justify-between border-b border-[#F2EDE4] pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
              Guest & Service Information
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#786D61]">
              {booking.order_id ? `Order #${booking.order_id.slice(0, 8)}` : `Booking #${booking.id.slice(0, 8)}`}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
            <div className="flex items-center justify-between border-b border-[#F5F2EE] pb-2">
              <span className="text-[#786D61]">Service For ({partyIdentity.roleLabel})</span>
              <strong className="font-bold text-[#1E1916]">{recipientName}</strong>
            </div>

            <div className="flex items-center justify-between border-b border-[#F5F2EE] pb-2">
              <span className="text-[#786D61]">Booked By (Main Contact)</span>
              <strong className="font-bold text-[#1E1916]">
                {partyIdentity.bookedBy ?? "Not recorded"}
              </strong>
            </div>

            <div className="flex items-center justify-between border-b border-[#F5F2EE] pb-2">
              <span className="text-[#786D61]">Contact Phone</span>
              {booking.customer_phone ? (
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="inline-flex items-center gap-1.5 font-mono font-bold text-[#1F4E33] hover:underline"
                  title="Copy phone number"
                >
                  <Phone className="size-3" />
                  <span>{booking.customer_phone}</span>
                  {copiedPhone ? (
                    <Check className="size-3 text-emerald-700" />
                  ) : (
                    <Copy className="size-3 text-[#9C8878]" />
                  )}
                </button>
              ) : (
                <span className="text-[#9C8878]">Not recorded</span>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-[#F5F2EE] pb-2">
              <span className="text-[#786D61]">Treatment & Duration</span>
              <strong className="inline-flex items-center gap-1 font-bold text-[#1E1916]">
                <Sparkles className="size-3 text-[#1F4E33]" />
                {booking.service_name ?? "Service"} · {booking.service_duration ?? 60} min
              </strong>
            </div>

            {homeService ? (
              <>
                <div className="flex items-center justify-between border-b border-[#F5F2EE] pb-2">
                  <span className="text-[#786D61]">Assigned Driver</span>
                  <strong className="font-bold text-[#1E1916]">
                    {booking.driver_name ?? "Not assigned"}
                  </strong>
                </div>
                <div className="flex items-center justify-between border-b border-[#F5F2EE] pb-2">
                  <span className="text-[#786D61]">Distance & Travel Fee</span>
                  <strong className="font-bold text-[#1E1916]">
                    {homeServiceDistanceKm !== null ? `${homeServiceDistanceKm.toFixed(1)} km` : "—"}
                    {" · "}
                    {homeServiceTravelFee !== null ? formatCradleFlowMoney(homeServiceTravelFee) : "—"}
                  </strong>
                </div>
              </>
            ) : null}

            <div className="flex items-start justify-between gap-4 pt-0.5 sm:col-span-2">
              <span className="inline-flex shrink-0 items-center gap-1 text-[#786D61]">
                <FileText className="size-3" />
                Customer Notes
              </span>
              <span className={`text-right font-medium ${notes ? "text-[#1E1916]" : "text-[#9C8878] italic"}`}>
                {notes ?? "No special notes recorded"}
              </span>
            </div>
          </div>
        </div>

        {/* ── 4. CONNECTED 5-STEP SERVICE PROGRESS TIMELINE ── */}
        <div className="rounded-xl border border-[#E5DEC9] bg-[#FCFBF9] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7E70]">
              Service Progress Timeline
            </span>
            <span className="text-[11px] font-semibold text-[#1F4E33]">
              Scheduled: {timeLabel(booking.start_time)}
              {endTimeLabel ? ` – ${endTimeLabel}` : ""}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {timelineSteps.map((step, idx) => (
              <div
                key={step.key}
                className={`relative rounded-lg border px-2.5 py-2 transition ${
                  step.active
                    ? "border-[#1F4E33] bg-[#EEF7F1] text-[#1F4E33] shadow-2xs"
                    : step.done
                      ? "border-[#D5E6DC] bg-white text-[#1E1916]"
                      : "border-[#EAE4DC] bg-white/60 text-[#9C8878]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide">
                    {idx + 1}. {step.label}
                  </span>
                  {step.done ? (
                    <CheckCircle2 className="size-3 shrink-0 text-[#1F4E33]" />
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-semibold">
                  {step.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Home Service Recommender Panel (when toggled) */}
        {homeService && assignmentOpen && stage !== "completed" ? (
          <AssignmentRecommendationPanel
            key={booking.id}
            bookingId={booking.id}
            fetchRecommendations={getAssignmentRecommendationsAction}
            onAssignTherapist={async (staffId, overrideReason) => {
              const result = await assignBookingTherapistAction({
                bookingId: booking.id,
                staffId,
                overrideReason,
              });
              if (!result.success) {
                toast.error(result.error ?? "Could not assign therapist.");
                return;
              }
              toast.success("Therapist assigned.");
              notifyBookingsChanged();
            }}
            onAssignDriver={async (driverId) => {
              const result = await assignBookingDriverAction({
                bookingId: booking.id,
                driverId,
              });
              if (!result.success) {
                toast.error(result.error ?? "Could not assign driver.");
                return;
              }
              toast.success(booking.driver_id ? "Driver changed." : "Driver assigned.");
              notifyBookingsChanged();
            }}
            currentTherapistId={booking.staff_id ?? null}
            currentDriverId={booking.driver_id ?? null}
            showTherapists
            showDrivers
          />
        ) : null}

        {booking.needs_staff_schedule_review || booking.dispatch_warning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
            {booking.staff_schedule_exception_label ??
              booking.dispatch_warning ??
              "This booking needs operational review."}
          </div>
        ) : null}

        {/* ── 5. SAFEGUARDED CANCEL BOOKING CONFIRMATION DRAWER ── */}
        {cancelOpen ? (
          <div className="space-y-2.5 rounded-xl border border-rose-300 bg-rose-50/95 p-3.5 text-xs text-rose-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-700" />
              <div>
                <div className="font-extrabold">
                  Cancel Booking for {recipientName}?
                </div>
                <p className="mt-0.5 text-[11px] text-rose-900">
                  This releases the therapist and room slot for this appointment only. Other guests in a group order remain intact.
                </p>
                {paidAmount > 0 ? (
                  <p className="mt-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-900">
                    Financial Notice: {formatCradleFlowMoney(paidAmount)} is already recorded as PAID. Cancelling does not automatically issue a refund — reconcile any refund or credit in Cash Flow.
                  </p>
                ) : null}
              </div>
            </div>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Required: enter cancellation reason (e.g., Guest requested cancellation / No-show)..."
              className="h-9 w-full rounded-lg border border-rose-300 bg-white px-3 text-xs text-[#1E1916] outline-none focus:border-rose-600"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="h-8 rounded-lg border border-rose-300 bg-white px-3 text-xs font-bold text-rose-900 hover:bg-rose-100"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="h-8 rounded-lg bg-rose-700 px-3.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        ) : null}
      </AdminOverlayBody>

      {/* ── STICKY ACTION FOOTER ── */}
      <AdminOverlayFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/crm/bookings?bookingId=${booking.id}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--cs-border)] bg-white px-3.5 text-xs font-bold text-[var(--cs-text-secondary)] transition hover:bg-[#FAF8F5]"
          >
            <span>Open full booking</span>
            <ExternalLink className="size-3.5" />
          </Link>

          {stage !== "completed" && booking.status !== "cancelled" && !cancelOpen ? (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100"
            >
              <XCircle className="size-3.5" />
              <span>Cancel Booking</span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!homeService && stage !== "completed" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onAssignTherapist(booking);
                }}
                className="cs-btn cs-btn-secondary h-10 rounded-xl px-3 text-xs font-bold"
              >
                {booking.staff_id ? "Change Therapist" : "Assign Therapist"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onAssignRoom(booking);
                }}
                className="cs-btn cs-btn-secondary h-10 rounded-xl px-3 text-xs font-bold"
              >
                {booking.resource_id ? "Change Room" : "Assign Room"}
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="cs-btn cs-btn-secondary h-10 rounded-xl px-4 text-xs font-bold"
          >
            Close
          </button>

          {stage ? (
            <button
              type="button"
              onClick={() => onPrimary(booking)}
              disabled={primaryPending}
              aria-busy={primaryPending}
              className="h-10 rounded-xl bg-[#164b36] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#113A2A] disabled:opacity-60"
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
          ) : null}
        </div>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
