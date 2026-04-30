"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Calendar, CheckCircle2, Clock3, Home, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { createOnlineBookingAction } from "@/app/(public)/book/actions";

type BookingType = "online" | "home_service";
type PaymentOption = "pay_at_spa" | "gcash_soon";
type TherapistSelection = "any-available" | string;

type BranchOption = {
  id: string;
  name: string;
  slotIntervalMinutes: number;
};

type BookingService = {
  branchServiceId: string;
  serviceId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
};

type TherapistOption = {
  id: string;
  name: string;
  tier: string;
};

type BookingContextResponse = {
  branches: BranchOption[];
  selectedBranchId: string | null;
  services: BookingService[];
  staff: TherapistOption[];
};

type AvailabilitySlot = {
  staff_id: string;
  staff_name: string;
  staff_tier: string;
  slot_time: string;
  available: boolean;
};

type AvailabilityResponse = {
  slots?: AvailabilitySlot[];
  error?: string;
};

type TimeOption = {
  time: string;
  therapistCount: number;
};

type BookingSuccess = {
  bookingId: string;
  serviceName: string;
  date: string;
  time: string;
  therapistLabel: string;
};

type BookingWizardProps = {
  initialServiceId?: string;
  onClose?: () => void;
  mode?: "modal" | "page";
};

const stepLabels = [
  "Service",
  "Therapist",
  "Schedule",
  "Details",
  "Confirm",
] as const;

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="animate-spin"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid rgba(248,236,209,0.35)",
        borderTopColor: "rgba(248,236,209,0.95)",
        display: "inline-block",
      }}
    />
  );
}

function getTodayDateInput(): string {
  return new Date().toISOString().split("T")[0]!;
}

function toHHMM(value: string): string {
  return value.slice(0, 5);
}

