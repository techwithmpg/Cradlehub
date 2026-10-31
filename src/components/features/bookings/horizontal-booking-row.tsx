"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  CircleAlert,
  Sparkles,
  Flower2,
  Droplets,
  Home,
  Footprints,
  Tag,
  Loader2,
} from "lucide-react";
import type { CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import {
  firstBookingRelation,
  getBookingDurationMinutes,
  readBookingPrice,
} from "@/lib/bookings/booking-display";
import { isHomeServiceBooking } from "@/lib/bookings/bookings-workspace-filters";
import { isBookingLineCompleted } from "@/lib/bookings/operational-booking-eligibility";
import { formatTime12h } from "@/lib/utils/time-format";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import {
  crmStartServiceAction,
  crmCompleteServiceAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { HorizontalBookingQuickEdit } from "./horizontal-booking-quick-edit";

type HorizontalBookingRowProps = {
  group: CrmBookingGroup;
  isExpanded: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggleExpand: () => void;
  onBookingsChanged?: () => void;
  paymentAction?: BookingActionFn;
  onOpenFallbackReschedule?: (booking: WorkspaceBookingRow) => void;
};

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "1h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getServiceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("facial") || lower.includes("skin") || lower.includes("aroma")) {
    return <Droplets className="size-4 text-emerald-600" />;
  }
  if (lower.includes("detox") || lower.includes("package") || lower.includes("divine")) {
    return <Sparkles className="size-4 text-emerald-600" />;
  }
  return <Flower2 className="size-4 text-emerald-600" />;
}

