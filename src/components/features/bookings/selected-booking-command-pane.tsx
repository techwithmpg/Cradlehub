"use client";

import { useState } from "react";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import type { BookingFollowupResult } from "./booking-followup-modal";
import { SelectedBookingHeader } from "./selected-booking-header";
import { SelectedBookingSummaryBand } from "./selected-booking-summary-band";
import { SelectedBookingPrimaryAction } from "./selected-booking-primary-action";
import { SelectedBookingQuickActions } from "./selected-booking-quick-actions";
import { SelectedBookingTabs, type SelectedBookingTab } from "./selected-booking-tabs";
import { SelectedBookingOverview } from "./selected-booking-overview";
import { SelectedBookingActivity } from "./selected-booking-activity";
import { SelectedBookingDetails } from "./selected-booking-details";
import { SelectedBookingServiceSession } from "./selected-booking-service-session";

type SessionOverride = {
  status: "in_progress";
  booking_progress_status: "session_started";
  session_started_at: string;
};

export function SelectedBookingCommandPane({
  booking,
  viewerRole,
  dispatchHref,
  statusAction,
  paymentAction,
  confirmPaymentAction,
  onClose,
  onOpenFollowup,
  onOpenReschedule,
  onOpenArrival,
  onOpenRoom,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  viewerRole: string;
  dispatchHref?: string;
  statusAction?: BookingActionFn;
  paymentAction?: BookingActionFn;
  confirmPaymentAction?: BookingActionFn;
  onClose: () => void;
  onOpenFollowup: (result: BookingFollowupResult) => void;
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
    <aside className="sticky top-4 flex h-[calc(100vh-78px)] min-h-[690px] max-h-[940px] min-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-white shadow-[var(--cs-shadow-sm)]">
      <SelectedBookingHeader booking={effectiveBooking} onClose={onClose} />
      <SelectedBookingSummaryBand booking={effectiveBooking} viewerRole={viewerRole} onChangeStaff={() => { setActiveTab("overview"); setStaffExpanded(true); }} onChangeRoom={onOpenRoom} />

      <div className="mt-4">
        <SelectedBookingServiceSession booking={effectiveBooking} onChanged={onChanged} />
        <SelectedBookingPrimaryAction booking={effectiveBooking} dispatchHref={dispatchHref} onOpenFollowup={onOpenFollowup} onOpenArrival={onOpenArrival} onOpenRoom={onOpenRoom} onSessionStarted={(startedAt) => setSessionOverride({ status: "in_progress", booking_progress_status: "session_started", session_started_at: startedAt })} onChanged={onChanged} />
      </div>

      <div className="mt-3">
        <SelectedBookingQuickActions booking={effectiveBooking} viewerRole={viewerRole} statusAction={statusAction} onOpenFollowup={onOpenFollowup} onOpenReschedule={onOpenReschedule} onOpenCancel={() => onOpenFollowup("cancel")} onChanged={onChanged} />
      </div>

      <div className="mt-4 shrink-0 px-5">
        <SelectedBookingTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" role="tabpanel" id={`selected-booking-panel-${activeTab}`} aria-labelledby={`selected-booking-tab-${activeTab}`}>
        {activeTab === "overview" ? (
          <SelectedBookingOverview booking={effectiveBooking} viewerRole={viewerRole} paymentAction={paymentAction} confirmPaymentAction={confirmPaymentAction} staffExpanded={staffExpanded} paymentExpanded={paymentExpanded} onStaffExpandedChange={setStaffExpanded} onPaymentExpandedChange={setPaymentExpanded} onOpenRoom={onOpenRoom} onOpenReschedule={onOpenReschedule} onOpenFollowup={onOpenFollowup} onChanged={onChanged} />
        ) : null}
        {activeTab === "activity" ? <SelectedBookingActivity booking={effectiveBooking} /> : null}
        {activeTab === "details" ? <SelectedBookingDetails booking={effectiveBooking} /> : null}
      </div>
    </aside>
  );
}
