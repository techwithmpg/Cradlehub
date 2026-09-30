"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { assignBookingTherapistAction } from "@/app/(dashboard)/crm/bookings/actions";
import { getAssignmentRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

export function CradleFlowTherapistDialog({
  booking,
  open,
  onOpenChange,
  onAssigned,
}: {
  booking: CradleFlowBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!booking) return null;

  async function assign(staffId: string, overrideReason?: string) {
    if (!booking || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await assignBookingTherapistAction({
        bookingId: booking.id,
        staffId,
        overrideReason,
      });
      if (!result.success) {
        setError(result.error ?? "Could not assign therapist.");
        return;
      }
      toast.success("Therapist assigned.");
      onAssigned();
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not assign therapist.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => { if (!saving) onOpenChange(next); }}
      placement="center"
      size="lg"
      ariaLabel="Therapist assignment"
    >
      <AdminOverlayHeader
        title={booking.staff_id ? "Change Therapist" : "Assign Therapist"}
        description={`${booking.customer_name ?? "Customer"} · ${booking.service_name ?? "Service"}`}
      />
      <AdminOverlayBody className="grid gap-3">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>
        ) : null}
        <div className={saving ? "pointer-events-none opacity-60" : ""} aria-busy={saving}>
          <AssignmentRecommendationPanel
            bookingId={booking.id}
            fetchRecommendations={getAssignmentRecommendationsAction}
            onAssignTherapist={(staffId, overrideReason) => { void assign(staffId, overrideReason); }}
            currentTherapistId={booking.staff_id ?? null}
            showTherapists
            showDrivers={false}
          />
        </div>
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex justify-end">
        <button type="button" onClick={() => onOpenChange(false)} disabled={saving} className="cs-btn cs-btn-secondary h-10 rounded-lg px-4">
          Close
        </button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
