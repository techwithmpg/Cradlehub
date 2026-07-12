"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, Home, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
import {
  assignBookingTherapistAction,
  rescheduleBookingAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { getTherapistRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { formatTime } from "@/lib/utils";
import type { WorkspaceBookingRow } from "./bookings-workspace";
import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";

type OneOrMany<T> = T | T[] | null | undefined;

type RescheduleBookingModalProps = {
  open: boolean;
  booking: WorkspaceBookingRow | null;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
};

type RescheduleBookingModalContentProps = Omit<RescheduleBookingModalProps, "booking"> & {
  booking: WorkspaceBookingRow;
};

function first<T>(value: OneOrMany<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

function timeInputValue(time: string): string {
  return time.slice(0, 5);
}

function normalizeTimeForCompare(time: string): string {
  return time.slice(0, 5);
}

function isHomeServiceBooking(booking: WorkspaceBookingRow): boolean {
  return (
    booking.delivery_type === "home_service" ||
    booking.type === "home_service" ||
    booking.metadata?.delivery_type === "home_service" ||
    booking.metadata?.type === "home_service"
  );
}

function readHomeServiceAddress(booking: WorkspaceBookingRow | null): string {
  const raw = booking?.metadata?.home_service_address;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const record = raw as Record<string, unknown>;
  return typeof record.full_address === "string" ? record.full_address : "";
}

function readHomeServiceAccessNote(booking: WorkspaceBookingRow | null): string {
  const raw = booking?.metadata?.home_service_address;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const record = raw as Record<string, unknown>;
  return typeof record.access_note === "string" ? record.access_note : "";
}

function safeRescheduleError(message: string | undefined): string {
  if (!message) return "Could not update booking.";
  const lower = message.toLowerCase();
  if (
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("policy") ||
    lower.includes("booking_events")
  ) {
    return "Could not update booking. Your account may not have permission or the booking could not be updated.";
  }
  return message;
}

export function RescheduleBookingModal({
  open,
  booking,
  onOpenChange,
  onRescheduled,
}: RescheduleBookingModalProps) {
  if (!booking) return null;

  return (
    <RescheduleBookingModalContent
      key={booking.id}
      open={open}
      booking={booking}
      onOpenChange={onOpenChange}
      onRescheduled={onRescheduled}
    />
  );
}

function RescheduleBookingModalContent({
  open,
  booking,
  onOpenChange,
  onRescheduled,
}: RescheduleBookingModalContentProps) {
  const currentStaff = first(booking?.staff);
  const currentStaffId = currentStaff?.id ?? "";
  const currentStaffName = currentStaff?.full_name ?? "Unassigned";

  const [date, setDate] = useState(() => booking?.booking_date ?? "");
  const [startTime, setStartTime] = useState(() => timeInputValue(booking?.start_time ?? ""));
  const [selectedStaffId, setSelectedStaffId] = useState(() => currentStaffId);
  const [selectedStaffName, setSelectedStaffName] = useState(() => currentStaffName);
  const [homeServiceAddress, setHomeServiceAddress] = useState(() => readHomeServiceAddress(booking));
  const [homeServiceAccessNote, setHomeServiceAccessNote] = useState(() => readHomeServiceAccessNote(booking));
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changed = useMemo(() => {
    const dateChanged = date !== booking.booking_date;
    const timeChanged = normalizeTimeForCompare(startTime) !== normalizeTimeForCompare(booking.start_time);
    const staffChanged = selectedStaffId !== currentStaffId;
    const addressChanged =
      isHomeServiceBooking(booking) &&
      (homeServiceAddress.trim() !== readHomeServiceAddress(booking).trim() ||
        homeServiceAccessNote.trim() !== readHomeServiceAccessNote(booking).trim());

    return dateChanged || timeChanged || staffChanged || addressChanged;
  }, [booking, currentStaffId, date, homeServiceAccessNote, homeServiceAddress, selectedStaffId, startTime]);

  const currentBooking = booking;

  const customer = first(currentBooking.customers);
  const service = first(currentBooking.services);
  const resource = first(currentBooking.branch_resources);
  const isHomeService = isHomeServiceBooking(currentBooking);
  const timeChanged = normalizeTimeForCompare(startTime) !== normalizeTimeForCompare(currentBooking.start_time);
  const staffChanged = selectedStaffId !== currentStaffId;
  const addressChanged =
    isHomeService &&
    (homeServiceAddress.trim() !== readHomeServiceAddress(currentBooking).trim() ||
      homeServiceAccessNote.trim() !== readHomeServiceAccessNote(currentBooking).trim());
  const dateChanged = date !== currentBooking.booking_date;
  const requiresReason = timeChanged || staffChanged || addressChanged;

  function chooseTherapist(candidate: ScoredStaff, overrideReason?: string) {
    setSelectedStaffId(candidate.staffId);
    setSelectedStaffName(candidate.displayName);
    if (!note.trim()) {
      setNote(
        overrideReason
          ? `Therapist changed. Reason: ${overrideReason.replaceAll("_", " ")}.`
          : "Therapist changed by CRM."
      );
    }
  }

  function handleSave() {
    if (!changed) {
      setFeedback("Choose a new date, time, therapist, or address before saving.");
      return;
    }

    if (requiresReason && !note.trim()) {
      setFeedback("Add a CRM reason before saving this change.");
      return;
    }

    if (!date || !startTime) {
      setFeedback("Choose a valid date and time.");
      return;
    }

    if (isHomeService && addressChanged && !homeServiceAddress.trim()) {
      setFeedback("Enter the updated home-service address.");
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const shouldUpdateScheduleOrAddress = dateChanged || timeChanged || addressChanged;

      if (shouldUpdateScheduleOrAddress) {
        const result = await rescheduleBookingAction({
          bookingId: currentBooking.id,
          date,
          startTime,
          note: note.trim() || undefined,
          homeServiceAddress: isHomeService ? homeServiceAddress.trim() || undefined : undefined,
          homeServiceAccessNote: isHomeService ? homeServiceAccessNote.trim() || undefined : undefined,
        });

        if (!result.success) {
          setFeedback(safeRescheduleError(result.error));
          return;
        }
      }

      if (staffChanged) {
        if (!selectedStaffId) {
          setFeedback("Choose a replacement therapist before saving.");
          return;
        }

        const result = await assignBookingTherapistAction({
          bookingId: currentBooking.id,
          staffId: selectedStaffId,
          overrideReason: "other",
        });

        if (!result.success) {
          setFeedback(safeRescheduleError(result.error));
          return;
        }
      }

      toast.success("Booking updated successfully.");
      onRescheduled();
      onOpenChange(false);
    });
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      placement="center"
      ariaLabel="Reschedule booking"
    >
      <AdminOverlayHeader
        title="Reschedule Booking"
        description="Change the booking time, therapist, or home-service address with CRM checks."
      />
      <AdminOverlayBody className="bg-[var(--cs-surface-warm)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryItem label="Customer" value={customer?.full_name ?? "Customer"} />
              <SummaryItem label="Service" value={service?.name ?? "Service"} />
              <SummaryItem
                label="Current Time"
                value={`${formatDate(currentBooking.booking_date)} at ${formatTime(currentBooking.start_time)}`}
              />
              <SummaryItem label="Therapist" value={currentStaffName} />
              <SummaryItem label="Mode" value={isHomeService ? "Home Service" : "In-spa"} />
              <SummaryItem
                label={isHomeService ? "Current Address" : "Room / Resource"}
                value={isHomeService ? readHomeServiceAddress(currentBooking) || "No address saved" : resource?.name ?? "No room assigned"}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]">
              <CalendarClock size={16} />
              Date & time
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
                New date
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  disabled={isPending}
                  className="mt-2 h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm normal-case tracking-normal text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
                New time
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  disabled={isPending}
                  className="mt-2 h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm normal-case tracking-normal text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
              For online bookings, keep the customer-selected time unless the customer agreed to move.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]">
              <UserRound size={16} />
              Therapist
            </div>
            <div className="mb-3 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-2 text-sm">
              <span className="font-semibold text-[var(--cs-text)]">Selected:</span>{" "}
              <span className="text-[var(--cs-text)]">{selectedStaffName || "No therapist selected"}</span>
              {staffChanged ? (
                <span className="ml-2 rounded-full bg-[var(--cs-sand)] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text)]">
                  Change pending
                </span>
              ) : null}
            </div>
            <AssignmentRecommendationPanel
              bookingId={currentBooking.id}
              fetchRecommendations={getTherapistRecommendationsAction}
              onAssignTherapist={(staffId, overrideReason) => {
                chooseTherapist(
                  {
                    staffId,
                    displayName: staffId,
                    roleLabel: "Selected therapist",
                    tier: null,
                    recommendationType: "therapist",
                    score: 0,
                    status: "available",
                    reasons: [],
                    warnings: [],
                  },
                  overrideReason
                );
              }}
              currentTherapistId={selectedStaffId || currentStaffId || null}
              showDrivers={false}
            />
            <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
              Saving will validate the selected therapist against the final booking time.
            </p>
          </div>

          {isHomeService ? (
            <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]">
                <Home size={16} />
                Home-service address
              </div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
                Address
                <textarea
                  value={homeServiceAddress}
                  onChange={(event) => setHomeServiceAddress(event.target.value)}
                  disabled={isPending}
                  rows={2}
                  maxLength={1000}
                  className="mt-2 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Complete home-service address"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
                Access note / landmark
                <textarea
                  value={homeServiceAccessNote}
                  onChange={(event) => setHomeServiceAccessNote(event.target.value)}
                  disabled={isPending}
                  rows={2}
                  maxLength={500}
                  className="mt-2 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Example: blue gate, 2nd floor, near Puregold"
                />
              </label>
              <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
                Changing the address may affect travel time, ETA, and therapist availability.
              </p>
            </div>
          ) : null}

          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            CRM reason
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isPending}
              rows={3}
              maxLength={500}
              className="mt-2 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Example: Andrea is no longer available, reassigned therapist while keeping customer time."
            />
          </label>

          {feedback ? (
            <WorkspaceNotice tone="error">
              {feedback}
            </WorkspaceNotice>
          ) : null}
        </div>
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex flex-col gap-2 bg-[var(--cs-surface)] sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" disabled={isPending || !changed} onClick={handleSave}>
          <CalendarClock size={16} />
          {isPending ? "Saving..." : "Save Booking Changes"}
        </Button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-[var(--cs-text)]" title={value}>
        {value}
      </div>
    </div>
  );
}
