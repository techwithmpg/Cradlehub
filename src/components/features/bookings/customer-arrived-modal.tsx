"use client";

import { useState, useTransition } from "react";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { Button } from "@/components/ui/button";
import { markBookingArrivedAction } from "@/app/(dashboard)/crm/bookings/actions";
import type { WorkspaceBookingRow } from "./bookings-workspace";

type CustomerArrivedModalProps = {
  open: boolean;
  booking: WorkspaceBookingRow | null;
  onOpenChange: (open: boolean) => void;
  onMarkedArrived: () => void;
};

export function CustomerArrivedModal({
  open,
  booking,
  onOpenChange,
  onMarkedArrived,
}: CustomerArrivedModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!booking) return null;
  const currentBooking = booking;

  function handleConfirm() {
    setFeedback(null);
    startTransition(async () => {
      const result = await markBookingArrivedAction({ bookingId: currentBooking.id });
      if (!result.success) {
        setFeedback(result.error ?? "Could not mark customer arrived.");
        return;
      }
      onMarkedArrived();
    });
  }

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange} size="sm" placement="center">
      <AdminOverlayHeader title="Customer Arrived" />
      <AdminOverlayBody className="bg-[var(--cs-surface-warm)]">
        <p className="text-sm leading-6 text-[var(--cs-text)]">
          Mark this customer as physically present and ready for room assignment?
        </p>
        {feedback ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {feedback}
          </div>
        ) : null}
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex justify-end gap-2 bg-[var(--cs-surface)]">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" disabled={isPending} onClick={handleConfirm}>
          {isPending ? "Marking..." : "Mark Arrived"}
        </Button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