export function BookingWizard({
  initialServiceId,
  onClose,
  mode = "modal",
}: BookingWizardProps) {
  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [services, setServices] = useState<BookingService[]>([]);
  const [staff, setStaff] = useState<TherapistOption[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedTherapistId, setSelectedTherapistId] = useState<TherapistSelection>("any-available");
  const [selectedDate, setSelectedDate] = useState(getTodayDateInput());
  const [timeOptions, setTimeOptions] = useState<TimeOption[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookingType, setBookingType] = useState<BookingType>("online");
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("pay_at_spa");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();

  const selectedService = useMemo(
    () => services.find((service) => service.serviceId === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  const selectedTherapist = selectedTherapistId === "any-available"
    ? null
    : staff.find((therapist) => therapist.id === selectedTherapistId) ?? null;

  const loadBookingContext = useCallback(
    async (branchId?: string) => {
      setContextError(null);
      setLoadingContext(true);

      try {
        const params = new URLSearchParams();
        if (branchId) params.set("branchId", branchId);

        const response = await fetch(`/api/public/booking-context?${params.toString()}`);
        const data = (await response.json()) as BookingContextResponse | { error: string };

        if (!response.ok || "error" in data) {
          const message = "error" in data ? data.error : "Could not load booking options";
          throw new Error(message);
        }

        const nextBranches = data.branches;
        const nextBranchId = data.selectedBranchId ?? "";
        const nextServices = data.services;
        const nextStaff = data.staff;

        setBranches(nextBranches);
        setSelectedBranchId(nextBranchId);
        setServices(nextServices);
        setStaff(nextStaff);
        setSelectedTherapistId("any-available");
        setSelectedTime("");

        setSelectedServiceId((previous) => {
          const initialMatch =
            initialServiceId && nextServices.some((service) => service.serviceId === initialServiceId)
              ? initialServiceId
              : null;
          if (initialMatch && !branchId) return initialMatch;

          if (nextServices.some((service) => service.serviceId === previous)) {
            return previous;
          }

          return nextServices[0]?.serviceId ?? "";
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load booking options";
        setContextError(message);
      } finally {
        setLoadingContext(false);
      }
    },
    [initialServiceId]
  );

  useEffect(() => {
    void loadBookingContext();
  }, [loadBookingContext]);

  useEffect(() => {
    if (!selectedBranchId || !selectedServiceId || !selectedDate) {
      setTimeOptions([]);
      setSelectedTime("");
      return;
    }

    const params = new URLSearchParams({
      branchId: selectedBranchId,
      serviceId: selectedServiceId,
      date: selectedDate,
    });

    if (selectedTherapistId !== "any-available") {
      params.set("staffId", selectedTherapistId);
    }

    setLoadingSlots(true);
    setSlotError(null);

    fetch(`/api/booking/available-slots?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as AvailabilityResponse;
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load availability");
        }

        const availableSlots = (data.slots ?? []).filter((slot) => slot.available);

        if (selectedTherapistId === "any-available") {
          const grouped = availableSlots.reduce<Record<string, number>>((acc, slot) => {
            const hhmm = toHHMM(slot.slot_time);
            acc[hhmm] = (acc[hhmm] ?? 0) + 1;
            return acc;
          }, {});

          const options = Object.entries(grouped)
            .map(([time, therapistCount]) => ({ time, therapistCount }))
            .sort((a, b) => a.time.localeCompare(b.time));
          return options;
        }

        return availableSlots
          .map((slot) => ({ time: toHHMM(slot.slot_time), therapistCount: 1 }))
          .sort((a, b) => a.time.localeCompare(b.time));
      })
      .then((options) => {
        setTimeOptions(options);
        setSelectedTime((previous) => {
          if (options.some((option) => option.time === previous)) return previous;
          return options[0]?.time ?? "";
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not load availability";
        setSlotError(message);
        setTimeOptions([]);
        setSelectedTime("");
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedBranchId, selectedServiceId, selectedTherapistId, selectedDate]);

  const canMoveNext = useMemo(() => {
    if (step === 1) return selectedBranchId.length > 0 && selectedServiceId.length > 0;
    if (step === 2) return selectedTherapistId.length > 0;
    if (step === 3) return selectedDate.length > 0 && selectedTime.length > 0;
    if (step === 4) return fullName.trim().length >= 2 && phone.trim().length >= 7;
    return true;
  }, [
    fullName,
    phone,
    selectedBranchId,
    selectedDate,
    selectedServiceId,
    selectedTherapistId,
    selectedTime,
    step,
  ]);

  function handleNext() {
    if (!canMoveNext) return;
    setStep((prev) => Math.min(prev + 1, stepLabels.length));
  }

  function handleBack() {
    setStep((prev) => Math.max(prev - 1, 1));
  }

  function handleBranchChange(nextBranchId: string) {
    void loadBookingContext(nextBranchId);
  }

  function handleConfirmBooking() {
    if (!selectedBranchId || !selectedServiceId || !selectedDate || !selectedTime) return;
    if (!fullName.trim() || !phone.trim()) return;

    setSubmitError(null);

    startSubmitTransition(async () => {
      const result = await createOnlineBookingAction({
        branchId: selectedBranchId,
        serviceId: selectedServiceId,
        staffId: selectedTherapistId === "any-available" ? undefined : selectedTherapistId,
        date: selectedDate,
        startTime: selectedTime,
        type: bookingType,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      if (!result.success) {
        setSubmitError(result.error);
        return;
      }

      setSuccess({
        bookingId: result.bookingId,
        serviceName: selectedService?.name ?? "Service",
        date: selectedDate,
        time: selectedTime,
        therapistLabel: selectedTherapist?.name ?? "Any Available Therapist",
      });
    });
  }

  if (loadingContext) {
    return (
      <div className={cn("flex h-full items-center justify-center", mode === "page" ? "min-h-[40rem]" : "min-h-[34rem]")}>
        <p className="flex items-center gap-2 text-sm text-[#f8ecd1]/78">
          <Spinner />
          Loading booking options…
        </p>
      </div>
    );
  }

  if (contextError) {
    return (
      <div className={cn("flex h-full items-center justify-center", mode === "page" ? "min-h-[40rem]" : "min-h-[34rem]")}>
        <div className="w-full rounded-xl border border-rose-300/35 bg-rose-200/10 p-4 text-sm text-rose-100">
          {contextError}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", mode === "page" ? "min-h-[40rem]" : "min-h-[34rem]")}>
      <div className="mb-4 rounded-2xl border border-[#f6e3a1]/28 bg-[linear-gradient(170deg,rgba(52,35,24,0.72),rgba(34,24,17,0.74))] p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.18em] text-[#f6e3a1]/72 uppercase">
          <span>Booking progress</span>
          <span>Step {step} / {stepLabels.length}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {stepLabels.map((label, index) => {
            const current = index + 1;
            const done = current < step;
            const active = current === step;
            return (
              <div key={label} className="space-y-1">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    done ? "bg-[#d6a84f]" : active ? "bg-[#e7c873]/85" : "bg-[#f6e3a1]/16"
                  )}
                />
                <p className="truncate text-[10px] text-[#f8ecd1]/75">{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {step === 1 && (
          <section className="space-y-3">
            <h3 className="font-heading text-xl font-semibold text-[#fff7e4]">Choose your service</h3>
            <label className="block space-y-2">
              <span className="text-sm text-[#f8ecd1]/80">Branch</span>
              <select
                value={selectedBranchId}
                onChange={(event) => handleBranchChange(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#f6e3a1]/22 bg-[#2d1f15]/58 px-3 text-sm text-[#fff6df]"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {services.map((service) => (
                <button
                  key={service.serviceId}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(service.serviceId);
                    setSelectedTime("");
                  }}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all duration-300",
                    selectedServiceId === service.serviceId
                      ? "border-[#d6a84f]/80 bg-[#f6e3a1]/12 shadow-[0_0_0_1px_rgba(214,168,79,0.42)]"
                      : "border-[#f6e3a1]/18 bg-[#2a1c13]/54 hover:border-[#e7c873]/45"
                  )}
                >
                  <p className="font-heading text-xl font-medium text-[#fff6df]">{service.name}</p>
                  <p className="mt-1 text-sm text-[#f8ecd1]/78">
                    {service.description ?? "Premium wellness treatment"}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#f8ecd1]/86">
                    <span>{service.durationMinutes} mins</span>
                    <span className="font-semibold">{formatCurrency(service.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <h3 className="font-heading text-xl font-semibold text-[#fff7e4]">Select therapist</h3>
            <div className="space-y-2">
              {[
                {
                  id: "any-available",
                  name: "Any Available Therapist",
                  tier: "auto",
                  focus: "System will auto-assign by availability and seniority",
                },
                ...staff.map((member) => ({
                  id: member.id,
                  name: member.name,
                  tier: member.tier,
                  focus: "Selected therapist preference",
                })),
              ].map((therapist) => {
                const selected = selectedTherapistId === therapist.id;
                return (
                  <button
                    key={therapist.id}
                    type="button"
                    onClick={() => {
                      setSelectedTherapistId(therapist.id);
                      setSelectedTime("");
                    }}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition-all duration-300",
                      selected
                        ? "border-[#d6a84f]/78 bg-[#f6e3a1]/12"
                        : "border-[#f6e3a1]/18 bg-[#2a1c13]/54 hover:border-[#e7c873]/45"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-[#fff6df]">{therapist.name}</p>
                      <span className="text-xs uppercase tracking-[0.15em] text-[#f6e3a1]/80">
                        {therapist.tier}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#f8ecd1]/78">{therapist.focus}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h3 className="font-heading text-xl font-semibold text-[#fff7e4]">Choose date and time</h3>
            <label className="block space-y-2">
              <span className="text-sm text-[#f8ecd1]/80">Date</span>
              <Input
                type="date"
                value={selectedDate}
                min={getTodayDateInput()}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#fff6df]"
              />
            </label>
            <div className="space-y-2">
              <p className="text-sm text-[#f8ecd1]/80">Available slots</p>
              {loadingSlots ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#f6e3a1]/20 bg-[#2a1d13]/58 px-3 py-2 text-sm text-[#f8ecd1]/78">
                  <Spinner />
                  Loading availability…
                </div>
              ) : slotError ? (
                <div className="rounded-xl border border-rose-300/35 bg-rose-200/10 px-3 py-2 text-sm text-rose-100">
                  {slotError}
                </div>
              ) : timeOptions.length === 0 ? (
                <div className="rounded-xl border border-amber-200/40 bg-amber-200/10 px-3 py-2 text-sm text-amber-100">
                  No available slots for the selected date.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {timeOptions.map((option) => (
                    <button
                      key={option.time}
                      type="button"
                      onClick={() => setSelectedTime(option.time)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition-all duration-300",
                        selectedTime === option.time
                          ? "border-[#d6a84f]/76 bg-[#f6e3a1]/12 text-[#fff6df]"
                          : "border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#f8ecd1]/82 hover:border-[#e7c873]/45"
                      )}
                    >
                      <div>{formatTime(option.time)}</div>
                      {selectedTherapistId === "any-available" && (
                        <div className="mt-0.5 text-[11px] text-[#f8ecd1]/62">
                          {option.therapistCount} available
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="rounded-xl border border-emerald-300/28 bg-emerald-200/12 px-3 py-2 text-sm text-emerald-50/95">
              Online bookings are auto-confirmed once submitted.
            </p>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h3 className="font-heading text-xl font-semibold text-[#fff7e4]">Customer details</h3>
            <label className="block space-y-2">
              <span className="text-sm text-[#f8ecd1]/80">Full name</span>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                className="border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#fff6df] placeholder:text-[#f8ecd1]/45"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[#f8ecd1]/80">Phone number</span>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="09XXXXXXXXX"
                className="border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#fff6df] placeholder:text-[#f8ecd1]/45"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[#f8ecd1]/80">Email (optional)</span>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@email.com"
                className="border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#fff6df] placeholder:text-[#f8ecd1]/45"
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm text-[#f8ecd1]/80">Booking type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBookingType("online")}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    bookingType === "online"
                      ? "border-[#d6a84f]/76 bg-[#f6e3a1]/12 text-[#fff6df]"
                      : "border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#f8ecd1]/82"
                  )}
                >
                  In-spa
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType("home_service")}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    bookingType === "home_service"
                      ? "border-[#d6a84f]/76 bg-[#f6e3a1]/12 text-[#fff6df]"
                      : "border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#f8ecd1]/82"
                  )}
                >
                  Home service
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-[#f8ecd1]/80">Payment option</p>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentOption("pay_at_spa")}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm",
                    paymentOption === "pay_at_spa"
                      ? "border-[#d6a84f]/76 bg-[#f6e3a1]/12 text-[#fff6df]"
                      : "border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#f8ecd1]/82"
                  )}
                >
                  Pay at spa
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentOption("gcash_soon")}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm",
                    paymentOption === "gcash_soon"
                      ? "border-[#d6a84f]/76 bg-[#f6e3a1]/12 text-[#fff6df]"
                      : "border-[#f6e3a1]/22 bg-[#2d1f15]/58 text-[#f8ecd1]/82"
                  )}
                >
                  GCash manual payment (coming soon)
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            {!success ? (
              <>
                <h3 className="font-heading text-xl font-semibold text-[#fff7e4]">Review and confirm</h3>
                <div className="space-y-2 rounded-2xl border border-[#f6e3a1]/22 bg-[linear-gradient(170deg,rgba(45,30,20,0.78),rgba(30,21,15,0.76))] p-4 text-sm text-[#f8ecd1]/86">
                  <p className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#e7c873]" /> {selectedService?.name}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-[#e7c873]" />{" "}
                    {selectedTherapist?.name ?? "Any Available Therapist"}
                  </p>
                  <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#e7c873]" /> {formatDate(selectedDate)}</p>
                  <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#e7c873]" /> {formatTime(selectedTime)}</p>
                  <p className="flex items-center gap-2"><Home className="h-4 w-4 text-[#e7c873]" /> {bookingType === "home_service" ? "Home service" : "In-spa"}</p>
                  <p className="pt-2 text-[#fff7e4]">Estimated total: {formatCurrency(selectedService?.price ?? 0)}</p>
                </div>
                <p className="text-sm text-[#f8ecd1]/74">
                  Public cancellation is not available. Staff can assist with edits, rescheduling, or cancellation.
                </p>
                {submitError && (
                  <div className="rounded-xl border border-rose-300/35 bg-rose-200/10 px-3 py-2 text-sm text-rose-100">
                    {submitError}
                  </div>
                )}
                <Button
                  className="h-10 w-full bg-[#d6a84f] text-[#1f130c] hover:bg-[#e7c873]"
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Spinner size={13} />
                      Creating booking…
                    </span>
                  ) : "Confirm booking"}
                </Button>
              </>
            ) : (
              <div className="space-y-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-200" />
                <h3 className="text-xl font-semibold text-emerald-50">Booking confirmed</h3>
                <p className="text-sm text-emerald-100/85">
                  Booking ID: <span className="font-semibold">{success.bookingId}</span>
                </p>
                <div className="rounded-xl border border-emerald-200/30 bg-emerald-950/20 p-3 text-left text-sm text-emerald-100/90">
                  <p>Service: {success.serviceName}</p>
                  <p>Time: {formatDate(success.date)} · {formatTime(success.time)}</p>
                  <p>Therapist: {success.therapistLabel}</p>
                </div>
                {onClose && (
                  <Button
                    className="h-10 w-full bg-emerald-200 text-emerald-950 hover:bg-emerald-100"
                    onClick={onClose}
                  >
                    Close
                  </Button>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {!success && (
        <div className="mt-4 flex items-center justify-between border-t border-[#f6e3a1]/18 pt-3">
          <Button
            variant="ghost"
            className="text-[#f8ecd1] hover:bg-[#f6e3a1]/12 hover:text-[#fff6de]"
            onClick={step === 1 ? onClose : handleBack}
          >
            {step === 1 ? "Close" : "Back"}
          </Button>
          {step < 5 && (
            <Button
              onClick={handleNext}
              disabled={!canMoveNext}
              className="bg-[#d6a84f] text-[#1f130c] hover:bg-[#e7c873] disabled:bg-[#f6e3a1]/20 disabled:text-[#f8ecd1]/50"
            >
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
