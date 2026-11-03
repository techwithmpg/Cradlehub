"use client";

import { useState } from "react";
import { firstBookingRelation } from "@/lib/bookings/booking-display";
import { getBookingPaymentDisplayState, type CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import { formatTime12h } from "@/lib/utils/time-format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { BookingSessionWorkspace } from "./booking-session-workspace";
import { HorizontalBookingQuickEdit } from "./horizontal-booking-quick-edit";

export function BookingDetailsModal({
  open, group, onOpenChange, onChanged, onReschedule,
}: {
  open: boolean;
  group: CrmBookingGroup | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  onReschedule: (booking: WorkspaceBookingRow) => void;
}) {
  const [resetKey, setResetKey] = useState(0);
  const [editResetKey, setEditResetKey] = useState(0);
  const line = group?.lines[0];
  const attendee = line ? firstBookingRelation(line.booking_attendees) : null;
  const customer = line ? firstBookingRelation(line.customers) : null;
  const service = line ? firstBookingRelation(line.services) : null;
  const staff = line ? firstBookingRelation(line.staff) : null;
  const room = line ? firstBookingRelation(line.branch_resources) : null;
  const recipient = attendee?.display_name?.trim() || customer?.full_name?.trim() || "Customer";
  const payment = group && line ? getBookingPaymentDisplayState(group.payment, line) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="booking-details-modal"
        className="flex max-h-[92dvh] w-[min(96vw,1000px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[1000px]"
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14">
          <DialogTitle className="text-lg font-bold text-neutral-950">Booking Details</DialogTitle>
          <DialogDescription className="text-xs">
            {group?.orderNumber ? `Order ${group.orderNumber} · ` : ""}
            Review this service and manage validated booking changes.
          </DialogDescription>
        </DialogHeader>
        {line && group ? (
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <section
              aria-label="Booking identity and status"
              className="grid gap-3 border-b border-neutral-200 bg-stone-50/70 px-5 py-4 text-sm sm:grid-cols-2 xl:grid-cols-4"
            >
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Service recipient</p>
                <p className="truncate font-semibold text-neutral-950">{recipient}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Service / scheduled start</p>
                <p className="truncate font-semibold">{service?.name || "Service"}</p>
                <p className="text-xs text-neutral-600">{formatTime12h(line.start_time)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Therapist / room</p>
                <p className="truncate font-semibold">{staff?.full_name || staff?.nickname || "Unassigned"}</p>
                <p className="truncate text-xs text-neutral-600">{room?.name || "No room assigned"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Service / payment</p>
                <p className="font-semibold">{line.booking_progress_status || line.status}</p>
                <p className="text-xs text-neutral-600">{payment?.label || "Payment unavailable"}</p>
              </div>
            </section>
            <BookingSessionWorkspace
              key={`${line.id}:${resetKey}`}
              line={line}
              recipientName={recipient}
              onClose={() => setResetKey((value) => value + 1)}
            />
            <HorizontalBookingQuickEdit
              key={`${line.id}:${editResetKey}`}
              group={group}
              onCancel={() => setEditResetKey((value) => value + 1)}
              onPartialSave={onChanged}
              onOpenFallbackReschedule={onReschedule}
              onSaved={() => {
                onOpenChange(false);
                onChanged?.();
              }}
            />
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-neutral-600">
            Booking details are unavailable. Close and refresh the booking list.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
