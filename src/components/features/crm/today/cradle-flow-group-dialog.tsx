"use client";

import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { formatCradleFlowMoney, type CradleFlowBooking } from "@/lib/crm/cradle-flow";
import { TherapistProvenanceBadge } from "@/components/features/bookings/therapist-provenance-badge";
import type { CradleFlowGroup } from "./cradle-flow-display";

export function CradleFlowGroupDialog({
  group,
  open,
  onOpenChange,
  onOpenLine,
}: {
  group: CradleFlowGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLine: (line: CradleFlowBooking) => void;
}) {
  if (!group) return null;
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      size="lg"
      ariaLabel="Booking order details"
      className="max-h-[88dvh]"
    >
      <AdminOverlayHeader
        title={group.organizerName}
        description={`Order ${group.orderNumber ?? group.orderId?.slice(0, 8)} · ${group.guestCount} guest${group.guestCount === 1 ? "" : "s"} · ${group.serviceCount} services`}
      />
      <AdminOverlayBody className="grid gap-3">
        <div className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3 text-sm">
          <strong className="capitalize">{group.stage.replaceAll("_", " ")}</strong>
          <div className="mt-1 text-xs">
            {group.payment.total === null
              ? "Total unavailable"
              : `${formatCradleFlowMoney(group.payment.total)} total`}{" "}
            ·{" "}
            {group.payment.paid === null
              ? "Paid unavailable"
              : `${formatCradleFlowMoney(group.payment.paid)} paid`}{" "}
            ·{" "}
            {group.payment.due === null
              ? "Due unavailable"
              : `${formatCradleFlowMoney(group.payment.due)} due`}
          </div>
          {group.attentionSummary.length > 0 ? (
            <div className="mt-1 text-xs text-amber-800">{group.attentionSummary.join(" · ")}</div>
          ) : null}
        </div>
        <div className="grid gap-2">
          {group.lines.map((line) => {
            const attendee = Array.isArray(line.booking_attendees)
              ? line.booking_attendees[0]
              : line.booking_attendees;
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => onOpenLine(line)}
                className="rounded-lg border border-[var(--cs-border-soft)] p-3 text-left hover:bg-[var(--cs-surface-warm)]"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <strong>{attendee?.display_name ?? line.customer_name ?? "Guest"}</strong>
                  <span className="capitalize text-xs">
                    {line.booking_progress_status?.replaceAll("_", " ") ??
                      line.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-1 text-xs">
                  {line.service_name ?? "Service"} · {line.start_time.slice(0, 5)}–
                  {line.end_time.slice(0, 5)}
                </div>
                <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
                  Therapist: {line.staff_name ?? "Not assigned"}
                  <TherapistProvenanceBadge booking={line} /> · Room:{" "}
                  {line.resource_name ?? "Not assigned"}
                </div>
                <div className="mt-1 text-xs font-semibold text-emerald-800">
                  Open service actions
                </div>
              </button>
            );
          })}
        </div>
      </AdminOverlayBody>
      <AdminOverlayFooter>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-lg border border-[var(--cs-border)] px-4 py-2 text-sm font-semibold"
        >
          Close
        </button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
