"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import type { BookingFollowupResult } from "./booking-followup-modal";
import { resolveStaffScheduleExceptionAction } from "@/app/(dashboard)/crm/bookings/actions";
import { getOpenStaffScheduleException, getStaffScheduleExceptionMessage } from "@/lib/bookings/staff-schedule-exception";

const reviewButtonClass = "inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-emerald-900 hover:bg-white";

function WarningStrip({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 last:border-b-0">
      <AlertTriangle className="size-5 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-amber-900">{title}</p>
        <p className="mt-0.5 truncate text-xs text-amber-900/75">{detail}</p>
      </div>
      <button type="button" onClick={onAction} className={reviewButtonClass}>{actionLabel}</button>
    </div>
  );
}

export function SelectedBookingWarnings({
  booking,
  onOpenRoom,
  onOpenPayment,
  onOpenStaff,
  onOpenReschedule,
  onOpenFollowup,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  onOpenRoom: () => void;
  onOpenPayment: () => void;
  onOpenStaff: () => void;
  onOpenReschedule: () => void;
  onOpenFollowup: (result: BookingFollowupResult) => void;
  onChanged?: () => void;
}) {
  const [showStaffReview, setShowStaffReview] = useState(false);
  const [isResolving, startTransition] = useTransition();
  const exception = getOpenStaffScheduleException(booking.metadata);
  const missingRoom = booking.booking_progress_status === "checked_in" && !booking.resource_id;
  const pendingPayment = ["unpaid", "pending", "pending_payment"].includes(booking.payment_status);

  function resolve(resolution: "kept_selected_staff" | "marked_resolved") {
    startTransition(async () => {
      const result = await resolveStaffScheduleExceptionAction({ bookingId: booking.id, resolution });
      if (!result.success) {
        toast.error(result.error ?? "Could not resolve staff review.");
        return;
      }
      toast.success(resolution === "kept_selected_staff" ? "Selected staff kept." : "Staff review resolved.");
      setShowStaffReview(false);
      onChanged?.();
    });
  }

  if (!exception && !missingRoom && !pendingPayment) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200">
      {exception ? <WarningStrip title="Staff schedule exception" detail={getStaffScheduleExceptionMessage(exception.reasonCode, exception.selectedStaffName)} actionLabel="Review" onAction={() => setShowStaffReview((current) => !current)} /> : null}
      {missingRoom ? <WarningStrip title="Room assignment required" detail="The customer is checked in and needs a room before service can start." actionLabel="Assign" onAction={onOpenRoom} /> : null}
      {pendingPayment ? <WarningStrip title="Payment requires review" detail="This booking still has an unpaid or pending payment state." actionLabel="Manage" onAction={onOpenPayment} /> : null}
      {showStaffReview && exception ? (
        <div className="grid grid-cols-3 gap-2 border-t border-amber-200 bg-white p-3">
          <button type="button" disabled={isResolving} onClick={() => resolve("kept_selected_staff")} className={reviewButtonClass}>Keep selected staff</button>
          <button type="button" disabled={isResolving} onClick={() => resolve("marked_resolved")} className={reviewButtonClass}>Mark resolved</button>
          <button type="button" onClick={onOpenStaff} className={reviewButtonClass}>Reassign staff</button>
          <button type="button" onClick={onOpenReschedule} className={reviewButtonClass}>Adjust time</button>
          <button type="button" onClick={() => onOpenFollowup("confirmed")} className={reviewButtonClass}>Contact customer</button>
          <Link href={`/crm/schedule?staffId=${encodeURIComponent(exception.selectedStaffId)}&date=${encodeURIComponent(exception.bookingDate)}`} className={reviewButtonClass}>Open schedule</Link>
        </div>
      ) : null}
    </div>
  );
}
