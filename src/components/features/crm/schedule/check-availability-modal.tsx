"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Clock3, Loader2, Search, UserRound } from "lucide-react";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { Button } from "@/components/ui/button";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import { cn } from "@/lib/utils";

type AvailabilityVisitType = "in_spa" | "home_service";

type Slot = {
  staff_id: string;
  staff_name: string;
  staff_tier: string;
  slot_time: string;
  available: boolean;
};

type AvailableSlotsResponse = {
  slots?: Slot[];
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string;
  initialStaffId?: string | null;
  initialTime?: string | null;
};

function formatDisplayTime(time: string): string {
  const [rawHour = "0", rawMinute = "0"] = time.slice(0, 5).split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function sortSlots(slots: Slot[]): Slot[] {
  return [...slots].sort(
    (a, b) =>
      a.slot_time.localeCompare(b.slot_time) ||
      a.staff_name.localeCompare(b.staff_name)
  );
}

export function CheckAvailabilityModal(props: Props) {
  if (!props.open) return null;

  return (
    <CheckAvailabilityModalContent
      key={`${props.initialDate}-${props.initialStaffId ?? ""}-${props.initialTime ?? ""}`}
      {...props}
    />
  );
}

function CheckAvailabilityModalContent({
  open,
  onOpenChange,
  initialDate,
  initialStaffId,
  initialTime,
}: Props) {
  const { branchId, branchName, services, staff, openBookingModal } =
    useAdministrativeBookingModal();
  const [visitType, setVisitType] = useState<AvailabilityVisitType>("in_spa");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime?.slice(0, 5) ?? "");
  const [preferredStaffId, setPreferredStaffId] = useState(initialStaffId ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ staffId: string; time: string } | null>(
    null
  );
  const [hasChecked, setHasChecked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleServices = useMemo(
    () =>
      services.filter((service) =>
        visitType === "home_service" ? service.availableHomeService : service.availableInSpa
      ),
    [services, visitType]
  );
  const selectedServiceId = eligibleServices.some((service) => service.id === serviceId)
    ? serviceId
    : "";
  const eligibleStaff = useMemo(
    () =>
      staff.filter((member) => {
        if (!selectedServiceId) return true;
        return member.serviceIds.length === 0 || member.serviceIds.includes(selectedServiceId);
      }),
    [selectedServiceId, staff]
  );
  const selectedPreferredStaffId = eligibleStaff.some((member) => member.id === preferredStaffId)
    ? preferredStaffId
    : "";
  const availableSlots = useMemo(
    () => sortSlots(slots.filter((slot) => slot.available)),
    [slots]
  );
  const exactTimeSlots = useMemo(
    () =>
      time
        ? availableSlots.filter((slot) => slot.slot_time.startsWith(time))
        : availableSlots,
    [availableSlots, time]
  );
  const preferredStaffName =
    selectedPreferredStaffId
      ? eligibleStaff.find((member) => member.id === selectedPreferredStaffId)?.nickname ||
        eligibleStaff.find((member) => member.id === selectedPreferredStaffId)?.name ||
        "Selected staff"
      : null;
  const selectedSlotDetails = selectedSlot
    ? availableSlots.find(
        (slot) =>
          slot.staff_id === selectedSlot.staffId &&
          slot.slot_time.startsWith(selectedSlot.time.slice(0, 5))
      ) ?? null
    : null;

  async function checkAvailability() {
    if (!selectedServiceId) {
      setError("Select a service before checking availability.");
      return;
    }
    if (!date) {
      setError("Choose a date before checking availability.");
      return;
    }

    setIsChecking(true);
    setError(null);
    setHasChecked(true);
    setSelectedSlot(null);

    try {
      const params = new URLSearchParams({
        branchId,
        serviceIds: selectedServiceId,
        date,
      });
      const response = await fetch(`/api/booking/available-slots?${params.toString()}`, {
        credentials: "same-origin",
      });
      const data = (await response.json()) as AvailableSlotsResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load availability.");
      }

      const nextSlots = sortSlots(data.slots ?? []);
      setSlots(nextSlots);
      const nextAvailable = nextSlots.filter((slot) => slot.available);
      const exactPreferred =
        selectedPreferredStaffId && time
          ? nextAvailable.find(
              (slot) =>
                slot.staff_id === selectedPreferredStaffId &&
                slot.slot_time.startsWith(time)
            )
          : null;
      const exactAny = time
        ? nextAvailable.find((slot) => slot.slot_time.startsWith(time))
        : null;
      const preferredAny = selectedPreferredStaffId
        ? nextAvailable.find((slot) => slot.staff_id === selectedPreferredStaffId)
        : null;
      const first = exactPreferred ?? exactAny ?? preferredAny ?? nextAvailable[0] ?? null;
      setSelectedSlot(first ? { staffId: first.staff_id, time: first.slot_time.slice(0, 5) } : null);
    } catch (caught) {
      setSlots([]);
      setError(caught instanceof Error ? caught.message : "Could not load availability.");
    } finally {
      setIsChecking(false);
    }
  }

  function createBooking() {
    if (!selectedServiceId || !selectedSlot) return;
    openBookingModal({
      mode: visitType === "home_service" ? "home_service" : "standard_future",
      serviceId: selectedServiceId,
      staffId: selectedSlot.staffId,
      date,
      time: selectedSlot.time,
    });
    onOpenChange(false);
  }

  const resultSlots = exactTimeSlots.slice(0, 12);
  const preferredExactAvailable =
    Boolean(selectedPreferredStaffId) &&
    Boolean(time) &&
    exactTimeSlots.some((slot) => slot.staff_id === selectedPreferredStaffId);

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      placement="center"
      className="bg-[var(--cs-surface)]"
    >
      <AdminOverlayHeader
        title="Check Availability"
        description={`${branchName} schedule lookup`}
      />

      <AdminOverlayBody className="space-y-4 bg-[var(--cs-surface-warm)]">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-1">
              {(["in_spa", "home_service"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVisitType(type)}
                  className={cn(
                    "h-9 rounded-lg text-xs font-semibold transition-colors",
                    visitType === type
                      ? "bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)]"
                      : "text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]"
                  )}
                >
                  {type === "home_service" ? "Home Service" : "In Spa"}
                </button>
              ))}
            </div>
          </div>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs font-semibold text-[var(--cs-text-muted)]">Service</span>
            <select
              value={selectedServiceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
            >
              <option value="">Select a service</option>
              {eligibleServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--cs-text-muted)]">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--cs-text-muted)]">Time</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
            />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs font-semibold text-[var(--cs-text-muted)]">
              Preferred Staff
            </span>
            <select
              value={selectedPreferredStaffId}
              onChange={(event) => setPreferredStaffId(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
            >
              <option value="">Any available staff</option>
              {eligibleStaff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname || member.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Button
          type="button"
          onClick={checkAvailability}
          disabled={isChecking}
          className="w-full gap-2 rounded-xl bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)] hover:bg-[var(--cs-success-text)]"
        >
          {isChecking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {isChecking ? "Checking..." : "Check Availability"}
        </Button>

        {error ? (
          <div className="rounded-xl border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] px-4 py-3 text-sm font-medium text-[var(--cs-error-text)]">
            {error}
          </div>
        ) : null}

        {hasChecked && !isChecking ? (
          <section className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--cs-text)]">Available Slots</h3>
                <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                  {resultSlots.length > 0
                    ? `${resultSlots.length} option${resultSlots.length === 1 ? "" : "s"} shown`
                    : "No matching slots found."}
                </p>
              </div>
              {selectedSlotDetails ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                  Selected
                </span>
              ) : null}
            </div>

            {selectedPreferredStaffId && time && !preferredExactAvailable ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                {preferredStaffName} is not available at {formatDisplayTime(time)}.
              </div>
            ) : null}

            {resultSlots.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {resultSlots.map((slot) => {
                  const slotKey = `${slot.staff_id}-${slot.slot_time}`;
                  const selected =
                    selectedSlot?.staffId === slot.staff_id &&
                    selectedSlot.time === slot.slot_time.slice(0, 5);
                  return (
                    <button
                      key={slotKey}
                      type="button"
                      onClick={() =>
                        setSelectedSlot({
                          staffId: slot.staff_id,
                          time: slot.slot_time.slice(0, 5),
                        })
                      }
                      className={cn(
                        "flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                        selected
                          ? "border-[var(--cs-sand)] bg-[var(--cs-sand-mist)]"
                          : "border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] hover:border-[var(--cs-border)]"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--cs-text)]">
                          <UserRound className="size-3.5" />
                          <span className="truncate">{slot.staff_name}</span>
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--cs-text-muted)]">
                          <Clock3 className="size-3.5" />
                          {formatDisplayTime(slot.slot_time)}
                        </span>
                      </span>
                      <span className="text-[10px] font-bold uppercase text-[var(--cs-text-muted)]">
                        {slot.staff_tier}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-4 py-6 text-center text-sm font-medium text-[var(--cs-text-muted)]">
                Try another date, time, staff member, or service.
              </div>
            )}
          </section>
        ) : null}
      </AdminOverlayBody>

      <AdminOverlayFooter className="bg-[var(--cs-surface)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={createBooking}
            disabled={!selectedSlot || !selectedServiceId}
            className="gap-2 bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)] hover:bg-[var(--cs-success-text)]"
          >
            <CalendarPlus className="size-4" />
            Create Booking
          </Button>
        </div>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
