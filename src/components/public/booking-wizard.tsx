"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { SPA_IMAGES } from "@/constants/spa-images";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  Home,
  Building,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { createOnlineBookingAction } from "@/lib/actions/online-booking";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
};

type Service = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  categoryName?: string;
};

type Slot = {
  staff_id: string;
  staff_name: string;
  staff_tier: string;
  slot_time: string;
  available: boolean;
};

const steps = [
  { id: 1, label: "Branch" },
  { id: 2, label: "Service" },
  { id: 3, label: "Date & Time" },
  { id: 4, label: "Details" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h!, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

// Public booking does not expose therapist selection.
// Normalize duplicate backend rows into one entry per start time.
function normalizePublicSlots(rawSlots: Slot[]) {
  const byTime = new Map<string, Slot>();

  for (const slot of rawSlots) {
    const existing = byTime.get(slot.slot_time);
    if (!existing) {
      byTime.set(slot.slot_time, slot);
      continue;
    }

    // Prefer an available row if mixed availability appears for the same time.
    if (!existing.available && slot.available) {
      byTime.set(slot.slot_time, slot);
    }
  }

  return Array.from(byTime.values()).sort((a, b) => a.slot_time.localeCompare(b.slot_time));
}

export function BookingWizard() {
  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ bookingId: string } | null>(null);

  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingType, setBookingType] = useState<"online" | "home_service">("online");

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");

  // Fetch branches on mount
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches ?? []);
        setLoadingBranches(false);
      })
      .catch(() => setLoadingBranches(false));
  }, []);

  // Fetch services when branch selected
  useEffect(() => {
    if (!selectedBranch) return;
    const id = setTimeout(() => setLoadingServices(true), 0);
    fetch(`/api/public/booking-context?branchId=${selectedBranch.id}`)
      .then((r) => r.json())
      .then((data) => {
        const svcs = (data.services ?? []).map((s: { serviceId?: string; id?: string; name: string; description?: string | null; durationMinutes: number; price: number }) => ({
          id: s.serviceId ?? s.id ?? "",
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: s.price,
        }));
        setServices(svcs);
        setLoadingServices(false);
      })
      .catch(() => setLoadingServices(false));
    return () => clearTimeout(id);
  }, [selectedBranch]);

  // Fetch slots when branch+service+date selected
  useEffect(() => {
    if (!selectedBranch || !selectedService || !selectedDate) return;
    const id = setTimeout(() => setLoadingSlots(true), 0);
    const dateStr = selectedDate.toISOString().split("T")[0]!;
    fetch(
      `/api/booking/available-slots?branchId=${selectedBranch.id}&serviceId=${selectedService.id}&date=${dateStr}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(normalizePublicSlots((data.slots ?? []) as Slot[]));
        setLoadingSlots(false);
      })
      .catch(() => setLoadingSlots(false));
    return () => clearTimeout(id);
  }, [selectedBranch, selectedService, selectedDate]);

  const handleSubmit = useCallback(async () => {
    if (!selectedBranch || !selectedService || !selectedDate || !selectedSlot) return;
    if (!form.fullName.trim() || !form.phone.trim()) {
      setFormError("Please enter your full name and phone number.");
      return;
    }
    setFormError("");
    setSubmitting(true);

    const result = await createOnlineBookingAction({
      branchId: selectedBranch.id,
      serviceId: selectedService.id,
      date: selectedDate.toISOString().split("T")[0]!,
      startTime: selectedSlot.slot_time,
      type: bookingType,
      fullName: form.fullName,
      phone: form.phone,
      email: form.email || undefined,
      notes: form.notes || undefined,
    });

    setSubmitting(false);
    if (result.success) {
      setSuccess({ bookingId: result.bookingId });
      setStep(5);
    } else {
      setFormError(result.error);
    }
  }, [selectedBranch, selectedService, selectedDate, selectedSlot, form, bookingType]);

  const canProceed =
    step === 1
      ? !!selectedBranch
      : step === 2
      ? !!selectedService
      : step === 3
      ? !!selectedSlot
      : step === 4
      ? form.fullName.trim().length >= 2 && form.phone.trim().length >= 7
      : false;

  return (
    <div className="min-h-screen" style={{ background: "#F7F3EB" }}>
      {/* Sub-hero header */}
      <div className="relative pt-28 pb-12 lg:pt-32 lg:pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={SPA_IMAGES.booking}
            alt="Spa atmosphere"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(16,38,29,0.88) 0%, rgba(22,58,43,0.78) 100%)",
            }}
          />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-3"
            style={{ color: "#C8A96B" }}
          >
            Online Booking
          </p>
          <h1
            className="text-3xl sm:text-4xl font-medium"
            style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
          >
            Book Your Appointment
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10 lg:py-14">
        {/* Stepper */}
        {step < 5 && (
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-1 sm:gap-3">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1 sm:gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-[12px] sm:text-[13px] font-semibold transition-all duration-300 ${
                        step > s.id
                          ? "bg-[#163A2B] text-[#C8A96B]"
                          : step === s.id
                          ? "bg-[#C8A96B] text-[#10261D]"
                          : "bg-white text-[#9AA89A] border border-[#EDE4D3]"
                      }`}
                    >
                      {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                    </div>
                    <span
                      className={`hidden sm:block text-[11px] mt-2 font-medium ${
                        step >= s.id ? "text-[#163A2B]" : "text-[#9AA89A]"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-5 sm:w-12 lg:w-16 h-0.5 rounded-full transition-colors duration-300 ${
                        step > s.id ? "bg-[#C8A96B]" : "bg-[#EDE4D3]"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <StepBranches
                branches={branches}
                loading={loadingBranches}
                selected={selectedBranch}
                onSelect={(b) => {
                  setSelectedBranch(b);
                  setSelectedService(null);
                  setSelectedSlot(null);
                }}
              />
            )}
            {step === 2 && (
              <StepServices
                services={services}
                loading={loadingServices}
                selected={selectedService}
                onSelect={(s) => {
                  setSelectedService(s);
                  setSelectedSlot(null);
                }}
              />
            )}
            {step === 3 && (
              <StepDateTime
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                slots={slots}
                loading={loadingSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            )}
            {step === 4 && (
              <StepDetails
                form={form}
                onChange={setForm}
                error={formError}
                bookingType={bookingType}
                onChangeType={setBookingType}
              />
            )}
            {step === 5 && success && (
              <StepSuccess bookingId={success.bookingId} />
            )}

            {/* Navigation */}
            {step < 5 && (
              <div className="flex items-center justify-between mt-10 pt-8 border-t border-[#EDE4D3]">
                <button
                  onClick={() => setStep(Math.max(1, step - 1))}
                  disabled={step === 1}
                  className="flex items-center gap-2 text-[13px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#163A2B]"
                  style={{ color: "#6B7A6F" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                {step < 4 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={!canProceed}
                    className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg"
                    style={{
                      background: canProceed
                        ? "linear-gradient(135deg, #C8A96B, #B68A3C)"
                        : "#EDE4D3",
                      color: canProceed ? "#10261D" : "#9AA89A",
                    }}
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceed || submitting}
                    className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg"
                    style={{
                      background: canProceed
                        ? "linear-gradient(135deg, #C8A96B, #B68A3C)"
                        : "#EDE4D3",
                      color: canProceed ? "#10261D" : "#9AA89A",
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        Confirm Booking
                        <Check className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          {step < 5 && (
            <div className="hidden lg:block">
              <div
                className="sticky top-28 rounded-2xl p-6 border"
                style={{
                  background: "#FCFAF5",
                  borderColor: "#EDE4D3",
                }}
              >
                <h3
                  className="text-[14px] font-semibold mb-5"
                  style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                >
                  Booking Summary
                </h3>
                <div className="flex flex-col gap-5">
                  <SummaryRow
                    icon={Building}
                    label="Branch"
                    value={selectedBranch?.name}
                    placeholder="Not selected"
                  />
                  <SummaryRow
                    icon={Clock}
                    label="Service"
                    value={selectedService?.name}
                    placeholder="Not selected"
                    sub={selectedService ? `${selectedService.durationMinutes} min · ${formatCurrency(selectedService.price)}` : undefined}
                  />
                  <SummaryRow
                    icon={CalendarDays}
                    label="Date & Time"
                    value={
                      selectedDate && selectedSlot
                        ? `${selectedDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} at ${formatTime(selectedSlot.slot_time)}`
                        : undefined
                    }
                    placeholder="Not selected"
                  />
                  <SummaryRow
                    icon={bookingType === "home_service" ? Home : Building}
                    label="Type"
                    value={bookingType === "home_service" ? "Home Service" : "In-Spa"}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  placeholder,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  placeholder?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#163A2B]/5 shrink-0">
        <Icon className="h-4 w-4 text-[#163A2B]" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "#9AA89A" }}>
          {label}
        </p>
        <p className="text-[13px] font-medium mt-0.5" style={{ color: value ? "#163A2B" : "#9AA89A" }}>
          {value || placeholder}
        </p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: "#6B7A6F" }}>{sub}</p>}
      </div>
    </div>
  );
}

function StepBranches({
  branches,
  loading,
  selected,
  onSelect,
}: {
  branches: Branch[];
  loading: boolean;
  selected: Branch | null;
  onSelect: (b: Branch) => void;
}) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[15px] font-medium" style={{ color: "#163A2B" }}>
          No branches available
        </p>
        <p className="text-[13px] mt-2" style={{ color: "#6B7A6F" }}>
          Please check back soon or contact us directly.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Choose a Location
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Select the branch you would like to visit for your appointment.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {branches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => onSelect(branch)}
            className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-300 ${
              selected?.id === branch.id
                ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
                : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                selected?.id === branch.id ? "bg-[#163A2B] text-[#C8A96B]" : "bg-[#163A2B]/5 text-[#163A2B]"
              }`}
            >
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "#163A2B" }}>
                {branch.name}
              </p>
              {branch.address && (
                <p className="text-[12px] mt-1" style={{ color: "#6B7A6F" }}>
                  {branch.address}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepServices({
  services,
  loading,
  selected,
  onSelect,
}: {
  services: Service[];
  loading: boolean;
  selected: Service | null;
  onSelect: (s: Service) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[15px] font-medium" style={{ color: "#163A2B" }}>
          No services available
        </p>
        <p className="text-[13px] mt-2" style={{ color: "#6B7A6F" }}>
          This location does not have any services listed yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Choose a Service
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Select the treatment you would like to book.
      </p>
      <div className="flex flex-col gap-4">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onSelect(service)}
            className={`flex items-center gap-5 p-5 rounded-xl border text-left transition-all duration-300 ${
              selected?.id === service.id
                ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
                : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
            }`}
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                selected?.id === service.id ? "bg-[#163A2B] text-[#C8A96B]" : "bg-[#163A2B]/5 text-[#163A2B]"
              }`}
            >
              <Clock className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[14px] font-semibold truncate" style={{ color: "#163A2B" }}>
                  {service.name}
                </p>
                <span className="text-[13px] font-semibold shrink-0" style={{ color: "#C8A96B" }}>
                  {formatCurrency(service.price)}
                </span>
              </div>
              {service.description && (
                <p className="text-[12px] mt-1 line-clamp-2" style={{ color: "#6B7A6F" }}>
                  {service.description}
                </p>
              )}
              <p className="text-[11px] mt-2 font-medium" style={{ color: "#9AA89A" }}>
                {service.durationMinutes} minutes
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDateTime({
  selectedDate,
  onSelectDate,
  slots,
  loading,
  selectedSlot,
  onSelectSlot,
}: {
  selectedDate: Date | undefined;
  onSelectDate: (d: Date | undefined) => void;
  slots: Slot[];
  loading: boolean;
  selectedSlot: Slot | null;
  onSelectSlot: (s: Slot) => void;
}) {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);

  const availableSlots = slots.filter((s) => s.available);

  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Select Date & Time
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Choose your preferred date and available time slot.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: "#9AA89A" }}>
            Date
          </p>
          <div className="bg-white rounded-xl border border-[#EDE4D3] p-3 overflow-x-auto flex justify-center md:justify-start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onSelectDate}
              disabled={(date) => date < today || date > maxDate}
              className="rounded-md"
            />
          </div>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: "#9AA89A" }}>
            Available Times
          </p>
          {!selectedDate ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed"
              style={{ borderColor: "#EDE4D3", background: "#FCFAF5" }}
            >
              <p className="text-[13px]" style={{ color: "#9AA89A" }}>
                Select a date to see available times
              </p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : availableSlots.length === 0 ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed"
              style={{ borderColor: "#EDE4D3", background: "#FCFAF5" }}
            >
              <p className="text-[13px]" style={{ color: "#6B7A6F" }}>
                No available slots for this date
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.slot_time}
                  onClick={() => onSelectSlot(slot)}
                  className={`flex items-center justify-center rounded-lg py-2.5 px-2 text-[12px] font-medium transition-all duration-300 ${
                    selectedSlot?.slot_time === slot.slot_time
                      ? "bg-[#163A2B] text-[#C8A96B] shadow-md"
                      : "bg-white text-[#163A2B] border border-[#EDE4D3] hover:border-[#C8A96B]/50"
                  }`}
                >
                  {formatTime(slot.slot_time)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDetails({
  form,
  onChange,
  error,
  bookingType,
  onChangeType,
}: {
  form: { fullName: string; phone: string; email: string; notes: string };
  onChange: (f: typeof form) => void;
  error: string;
  bookingType: "online" | "home_service";
  onChangeType: (t: "online" | "home_service") => void;
}) {
  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Your Details
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Please provide your contact information to complete the booking.
      </p>

      {/* Booking type */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => onChangeType("online")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-medium transition-all ${
            bookingType === "online"
              ? "border-[#C8A96B] bg-[#C8A96B]/5 text-[#163A2B]"
              : "border-[#EDE4D3] bg-white text-[#6B7A6F] hover:border-[#C8A96B]/30"
          }`}
        >
          <Building className="h-4 w-4" />
          In-Spa
        </button>
        <button
          onClick={() => onChangeType("home_service")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-medium transition-all ${
            bookingType === "home_service"
              ? "border-[#C8A96B] bg-[#C8A96B]/5 text-[#163A2B]"
              : "border-[#EDE4D3] bg-white text-[#6B7A6F] hover:border-[#C8A96B]/30"
          }`}
        >
          <Home className="h-4 w-4" />
          Home Service
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#9AA89A" }}>
            <User className="h-3.5 w-3.5" />
            Full Name *
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => onChange({ ...form, fullName: e.target.value })}
            placeholder="Enter your full name"
            className="w-full rounded-xl border border-[#EDE4D3] bg-white px-4 py-3 text-[14px] text-[#163A2B] placeholder:text-[#9AA89A] outline-none transition-all focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/20"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#9AA89A" }}>
            <Phone className="h-3.5 w-3.5" />
            Phone Number *
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value })}
            placeholder="e.g. 0917 123 4567"
            className="w-full rounded-xl border border-[#EDE4D3] bg-white px-4 py-3 text-[14px] text-[#163A2B] placeholder:text-[#9AA89A] outline-none transition-all focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/20"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#9AA89A" }}>
            <Mail className="h-3.5 w-3.5" />
            Email <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="your@email.com"
            className="w-full rounded-xl border border-[#EDE4D3] bg-white px-4 py-3 text-[14px] text-[#163A2B] placeholder:text-[#9AA89A] outline-none transition-all focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/20"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#9AA89A" }}>
            <FileText className="h-3.5 w-3.5" />
            Notes <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            placeholder="Any special requests or health considerations..."
            rows={3}
            className="w-full rounded-xl border border-[#EDE4D3] bg-white px-4 py-3 text-[14px] text-[#163A2B] placeholder:text-[#9AA89A] outline-none transition-all focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/20 resize-none"
          />
        </div>
      </div>

      {error && (
        <p className="mt-5 text-[13px] font-medium text-red-600 bg-red-50 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
    </div>
  );
}

function StepSuccess({ bookingId }: { bookingId: string }) {
  return (
    <div className="text-center py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#163A2B] text-[#C8A96B] mx-auto mb-6">
        <Check className="h-10 w-10" />
      </div>
      <h2
        className="text-2xl sm:text-3xl font-medium mb-3"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Booking Confirmed
      </h2>
      <p className="text-[15px] max-w-md mx-auto mb-8" style={{ color: "#6B7A6F" }}>
        Thank you for choosing Cradle Massage & Wellness Spa. Your appointment has been confirmed and
        our team looks forward to welcoming you.
      </p>
      <div
        className="inline-flex items-center gap-3 rounded-xl px-6 py-4 mb-8"
        style={{ background: "#FCFAF5", border: "1px solid #EDE4D3" }}
      >
        <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "#9AA89A" }}>
          Booking ID
        </span>
        <span className="text-[14px] font-semibold font-mono" style={{ color: "#163A2B" }}>
          {bookingId.slice(0, 8).toUpperCase()}
        </span>
      </div>
      <p className="text-[12px]" style={{ color: "#9AA89A" }}>
        A confirmation has been sent to our front desk. If you need to make any changes, please call us directly.
      </p>
    </div>
  );
}
