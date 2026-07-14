"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Copy, FileText, MessageCircle, MoreHorizontal, Phone, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import type { BookingFollowupResult } from "./booking-followup-modal";
import { buildBookingConfirmationMessage, firstBookingRelation } from "@/lib/bookings/booking-display";
import { getSelectedBookingActionPlan } from "@/lib/bookings/selected-booking-panel";
import { cn } from "@/lib/utils";

function QuickActionButton({
  label,
  icon,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const disabledReason = disabled ? `${label} is unavailable for this booking state` : undefined;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-disabled={disabled} title={disabledReason} className={cn("inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45", destructive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-[var(--cs-border)] text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]")}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function SelectedBookingQuickActions({
  booking,
  viewerRole,
  statusAction,
  onOpenFollowup,
  onOpenReschedule,
  onOpenCancel,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  viewerRole: string;
  statusAction?: BookingActionFn;
  onOpenFollowup: (result: BookingFollowupResult) => void;
  onOpenReschedule: () => void;
  onOpenCancel: () => void;
  onChanged?: () => void;
}) {
  const [messageFeedback, setMessageFeedback] = useState<string | null>(null);
  const customer = firstBookingRelation(booking.customers);
  const plan = getSelectedBookingActionPlan({
    status: booking.status,
    bookingProgressStatus: booking.booking_progress_status,
    type: booking.type,
    deliveryType: booking.delivery_type,
    resourceId: booking.resource_id,
    hasStaff: Boolean(firstBookingRelation(booking.staff)),
    hasDriver: false,
  });
  const cancelDisabled = plan.overflow.find((action) => action.id === "cancel")?.disabled;
  const closed = plan.mode === "closed";

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(buildBookingConfirmationMessage(booking));
      setMessageFeedback("Message copied");
      toast.success("Confirmation message copied.");
    } catch {
      setMessageFeedback("Could not copy message");
    }
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(booking.id);
      toast.success("Booking reference copied.");
    } catch {
      toast.error("Could not copy booking reference.");
    }
  }

  return (
    <div className="mx-5">
      <div className="grid grid-cols-[0.8fr_0.95fr_1.2fr_0.9fr_42px] gap-2">
        <QuickActionButton label="Call" icon={<Phone className="size-4" />} onClick={() => onOpenFollowup("confirmed")} />
        <QuickActionButton label="Message" icon={<MessageCircle className="size-4" />} onClick={() => { void copyMessage(); }} />
        <QuickActionButton label="Reschedule" icon={<CalendarClock className="size-4" />} onClick={onOpenReschedule} disabled={closed} />
        <QuickActionButton label="Cancel" icon={<X className="size-4" />} onClick={onOpenCancel} disabled={cancelDisabled} destructive />
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" aria-label="Open more booking actions" className="flex size-[42px] items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"><MoreHorizontal className="size-5" /></button>} />
          <DropdownMenuContent align="end" className="min-w-52">
            <div className="px-0.5 py-0.5">
              <BookingActionMenu bookingId={booking.id} currentStatus={booking.status} userRole={viewerRole} statusAction={statusAction} actionScope="status" triggerLabel="Change status" triggerVariant="menuItem" fullWidth emptyBehavior="disabled" onUpdate={onChanged} />
            </div>
            {customer?.id ? (
              <DropdownMenuItem render={<Link href={`/crm/${customer.id}`} />}>
                <UserRound className="size-4" />
                Open customer profile
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => { void copyReference(); }}>
              <Copy className="size-4" />
              Copy booking reference
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <FileText className="size-4" />
              View audit log
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {messageFeedback ? <p className="mt-2 text-xs text-[var(--cs-text-muted)]" role="status">{messageFeedback}</p> : null}
    </div>
  );
}
