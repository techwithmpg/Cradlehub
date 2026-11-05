"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { firstBookingRelation, readBookingPrice } from "@/lib/bookings/booking-display";
import { resolveBookingPartyIdentity } from "@/lib/bookings/booking-party-identity";
import { getBookingPaymentDisplayState, groupCrmBookings, type CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import { bookingGuestCount } from "@/lib/bookings/bookings-presentation";
import { resolveBookingLifecycleState } from "@/lib/bookings/operational-booking-eligibility";
import { formatTime12h } from "@/lib/utils/time-format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { crmCompleteServiceAction, crmStartServiceAction } from "@/app/(dashboard)/crm/bookings/actions";
import { serviceTransitionEventId } from "@/lib/bookings/service-transition-event";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import { BookingSessionWorkspace } from "./booking-session-workspace";
import { HorizontalBookingQuickEdit } from "./horizontal-booking-quick-edit";

export function BookingDetailsModal({
  open, group, initialSelectedLineId, onOpenChange, onChanged, onReschedule, onArrive, paymentAction,
}: {
  open: boolean;
  group: CrmBookingGroup | null;
  initialSelectedLineId?: string;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  onReschedule: (booking: WorkspaceBookingRow) => void;
  onArrive: (booking: WorkspaceBookingRow) => void;
  paymentAction?: BookingActionFn;
}) {
  const [resetKey, setResetKey] = useState(0);
  const [editResetKey, setEditResetKey] = useState(0);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(initialSelectedLineId ?? null);
  const [actionBusy, setActionBusy] = useState(false);
  const line = group?.lines.find((item) => item.id === selectedLineId) ?? group?.lines[0];
  const attendee = line ? firstBookingRelation(line.booking_attendees) : null;
  const customer = line ? firstBookingRelation(line.customers) : null;
  const service = line ? firstBookingRelation(line.services) : null;
  const staff = line ? firstBookingRelation(line.staff) : null;
  const room = line ? firstBookingRelation(line.branch_resources) : null;
  const recipient = attendee?.display_name?.trim() || customer?.full_name?.trim() || "Customer";
  const partyIdentity = resolveBookingPartyIdentity({
    bookedBy: customer?.full_name,
    serviceRecipient: recipient,
  });
  const payment = group && line ? getBookingPaymentDisplayState(group.payment, line) : null;
  const isGroup = Boolean(group && bookingGuestCount(group) > 1);
  const editGroup = line ? groupCrmBookings([line])[0] : null;
  const progress = line ? resolveBookingLifecycleState(line) : null;
  const customerProfileId = customer?.id && (!attendee?.customer_id || attendee.customer_id === customer.id)
    ? customer.id : null;

  async function runLifecycleAction() {
    if (!line || actionBusy || (progress !== "upcoming" && progress !== "checked_in" && progress !== "in_service")) return;
    setActionBusy(true);
    try {
      const result = progress === "in_service"
        ? await crmCompleteServiceAction({ bookingId: line.id })
        : await crmStartServiceAction({ bookingId: line.id });
      if (result.success) {
        const transition = progress === "in_service" ? "completed" : "started";
        const timestamp = transition === "completed" ? result.completedAt : result.startedAt;
        if (!(transition === "completed" ? result.alreadyCompleted : result.alreadyStarted)) toast.success(transition === "completed" ? "Service Completed" : "Service Started", {
          ...(timestamp ? { id: serviceTransitionEventId(transition, line.id, timestamp) } : {}),
          description: `Service session ${progress === "in_service" ? "completed" : "started"} for ${recipient}.`,
        });
        onChanged?.();
      } else {
        toast.error(result.error || "Service could not be updated.");
      }
    } catch {
      toast.error("Service could not be updated.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="booking-details-modal"
        className="flex max-h-[92dvh] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[1100px]"
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14">
          <DialogTitle className="text-lg font-bold text-neutral-950">{isGroup ? "Group Booking Details" : "Booking Details"}</DialogTitle>
          <DialogDescription className="text-xs">
            {group?.orderNumber ? `Order ${group.orderNumber} · ` : ""}
            {isGroup ? `${bookingGuestCount(group!)} guests · ${group!.lines.length} sessions` : "Review this service and manage validated booking changes."}
          </DialogDescription>
        </DialogHeader>
        {line && group ? (
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {isGroup ? <section aria-label="Parent booking order" className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-neutral-200 bg-amber-50/60 px-5 py-3 text-sm">
              <div><span className="block text-xs text-neutral-600">Booked by (main contact)</span><strong>{group.organizerName}</strong></div>
              <div><span className="block text-xs text-neutral-600">Booking reference</span><strong>{group.orderNumber || group.orderId || "Unavailable"}</strong></div>
              <div><span className="block text-xs text-neutral-600">Guests / sessions</span><strong>{bookingGuestCount(group)} / {group.lines.length}</strong></div>
              <div><span className="block text-xs text-neutral-600">Parent payment</span><strong>{payment?.label || "Payment Review"}</strong></div>
              {paymentAction && <div className="ml-auto"><PaymentActionMenu
                bookingId={group.lines[0]!.id}
                paymentStatus={group.lines[0]!.payment_status}
                paymentMethod={group.lines[0]!.payment_method}
                amountPaid={group.lines[0]!.amount_paid}
                pricePaid={readBookingPrice(group.lines[0]!.metadata)}
                paymentAction={paymentAction}
                triggerLabel={payment?.isPaymentReview ? "Review payment" : "Payment"}
                triggerVariant="panelSecondary"
                reviewRequired={payment?.isPaymentReview}
              /></div>}
            </section> : null}
            {group.lines.length > 1 ? <section aria-label="Booking sessions" className="border-b border-neutral-200 px-5 py-4">
              <h3 className="mb-2 text-sm font-bold">{isGroup ? "Guest sessions" : "Service sessions"}</h3>
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-neutral-100"><tr><th scope="col" className="px-3 py-2">Guest</th><th scope="col" className="px-3 py-2">Scheduled time</th><th scope="col" className="px-3 py-2">Service</th><th scope="col" className="px-3 py-2">Therapist</th><th scope="col" className="px-3 py-2">Room</th><th scope="col" className="px-3 py-2">Status</th></tr></thead>
                  <tbody>{group.lines.map((item) => {
                    const guest = firstBookingRelation(item.booking_attendees)?.display_name?.trim() || firstBookingRelation(item.customers)?.full_name?.trim() || "Guest";
                    const selected = item.id === line.id;
                    return <tr key={item.id} className={`border-t border-neutral-100 ${selected ? "bg-emerald-50" : "hover:bg-neutral-50"}`}>
                      <td className="p-0"><button type="button" aria-pressed={selected} onClick={() => setSelectedLineId(item.id)} className="min-h-10 w-full px-3 text-left font-semibold text-neutral-950 focus-visible:outline-2 focus-visible:outline-emerald-700">{guest}</button></td>
                      <td className="px-3 py-2">{formatTime12h(item.start_time)}</td>
                      <td className="px-3 py-2">{firstBookingRelation(item.services)?.name || "Service"}</td>
                      <td className="px-3 py-2">{firstBookingRelation(item.staff)?.full_name || "Unassigned"}</td>
                      <td className="px-3 py-2">{firstBookingRelation(item.branch_resources)?.name || "Unassigned"}</td>
                      <td className="px-3 py-2">{resolveBookingLifecycleState(item).replaceAll("_", " ")}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </section> : null}
            {!isGroup && <section
              aria-label="Booking identity and status"
              className="grid gap-3 border-b border-neutral-200 bg-stone-50/70 px-5 py-4 text-sm sm:grid-cols-2 xl:grid-cols-4"
            >
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Service for · {partyIdentity.roleLabel}</p>
                <p className="truncate font-semibold text-neutral-950">{recipient}</p>
                <p className="truncate text-xs text-neutral-600" title={partyIdentity.bookedBy ?? undefined}>Booked by: {partyIdentity.bookedBy ?? "Not recorded"}</p>
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
            </section>}
            {!isGroup && <section aria-label="Service lifecycle" className="border-b border-neutral-200 px-5 py-3">
              <h3 className="mb-2 text-sm font-bold">Service lifecycle</h3>
              <ol className="flex flex-wrap items-center gap-2 text-xs">
                {["Booked", "Arrived", "In Service", "Completed"].map((step, index) => {
                  const reached = index === 0 || (index === 1 && Boolean(line.checked_in_at || line.arrived_at))
                    || (index === 2 && Boolean(line.session_started_at))
                    || (index === 3 && progress === "completed");
                  return <li key={step} className={`rounded-full px-3 py-1.5 font-semibold ${reached ? "bg-emerald-100 text-emerald-900" : "bg-neutral-100 text-neutral-500"}`}>{step}</li>;
                })}
              </ol>
            </section>}
            <section aria-label="Selected service actions" className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-5 py-3">
              <strong className="mr-auto text-sm">{recipient}</strong>
              {customerProfileId && <Link href={`/crm/${customerProfileId}`} className="min-h-9 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50">Customer Profile</Link>}
              {progress === "upcoming" && <button type="button" onClick={() => onArrive(line)} className="min-h-9 rounded-lg border border-emerald-700 px-3 text-xs font-semibold text-emerald-800">Mark Arrived</button>}
              {(progress === "upcoming" || progress === "checked_in" || progress === "in_service") &&
                <button type="button" disabled={actionBusy} onClick={() => void runLifecycleAction()}
                  className="min-h-9 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-white disabled:opacity-50">
                  {actionBusy ? "Working…" : progress === "in_service" ? "Complete Service" : "Start Service"}
                </button>}
              {!isGroup && paymentAction && <PaymentActionMenu
                bookingId={group.lines[0]!.id}
                paymentStatus={group.lines[0]!.payment_status}
                paymentMethod={group.lines[0]!.payment_method}
                amountPaid={group.lines[0]!.amount_paid}
                pricePaid={readBookingPrice(group.lines[0]!.metadata)}
                paymentAction={paymentAction}
                triggerLabel={payment?.isPaymentReview ? "Review payment" : "Payment"}
                triggerVariant="panelSecondary"
                reviewRequired={payment?.isPaymentReview}
              />}
            </section>
            <BookingSessionWorkspace
              key={`session:${line.id}:${resetKey}`}
              line={line}
              recipientName={recipient}
              onClose={() => setResetKey((value) => value + 1)}
            />
            {editGroup && <HorizontalBookingQuickEdit
              key={`edit:${line.id}:${editResetKey}`}
              group={editGroup}
              onCancel={() => setEditResetKey((value) => value + 1)}
              onPartialSave={onChanged}
              onOpenFallbackReschedule={onReschedule}
              onSaved={() => {
                onOpenChange(false);
                onChanged?.();
              }}
            />}
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
