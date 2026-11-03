"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, User, Users } from "lucide-react";
import {
  groupCrmBookings,
  getBookingPaymentDisplayState,
  type CrmBookingGroup,
} from "@/lib/bookings/crm-booking-groups";
import { bookingGuestCount, bookingSessionSummary } from "@/lib/bookings/bookings-presentation";
import { formatTime12h } from "@/lib/utils/time-format";
import { readBookingPrice } from "@/lib/bookings/booking-display";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import { HorizontalBookingRow } from "./horizontal-booking-row";

export function GroupedBookingCard({
  group,
  matchingLines,
  expanded,
  onToggle,
  onSelect,
  onChanged,
  onReschedule,
  paymentAction,
  isSelected,
}: {
  group: CrmBookingGroup;
  matchingLines: WorkspaceBookingRow[];
  expanded: boolean;
  onToggle: () => void;
  onSelect: (line: WorkspaceBookingRow) => void;
  onChanged?: () => void;
  onReschedule: (line: WorkspaceBookingRow) => void;
  paymentAction?: BookingActionFn;
  isSelected?: boolean;
}) {
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [visibleLineCount, setVisibleLineCount] = useState(10);
  const summary = bookingSessionSummary(group);
  const payment = getBookingPaymentDisplayState(group.payment, group.lines[0]);
  const lines = showAll ? group.lines : matchingLines;
  const visibleLines = lines.slice(0, visibleLineCount);
  const guestCount = bookingGuestCount(group);
  const isMultiGuest = guestCount > 1;
  const status = summary.active
    ? "In Service"
    : summary.waiting
      ? "Waiting"
      : summary.completed === group.lines.length
        ? "Completed"
        : "Closed";
  const primary = group.lines[0]!;
  return (
    <article
      className={`rounded-xl border bg-white shadow-sm ${expanded ? "border-emerald-200 ring-1 ring-emerald-100" : "border-neutral-200"}`}
      aria-label={isMultiGuest ? `Group booking ${group.organizerName}` : `Appointment for ${group.organizerName}`}
    >
      <header
        onClick={() => onSelect(primary)}
        className="flex min-h-[76px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3"
      >
        <div className="w-24 shrink-0">
          <strong className="text-sm">{formatTime12h(group.startTime)}</strong>
          <p
            className={`text-xs font-medium ${summary.active ? "text-emerald-700" : "text-amber-700"}`}
          >
            {status}
          </p>
        </div>
        <div className="flex min-w-[190px] flex-1 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-900">
            {isMultiGuest ? <Users className="size-5" /> : <User className="size-5" />}
          </span>
          <div>
            <h2 className="text-sm font-bold text-neutral-950">{group.organizerName}</h2>
            <p className="text-xs text-neutral-500">
              {isMultiGuest
                ? `Group booking · ${guestCount} guests · ${group.lines.length} sessions`
                : `Single guest · 1 guest · ${group.lines.length} ${group.lines.length === 1 ? "service" : "services"}`}
            </p>
            {group.orderNumber ? <p className="text-xs text-neutral-500">{group.orderNumber}</p> : null}
          </div>
        </div>
        <p className="text-xs text-neutral-600">
          <span className="font-semibold text-emerald-800">{summary.active} active</span> ·{" "}
          {summary.waiting} waiting · {summary.completed} completed
        </p>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${payment.isPaid ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          {payment.label}
        </span>
        {isSelected && paymentAction ? (
          <PaymentActionMenu
            bookingId={primary.id}
            paymentStatus={primary.payment_status}
            paymentMethod={primary.payment_method}
            amountPaid={primary.amount_paid}
            pricePaid={readBookingPrice(primary.metadata)}
            paymentAction={paymentAction}
            triggerLabel={payment.isPaymentReview ? "Review payment" : "Payment"}
            triggerVariant="panelSecondary"
            reviewRequired={payment.isPaymentReview}
          />
        ) : null}
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-emerald-700">
            Manage
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                if (!expanded) onToggle();
              }}
              className="min-h-10 w-full rounded px-3 text-left text-sm hover:bg-neutral-50"
            >
              Manage guest sessions
            </button>
          </div>
        </details>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse group booking" : "Expand group booking"}
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-neutral-200 focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </header>
      {expanded ? (
        <div className="border-t border-neutral-100 bg-neutral-50/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
            <h3 className="font-semibold">
              Guest sessions · {visibleLines.length} shown of {lines.length} matching · {group.lines.length} total
            </h3>
            {matchingLines.length < group.lines.length ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="min-h-9 font-semibold text-emerald-800 underline"
              >
                {showAll ? "Show matching sessions" : "Show all group sessions"}
              </button>
            ) : null}
          </div>
          {visibleLines.map((line) => (
            <HorizontalBookingRow
              key={line.id}
              group={groupCrmBookings([line], false)[0]!}
              isExpanded={expandedLine === line.id}
              isSelected={false}
              onSelect={() => onSelect(line)}
              onToggleExpand={() => {
                onSelect(line);
                setExpandedLine((id) => (id === line.id ? null : line.id));
              }}
              onBookingsChanged={onChanged}
              onOpenFallbackReschedule={onReschedule}
            />
          ))}
          {visibleLines.length < lines.length ? (
            <button type="button" onClick={() => setVisibleLineCount((count) => count + 10)} className="mt-2 min-h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-emerald-800">
              Show 10 more sessions
            </button>
          ) : null}
          <p className="mt-2 text-xs text-neutral-500">
            Payment belongs to {group.orderNumber ?? "the parent booking"}. Each guest’s service is
            managed separately.
          </p>
        </div>
      ) : null}
    </article>
  );
}