export function HorizontalBookingRow({
  group,
  isExpanded,
  isSelected = false,
  onSelect,
  onToggleExpand,
  onBookingsChanged,
  paymentAction,
  onOpenFallbackReschedule,
}: HorizontalBookingRowProps) {
  const primaryLine: WorkspaceBookingRow = group.lines[0]!;
  const isHomeService = isHomeServiceBooking(primaryLine);

  const customer = firstBookingRelation(primaryLine.customers);
  const service = firstBookingRelation(primaryLine.services);
  const staff = firstBookingRelation(primaryLine.staff);
  const resource = firstBookingRelation(primaryLine.branch_resources);

  const [isActionPending, startActionTransition] = useTransition();

  // Multi-guest & line-aware lifecycle resolution:
  // Find the active actionable unfinished line:
  // 1. In-service line
  // 2. Checked-in / waiting line
  // 3. Upcoming non-completed line
  // 4. Fallback to primaryLine
  const activeUnfinishedLine =
    group.lines.find(
      (line) =>
        !isBookingLineCompleted(line) &&
        line.status !== "cancelled" &&
        (line.status === "in_progress" ||
          line.booking_progress_status === "session_started" ||
          line.booking_progress_status === "in_service" ||
          Boolean(line.session_started_at))
    ) ??
    group.lines.find(
      (line) =>
        !isBookingLineCompleted(line) &&
        line.status !== "cancelled" &&
        (line.booking_progress_status === "checked_in" ||
          line.booking_progress_status === "arrived" ||
          Boolean(line.checked_in_at) ||
          Boolean(line.arrived_at))
    ) ??
    group.lines.find((line) => !isBookingLineCompleted(line) && line.status !== "cancelled") ??
    primaryLine;

  const targetLine = activeUnfinishedLine;

  const allLinesCompleted =
    group.lines.filter((line) => line.status !== "cancelled").length > 0 &&
    group.lines.filter((line) => line.status !== "cancelled").every(isBookingLineCompleted);

  const isCancelled =
    group.lines.every((line) => line.status === "cancelled" || line.booking_progress_status === "cancelled");

  const isCompleted = !isCancelled && allLinesCompleted;

  const isInService =
    !isCancelled &&
    !isCompleted &&
    group.lines.some(
      (line) =>
        !isBookingLineCompleted(line) &&
        (line.status === "in_progress" ||
          line.booking_progress_status === "session_started" ||
          line.booking_progress_status === "in_service" ||
          (Boolean(line.session_started_at) && !line.session_completed_at))
    );

  const isCheckedIn =
    !isCancelled &&
    !isCompleted &&
    !isInService &&
    group.lines.some(
      (line) =>
        !isBookingLineCompleted(line) &&
        (line.booking_progress_status === "checked_in" ||
          line.booking_progress_status === "arrived" ||
          Boolean(line.checked_in_at) ||
          Boolean(line.arrived_at))
    );

  // Calculate duration
  const totalDurationMinutes = group.lines.reduce((sum, line) => {
    const duration = getBookingDurationMinutes(line);
    return sum + (duration > 0 ? duration : 60);
  }, 0);

  // Payment pill resolution
  const paymentStatus = group.payment.status ?? primaryLine.payment_status;
  const isPaid =
    paymentStatus === "paid" ||
    (group.payment.due !== null && group.payment.due !== undefined && group.payment.due <= 0);
  const isPartial =
    paymentStatus === "partial" ||
    (group.payment.due !== null &&
      group.payment.due !== undefined &&
      group.payment.due > 0 &&
      (group.payment.paid ?? 0) > 0);
  const isPaymentDue = isCompleted && !isPaid;

  // Time substatus label and color
  let timeSubstatusLabel = "Upcoming";
  let timeSubstatusDotColor = "bg-slate-400";
  let timeSubstatusTextColor = "text-slate-600";

  if (isCancelled) {
    timeSubstatusLabel = "Cancelled";
    timeSubstatusDotColor = "bg-rose-500";
    timeSubstatusTextColor = "text-rose-600";
  } else if (isPaymentDue) {
    timeSubstatusLabel = "Payment Due";
    timeSubstatusDotColor = "bg-amber-500";
    timeSubstatusTextColor = "text-amber-700";
  } else if (isCompleted) {
    timeSubstatusLabel = "Completed";
    timeSubstatusDotColor = "bg-slate-300";
    timeSubstatusTextColor = "text-slate-500";
  } else if (isInService) {
    timeSubstatusLabel = "In service";
    timeSubstatusDotColor = "bg-emerald-500";
    timeSubstatusTextColor = "text-emerald-700";
  } else if (isCheckedIn) {
    timeSubstatusLabel = "Waiting";
    timeSubstatusDotColor = "bg-amber-500";
    timeSubstatusTextColor = "text-amber-700";
  }

  // Type badge resolution
  let typeLabel = "Appointment";
  let typeBadgeClass = "bg-stone-50 text-stone-700 border-stone-200";
  let TypeIcon = Calendar;

  if (isHomeService) {
    typeLabel = "Home Service";
    typeBadgeClass = "bg-purple-50 text-purple-700 border-purple-200";
    TypeIcon = Home;
  } else if (primaryLine.type === "walkin" || primaryLine.type === "walk_in") {
    typeLabel = "Walk-in";
    typeBadgeClass = "bg-amber-50/80 text-amber-800 border-amber-200/80";
    TypeIcon = Footprints;
  } else if (primaryLine.metadata?.membership || primaryLine.type === "membership") {
    typeLabel = "Membership";
    typeBadgeClass = "bg-teal-50 text-teal-800 border-teal-200";
    TypeIcon = Tag;
  }

  // Status pill resolution
  let statusPillLabel = "Upcoming";
  let statusPillClass = "bg-slate-100 text-slate-700 border-slate-200";

  if (isCancelled) {
    statusPillLabel = "Cancelled";
    statusPillClass = "bg-rose-50 text-rose-600 border-rose-200";
  } else if (isCompleted) {
    statusPillLabel = "Completed";
    statusPillClass = "bg-slate-100 text-slate-500 border-slate-200";
  } else if (isInService) {
    statusPillLabel = "In Service";
    statusPillClass = "bg-[#e6f4ee] text-[#006044] border-[#a7d7c5]";
  } else if (isCheckedIn) {
    statusPillLabel = "Checked In";
    statusPillClass = "bg-sky-50 text-sky-700 border-sky-200";
  }

  // Action button resolution
  let actionButtonLabel = "Start Service";
  if (isCancelled) {
    actionButtonLabel = "Cancelled";
  } else if (isCompleted) {
    actionButtonLabel = "Completed";
  } else if (isInService) {
    actionButtonLabel = "Complete Service";
  } else if (isCheckedIn) {
    actionButtonLabel = "Start Service";
  }

  function handleActionClick() {
    if (isCompleted || isCancelled) return;

    startActionTransition(async () => {
      try {
        if (isInService) {
          const res = await crmCompleteServiceAction({ bookingId: targetLine.id });
          if (res.success) {
            toast.success("Service completed", {
              description: `Completed service for ${customer?.full_name ?? "customer"}.`,
            });
            onBookingsChanged?.();
          } else {
            toast.error("Could not complete service", { description: res.error });
          }
        } else {
          // If not checked in, we start service (which also checks in if required)
          const res = await crmStartServiceAction({ bookingId: targetLine.id });
          if (res.success) {
            toast.success("Service started", {
              description: `Service session started for ${customer?.full_name ?? "customer"}.`,
            });
            onBookingsChanged?.();
          } else {
            toast.error("Could not start service", { description: res.error });
          }
        }
      } catch (err) {
        console.error("Action error", err);
        toast.error("Operation failed. Please try again.");
      }
    });
  }

  return (
    <div
      className={`rounded-xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all ${
        isExpanded
          ? "border-[#a7d7c5] ring-1 ring-[#a7d7c5]/50 shadow-md mb-3"
          : "border-neutral-200/80 hover:border-neutral-300 hover:shadow-sm mb-2"
      }`}
    >
      {/* Row Header Content */}
      <div
        role="row"
        aria-selected={isSelected}
        onClick={onSelect}
        className="flex items-center gap-3 px-4 py-3 sm:px-5"
      >
        {/* 1. Time */}
        <div className="w-[100px] shrink-0">
          <div className="text-sm font-bold text-neutral-900 tracking-tight">
            {formatTime12h(primaryLine.start_time)}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`size-2 shrink-0 rounded-full ${timeSubstatusDotColor}`} />
            <span className={`text-xs font-medium ${timeSubstatusTextColor}`}>
              {timeSubstatusLabel}
            </span>
          </div>
        </div>

        {/* 2. Customer */}
        <div className="min-w-0 flex-[1.1]">
          <div className="truncate text-sm font-semibold text-neutral-900">
            {customer?.id ? (
              <Link
                href={`/crm/${customer.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-[#006044] hover:underline"
              >
                {customer?.full_name ?? group.organizerName ?? "Walk-in Guest"}
              </Link>
            ) : (
              customer?.full_name ?? group.organizerName ?? "Walk-in Guest"
            )}
            {group.lines.length > 1 ? (
              <span className="ml-1 text-xs font-normal text-neutral-500">
                (+{group.lines.length - 1} guests)
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-xs text-neutral-500">
            {customer?.phone || "No phone on file"}
          </div>
        </div>

        {/* 3. Service */}
        <div className="min-w-0 flex-[1.3] flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e6f4ee]">
            {getServiceIcon(service?.name ?? "")}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900">
              {service?.name ?? "Standard Service"}
            </div>
            <div className="mt-0.5 truncate text-xs text-neutral-500">
              {(service?.metadata?.description as string) ||
                (group.lines.length > 1
                  ? `${group.lines.length} services booked`
                  : "Wellness spa treatment")}
            </div>
          </div>
        </div>

        {/* 4. Duration */}
        <div className="flex w-[85px] shrink-0 items-center gap-1.5 text-xs text-neutral-700">
          <Clock className="size-3.5 text-neutral-400" />
          <span className="font-medium">{formatDuration(totalDurationMinutes)}</span>
        </div>

        {/* 5. Therapist */}
        <div className="flex w-[125px] shrink-0 items-center gap-1.5 text-xs text-neutral-800">
          <User className="size-3.5 text-neutral-400" />
          <span className="truncate font-medium">
            {staff?.full_name || staff?.nickname || "Unassigned"}
          </span>
        </div>

        {/* 6. Room */}
        <div className="flex w-[95px] shrink-0 items-center gap-1.5 text-xs text-neutral-800">
          {isHomeService ? (
            <>
              <Home className="size-3.5 text-purple-500" />
              <span className="truncate font-medium text-purple-700">Home Service</span>
            </>
          ) : (
            <>
              <MapPin className="size-3.5 text-neutral-400" />
              <span className="truncate font-medium">{resource?.name || "Unassigned"}</span>
            </>
          )}
        </div>

        {/* 7. Type */}
        <div className="w-[100px] shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${typeBadgeClass}`}
          >
            <TypeIcon className="size-3" />
            {typeLabel}
          </span>
        </div>

        {/* 8. Status */}
        <div className="w-[95px] shrink-0">
          <span
            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass}`}
          >
            {statusPillLabel}
          </span>
        </div>

        {/* 9. Payment */}
        <div
          className="flex w-[85px] shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {isPaid ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#a7d7c5] bg-[#e6f4ee] px-2.5 py-1 text-xs font-semibold text-[#006044]">
              <CheckCircle2 className="size-3.5 text-[#006044]" />
              Paid
            </span>
          ) : isPartial ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <CircleAlert className="size-3.5 text-amber-600" />
              Partial
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
              <CircleAlert className="size-3.5 text-rose-500" />
              Unpaid
            </span>
          )}
          {isSelected && paymentAction ? (
            <PaymentActionMenu
              bookingId={primaryLine.id}
              paymentStatus={primaryLine.payment_status}
              paymentMethod={primaryLine.payment_method}
              amountPaid={primaryLine.amount_paid}
              pricePaid={readBookingPrice(primaryLine.metadata)}
              paymentAction={paymentAction}
              triggerLabel="Manage"
              triggerVariant="panelSecondary"
            />
          ) : null}
        </div>

        {/* 10. Action & Chevron */}
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {isSelected && !isExpanded && onOpenFallbackReschedule ? (
            <button
              type="button"
              onClick={() => onOpenFallbackReschedule(primaryLine)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Reschedule
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleActionClick}
            disabled={isActionPending || isCompleted || isCancelled}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
              isCompleted || isCancelled
                ? "bg-slate-100 text-slate-400 cursor-default"
                : "bg-[#006044] text-white shadow-sm hover:bg-[#004d37] disabled:opacity-50"
            }`}
          >
            {isActionPending ? (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3.5 animate-spin" />
                Working...
              </span>
            ) : (
              actionButtonLabel
            )}
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            className="grid size-8 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
            aria-label={isExpanded ? "Collapse quick edit" : "Expand quick edit"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Quick Edit directly below the row */}
      {isExpanded ? (
        <HorizontalBookingQuickEdit
          group={group}
          onCancel={onToggleExpand}
          onPartialSave={onBookingsChanged}
          onOpenFallbackReschedule={onOpenFallbackReschedule}
          onSaved={() => {
            onToggleExpand();
            onBookingsChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}
