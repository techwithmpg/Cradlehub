"use client";

import { useState } from "react";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import { SelectedBookingHeader } from "./selected-booking-header";
import { SelectedBookingSummaryBand } from "./selected-booking-summary-band";
import { SelectedBookingPrimaryAction } from "./selected-booking-primary-action";
import { SelectedBookingQuickActions } from "./selected-booking-quick-actions";
import { SelectedBookingTabs, type SelectedBookingTab } from "./selected-booking-tabs";
import { SelectedBookingOverview } from "./selected-booking-overview";
import { SelectedBookingActivity } from "./selected-booking-activity";
import { SelectedBookingDetails } from "./selected-booking-details";
import { SelectedBookingServiceSession } from "./selected-booking-service-session";
import type { CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import { firstBookingRelation } from "@/lib/bookings/booking-display";
import { TherapistProvenanceBadge } from "./therapist-provenance-badge";

type SessionOverride = {
  status: "in_progress";
  booking_progress_status: "session_started";
  session_started_at: string;
};

export function SelectedBookingCommandPane({
  booking,
  group,
  onSelectLine,
  viewerRole,
  dispatchHref,
  statusAction,
  paymentAction,
  confirmPaymentAction,
  onClose,
  onOpenReschedule,
  onOpenArrival,
  onOpenRoom,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  group?: CrmBookingGroup;
  onSelectLine?: (lineId: string) => void;
  viewerRole: string;
  dispatchHref?: string;
  statusAction?: BookingActionFn;
  paymentAction?: BookingActionFn;
  confirmPaymentAction?: BookingActionFn;
  onClose: () => void;
  onOpenReschedule: () => void;
  onOpenArrival: () => void;
  onOpenRoom: () => void;
  onChanged?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SelectedBookingTab>("overview");
  const [staffExpanded, setStaffExpanded] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [sessionOverride, setSessionOverride] = useState<SessionOverride | null>(null);
  const effectiveBooking = sessionOverride ? { ...booking, ...sessionOverride } : booking;

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-78px)] min-h-[690px] max-h-[940px] min-w-[560px] flex-col overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-white shadow-[var(--cs-shadow-sm)]">
      <SelectedBookingHeader booking={effectiveBooking} onClose={onClose} />
      {group ? (
        <div className="mx-5 mb-3 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <strong>
              {group.organizerName} · {group.guestCount > 1 ? `${group.guestCount} guests · ` : ""}
              {group.serviceCount} service{group.serviceCount === 1 ? "" : "s"}
            </strong>
            <span>{group.orderNumber ? `Order ${group.orderNumber}` : "Order"}</span>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Service lines in order">
            {group.lines.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => onSelectLine?.(line.id)}
                aria-current={line.id === booking.id ? "true" : undefined}
                className={`shrink-0 rounded-md border px-2.5 py-1.5 text-left text-xs ${line.id === booking.id ? "border-emerald-800 bg-white font-bold" : "border-[var(--cs-border)] bg-white"}`}
              >
                <span className="block">
                  {firstBookingRelation(line.booking_attendees)?.display_name ??
                    firstBookingRelation(line.customers)?.full_name ??
                    "Guest"}
                </span>
                <span className="block text-[var(--cs-text-muted)]">
                  {firstBookingRelation(line.services)?.name ?? "Service"} · {line.status}
                </span>
                <span className="block text-[var(--cs-text-muted)]">
                  Therapist: {firstBookingRelation(line.staff)?.full_name ?? "Not assigned"}
                  <TherapistProvenanceBadge booking={line} />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1 text-xs text-[var(--cs-text-secondary)]">
            Order total:{" "}
            {group.payment.total === null
              ? "Unavailable"
              : `₱${group.payment.total.toLocaleString("en-PH")}`}{" "}
            · Paid:{" "}
            {group.payment.paid === null
              ? "Unavailable"
              : `₱${group.payment.paid.toLocaleString("en-PH")}`}{" "}
            · Due:{" "}
            {group.payment.due === null
              ? "Unavailable"
              : `₱${group.payment.due.toLocaleString("en-PH")}`}
          </div>
        </div>
      ) : null}
      <SelectedBookingSummaryBand
        booking={effectiveBooking}
        group={group}
        viewerRole={viewerRole}
        onChangeStaff={() => {
          setActiveTab("overview");
          setStaffExpanded(true);
        }}
        onChangeRoom={onOpenRoom}
      />

      <div className="mt-4">
        <SelectedBookingServiceSession booking={effectiveBooking} onChanged={onChanged} />
        <SelectedBookingPrimaryAction
          booking={effectiveBooking}
          dispatchHref={dispatchHref}
          onOpenArrival={onOpenArrival}
          onOpenRoom={onOpenRoom}
          onSessionStarted={(startedAt) =>
            setSessionOverride({
              status: "in_progress",
              booking_progress_status: "session_started",
              session_started_at: startedAt,
            })
          }
          onChanged={onChanged}
        />
      </div>

      <div className="mt-3">
        <SelectedBookingQuickActions
          booking={effectiveBooking}
          viewerRole={viewerRole}
          statusAction={statusAction}
          onOpenReschedule={onOpenReschedule}
          onChanged={onChanged}
        />
      </div>

      <div className="mt-4 shrink-0 px-5">
        <SelectedBookingTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        role="tabpanel"
        id={`selected-booking-panel-${activeTab}`}
        aria-labelledby={`selected-booking-tab-${activeTab}`}
      >
        {activeTab === "overview" ? (
          <SelectedBookingOverview
            booking={effectiveBooking}
            grouped={Boolean(group)}
            viewerRole={viewerRole}
            paymentAction={paymentAction}
            confirmPaymentAction={confirmPaymentAction}
            staffExpanded={staffExpanded}
            paymentExpanded={paymentExpanded}
            onStaffExpandedChange={setStaffExpanded}
            onPaymentExpandedChange={setPaymentExpanded}
            onOpenRoom={onOpenRoom}
            onOpenReschedule={onOpenReschedule}
            onChanged={onChanged}
          />
        ) : null}
        {activeTab === "activity" ? <SelectedBookingActivity booking={effectiveBooking} /> : null}
        {activeTab === "details" ? <SelectedBookingDetails booking={effectiveBooking} /> : null}
      </div>
    </aside>
  );
}
