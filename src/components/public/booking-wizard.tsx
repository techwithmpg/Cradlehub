"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Plus,
  Minus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createOnlineBookingMultiAction } from "@/lib/actions/online-booking";
import { createInhouseBookingMultiAction } from "@/lib/actions/inhouse-booking";
import {
  VISIT_TYPE_OPTIONS,
  VISIT_TYPE_ORDER,
  filterSlotsByVisitType,
  getBookingTypeForVisitType,
  getVisitTypeForBookingType,
  isTimeAllowedForVisitType,
  type BookingType,
  type BookingWizardMode,
  type VisitType,
} from "@/lib/bookings/visit-type-availability";

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

type StaffOption = {
  staff_id: string;
  staff_name: string;
  staff_tier: string;
};

type InitialCustomer = {
  fullName: string;
  phone: string;
  email: string | null;
};

const STEPS = [
  { id: 1, label: "Branch" },
  { id: 2, label: "Visit Type" },
  { id: 3, label: "Services" },
  { id: 4, label: "Date & Time" },
  { id: 5, label: "Therapist" },
  { id: 6, label: "Details" },
];

const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
const TIER_LABEL: Record<string, string> = { senior: "Senior", mid: "Mid-Level", junior: "Junior" };

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

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Collapse multiple per-staff rows to one entry per slot_time.
// Prefers an available row over an unavailable one.
function normalizePublicSlots(rawSlots: Slot[]): Slot[] {
  const byTime = new Map<string, Slot>();
  for (const slot of rawSlots) {
    const existing = byTime.get(slot.slot_time);
    if (!existing) {
      byTime.set(slot.slot_time, slot);
      continue;
    }
    if (!existing.available && slot.available) {
      byTime.set(slot.slot_time, slot);
    }
  }
  return Array.from(byTime.values()).sort((a, b) =>
    a.slot_time.localeCompare(b.slot_time)
  );
}

// Unique available therapists at a specific slot_time, sorted by tier then name.
function staffAtSlot(rawSlots: Slot[], slotTime: string): StaffOption[] {
  const seen = new Set<string>();
  const out: StaffOption[] = [];
  for (const s of rawSlots) {
    if (!s.available) continue;
    if (!s.slot_time.startsWith(slotTime.substring(0, 5))) continue;
    if (seen.has(s.staff_id)) continue;
    seen.add(s.staff_id);
    out.push({ staff_id: s.staff_id, staff_name: s.staff_name, staff_tier: s.staff_tier });
  }
  out.sort((a, b) => {
    const td = (TIER_ORDER[a.staff_tier] ?? 9) - (TIER_ORDER[b.staff_tier] ?? 9);
    return td !== 0 ? td : a.staff_name.localeCompare(b.staff_name);
  });
  return out;
}

export function BookingWizard({
  mode = "public",
  initialBranchId = null,
  initialCustomer = null,
}: {
  mode?: BookingWizardMode;
  initialBranchId?: string | null;
  initialCustomer?: InitialCustomer | null;
} = {}) {
  const [step, setStep] = useState(1);

  // Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rawSlots, setRawSlots] = useState<Slot[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  // Loading
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ bookingId: string } | null>(null);

  // Selections
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<"auto" | string>("auto");
  const [bookingType, setBookingType] = useState<BookingType>(
    getBookingTypeForVisitType("in_spa", mode)
  );

  // Form
  const [form, setForm] = useState({
    fullName: initialCustomer?.fullName ?? "",
    phone: initialCustomer?.phone ?? "",
    email: initialCustomer?.email ?? "",
    notes: "",
  });
  const [formError, setFormError] = useState("");

  // Computed
  const totalDuration = useMemo(
    () => selectedServices.reduce((s, svc) => s + svc.durationMinutes, 0),
    [selectedServices]
  );
  const totalPrice = useMemo(
    () => selectedServices.reduce((s, svc) => s + svc.price, 0),
    [selectedServices]
  );
  const visitType = useMemo(
    () => getVisitTypeForBookingType(bookingType, mode),
    [bookingType, mode]
  );
  const availableStaffAtSlot = useMemo(
    () => (selectedSlot ? staffAtSlot(rawSlots, selectedSlot.slot_time) : []),
    [rawSlots, selectedSlot]
  );

  // Fetch branches on mount
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        const nextBranches = (data.branches ?? []) as Branch[];
        setBranches(nextBranches);
        if (mode === "inhouse") {
          const preferredBranch =
            (initialBranchId
              ? nextBranches.find((branch) => branch.id === initialBranchId)
              : null) ?? nextBranches[0] ?? null;
          setSelectedBranch(preferredBranch);
        }
        setLoadingBranches(false);
      })
      .catch(() => setLoadingBranches(false));
  }, [initialBranchId, mode]);

  // Fetch services when branch changes
  useEffect(() => {
    if (!selectedBranch) return;
    const id = setTimeout(() => setLoadingServices(true), 0);
    fetch(`/api/public/booking-context?branchId=${selectedBranch.id}`)
      .then((r) => r.json())
      .then((data) => {
        const svcs = (data.services ?? []).map(
          (s: { serviceId?: string; id?: string; name: string; description?: string | null; durationMinutes: number; price: number }) => ({
            id: s.serviceId ?? s.id ?? "",
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            price: s.price,
          })
        );
        setServices(svcs);
        setLoadingServices(false);
      })
      .catch(() => setLoadingServices(false));
    return () => clearTimeout(id);
  }, [selectedBranch]);

  // Fetch slots when branch + services + date are all selected
  useEffect(() => {
    if (!selectedBranch || selectedServices.length === 0 || !selectedDate) return;
    const id = setTimeout(() => setLoadingSlots(true), 0);
    const dateStr = toLocalYmd(selectedDate);
    const serviceIds = selectedServices.map((s) => s.id).join(",");
    fetch(
      `/api/booking/available-slots?branchId=${selectedBranch.id}&serviceIds=${serviceIds}&date=${dateStr}`
    )
      .then((r) => r.json())
      .then((data) => {
        const all = (data.slots ?? []) as Slot[];
        const visitTypeSlots = filterSlotsByVisitType(all, visitType);
        setRawSlots(visitTypeSlots);
        setSlots(normalizePublicSlots(visitTypeSlots));
        setLoadingSlots(false);
      })
      .catch(() => setLoadingSlots(false));
    return () => clearTimeout(id);
  }, [selectedBranch, selectedServices, selectedDate, visitType]);

  const toggleService = useCallback((svc: Service) => {
    setSelectedServices((prev) => {
      const idx = prev.findIndex((s) => s.id === svc.id);
      return idx >= 0
        ? [...prev.slice(0, idx), ...prev.slice(idx + 1)]
        : [...prev, svc];
    });
    // Downstream state depends on service selection
    setSelectedSlot(null);
    setSelectedStaff("auto");
  }, []);

  const handleVisitTypeSelect = useCallback((nextVisitType: VisitType) => {
    setBookingType(getBookingTypeForVisitType(nextVisitType, mode));
    setRawSlots([]);
    setSlots([]);
    setSelectedSlot(null);
    setSelectedStaff("auto");
  }, [mode]);

  const handleBack = useCallback(() => {
    if (step === 4) {
      setSelectedSlot(null);
      setSelectedStaff("auto");
    } else if (step === 5) {
      setSelectedStaff("auto");
    }
    setStep((s) => Math.max(1, s - 1));
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (!selectedBranch || selectedServices.length === 0 || !selectedDate || !selectedSlot) return;
    if (!isTimeAllowedForVisitType(selectedSlot.slot_time, visitType)) {
      const option = VISIT_TYPE_OPTIONS[visitType];
      const message = `${option.label} appointments are available from ${formatTime(option.availability.startTime)} to ${formatTime(option.availability.endTime)}. Please select another time.`;
      toast.error("Time unavailable", { description: message });
      setFormError(message);
      setStep(4);
      return;
    }
    if (!form.fullName.trim() || !form.phone.trim()) {
      setFormError("Please enter your full name and phone number.");
      return;
    }
    setFormError("");
    setSubmitting(true);

    const payload = {
      branchId: selectedBranch.id,
      serviceIds: selectedServices.map((s) => s.id),
      staffId: selectedStaff !== "auto" ? selectedStaff : undefined,
      date: toLocalYmd(selectedDate),
      startTime: selectedSlot.slot_time,
      fullName: form.fullName,
      phone: form.phone,
      email: form.email || undefined,
      notes: form.notes || undefined,
    };

    const result =
      mode === "inhouse"
        ? await createInhouseBookingMultiAction({
            ...payload,
            type: getBookingTypeForVisitType(visitType, "inhouse"),
          })
        : await createOnlineBookingMultiAction({
            ...payload,
            type: getBookingTypeForVisitType(visitType, "public"),
          });

    setSubmitting(false);
    if (result.ok) {
      toast.success(mode === "inhouse" ? "Booking saved" : "Booking confirmed!", {
        description: mode === "inhouse"
          ? "Appointment saved to the CRM workspace."
          : "We look forward to welcoming you at Cradle.",
      });
      setSuccess({ bookingId: result.bookingId });
      setStep(7);
    } else {
      toast.error("Booking failed", { description: result.message });
      setFormError(result.message);
    }
  }, [selectedBranch, selectedServices, selectedDate, selectedSlot, visitType, selectedStaff, form, mode]);

  const canProceed =
    step === 1 ? !!selectedBranch
    : step === 2 ? !!bookingType
    : step === 3 ? selectedServices.length > 0
    : step === 4 ? !!selectedSlot
    : step === 5 ? true // "auto" is always valid; server validates on submit
    : step === 6 ? form.fullName.trim().length >= 2 && form.phone.trim().length >= 7
    : false;

  return (
    <div className={mode === "public" ? "min-h-screen" : ""} style={{ background: mode === "public" ? "#F7F3EB" : "transparent" }}>
      {mode === "public" && (
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
      )}

      <div className={mode === "public" ? "mx-auto max-w-5xl px-6 py-10 lg:py-14" : "mx-auto max-w-6xl py-2"}>
        {/* Stepper */}
        {step < 7 && (
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-0.5 sm:gap-2">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-0.5 sm:gap-2">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-[11px] sm:text-[12px] font-semibold transition-all duration-300 ${
                        step > s.id
                          ? "bg-[#163A2B] text-[#C8A96B]"
                          : step === s.id
                          ? "bg-[#C8A96B] text-[#10261D]"
                          : "bg-white text-[#9AA89A] border border-[#EDE4D3]"
                      }`}
                    >
                      {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
                    </div>
                    <span
                      className={`hidden sm:block text-[10px] mt-1.5 font-medium ${
                        step >= s.id ? "text-[#163A2B]" : "text-[#9AA89A]"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-4 sm:w-8 lg:w-12 h-0.5 rounded-full mb-4 sm:mb-3 transition-colors duration-300 ${
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
                  setSelectedServices([]);
                  setSelectedSlot(null);
                  setSelectedStaff("auto");
                }}
              />
            )}
            {step === 2 && (
              <StepVisitType
                selected={visitType}
                onSelect={handleVisitTypeSelect}
              />
            )}
            {step === 3 && (
              <StepServices
                services={services}
                loading={loadingServices}
                selected={selectedServices}
                onToggle={toggleService}
                totalDuration={totalDuration}
                totalPrice={totalPrice}
              />
            )}
            {step === 4 && (
              <StepDateTime
                visitType={visitType}
                selectedDate={selectedDate}
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  setSelectedSlot(null);
                  setSelectedStaff("auto");
                }}
                slots={slots}
                loading={loadingSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={(s) => {
                  setSelectedSlot(s);
                  setSelectedStaff("auto");
                }}
              />
            )}
            {step === 5 && (
              <StepTherapist
                availableStaff={availableStaffAtSlot}
                selected={selectedStaff}
                onSelect={setSelectedStaff}
              />
            )}
            {step === 6 && (
              <StepDetails
                form={form}
                onChange={setForm}
                error={formError}
                visitType={visitType}
              />
            )}
            {step === 7 && success && (
              <StepSuccess bookingId={success.bookingId} services={selectedServices} mode={mode} />
            )}

            {/* Navigation */}
            {step < 7 && (
              <div className="flex items-center justify-between mt-10 pt-8 border-t border-[#EDE4D3]">
                <button
                  onClick={handleBack}
                  disabled={step === 1}
                  className="flex items-center gap-2 text-[13px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#163A2B]"
                  style={{ color: "#6B7A6F" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                {step < 6 ? (
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
          {step < 7 && (
            <div className="hidden lg:block">
              <BookingSummary
                branch={selectedBranch}
                services={selectedServices}
                totalDuration={totalDuration}
                totalPrice={totalPrice}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                selectedStaff={selectedStaff}
                availableStaff={availableStaffAtSlot}
                visitType={visitType}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared helper ──────────────────────────────────────────────────────────────

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

// ── Booking summary sidebar ────────────────────────────────────────────────────

function BookingSummary({
  branch,
  services,
  totalDuration,
  totalPrice,
  selectedDate,
  selectedSlot,
  selectedStaff,
  availableStaff,
  visitType,
}: {
  branch: Branch | null;
  services: Service[];
  totalDuration: number;
  totalPrice: number;
  selectedDate: Date | undefined;
  selectedSlot: Slot | null;
  selectedStaff: "auto" | string;
  availableStaff: StaffOption[];
  visitType: VisitType;
}) {
  const staffLabel =
    selectedStaff === "auto"
      ? "Auto-assign"
      : availableStaff.find((s) => s.staff_id === selectedStaff)?.staff_name;
  const visitOption = VISIT_TYPE_OPTIONS[visitType];

  return (
    <div
      className="sticky top-28 rounded-2xl p-6 border"
      style={{ background: "#FCFAF5", borderColor: "#EDE4D3" }}
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
          value={branch?.name}
          placeholder="Not selected"
        />
        <SummaryRow
          icon={visitType === "home_service" ? Home : Building}
          label="Visit Type"
          value={visitOption.label}
          sub={`${formatTime(visitOption.availability.startTime)} - ${formatTime(visitOption.availability.endTime)}`}
        />

        {/* Services list */}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#163A2B]/5 shrink-0">
            <Clock className="h-4 w-4 text-[#163A2B]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "#9AA89A" }}>
              Services
            </p>
            {services.length === 0 ? (
              <p className="text-[13px] font-medium mt-0.5" style={{ color: "#9AA89A" }}>
                Not selected
              </p>
            ) : (
              <>
                {services.map((s) => (
                  <p key={s.id} className="text-[13px] font-medium mt-0.5" style={{ color: "#163A2B" }}>
                    {s.name}
                  </p>
                ))}
                <p className="text-[11px] mt-1.5 font-medium" style={{ color: "#C8A96B" }}>
                  {totalDuration} min · {formatCurrency(totalPrice)}
                </p>
              </>
            )}
          </div>
        </div>

        <SummaryRow
          icon={CalendarDays}
          label="Date & Time"
          value={
            selectedDate && selectedSlot
              ? `${selectedDate.toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })} at ${formatTime(selectedSlot.slot_time)}`
              : undefined
          }
          placeholder="Not selected"
        />
        <SummaryRow
          icon={User}
          label="Therapist"
          value={staffLabel}
          placeholder="Not selected"
        />
      </div>
    </div>
  );
}

// ── Step 1: Branch ─────────────────────────────────────────────────────────────

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
                selected?.id === branch.id
                  ? "bg-[#163A2B] text-[#C8A96B]"
                  : "bg-[#163A2B]/5 text-[#163A2B]"
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

// ── Step 2: Visit Type ─────────────────────────────────────────────────────────

function StepVisitType({
  selected,
  onSelect,
}: {
  selected: VisitType;
  onSelect: (visitType: VisitType) => void;
}) {
  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Choose Visit Type
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Select how you would like to receive your treatment.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {VISIT_TYPE_ORDER.map((visitType) => {
          const option = VISIT_TYPE_OPTIONS[visitType];
          const isSelected = selected === visitType;
          const Icon = visitType === "home_service" ? Home : Building;

          return (
            <button
              key={visitType}
              type="button"
              onClick={() => onSelect(visitType)}
              className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-300 ${
                isSelected
                  ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
                  : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                  isSelected
                    ? "bg-[#163A2B] text-[#C8A96B]"
                    : "bg-[#163A2B]/5 text-[#163A2B]"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold" style={{ color: "#163A2B" }}>
                    {option.label}
                  </p>
                  {isSelected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#163A2B] shrink-0">
                      <Check className="h-3.5 w-3.5 text-[#C8A96B]" />
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-1" style={{ color: "#6B7A6F" }}>
                  {option.description}
                </p>
                <p className="text-[11px] mt-3 font-medium" style={{ color: "#C8A96B" }}>
                  {formatTime(option.availability.startTime)} - {formatTime(option.availability.endTime)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Services (multi-select) ────────────────────────────────────────────

function StepServices({
  services,
  loading,
  selected,
  onToggle,
  totalDuration,
  totalPrice,
}: {
  services: Service[];
  loading: boolean;
  selected: Service[];
  onToggle: (s: Service) => void;
  totalDuration: number;
  totalPrice: number;
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

  const selectedIds = new Set(selected.map((s) => s.id));

  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Choose Your Services
      </h2>
      <p className="text-[14px] mb-6" style={{ color: "#6B7A6F" }}>
        Select one or more treatments. They will be performed consecutively by the same therapist.
      </p>

      <div className="flex flex-col gap-3">
        {services.map((service) => {
          const isSelected = selectedIds.has(service.id);
          return (
            <button
              key={service.id}
              onClick={() => onToggle(service)}
              className={`flex items-center gap-5 p-5 rounded-xl border text-left transition-all duration-300 ${
                isSelected
                  ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
                  : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
              }`}
            >
              {/* Checkbox indicator */}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0 transition-all ${
                  isSelected
                    ? "bg-[#163A2B] border-[#163A2B]"
                    : "border-[#D5C9BB] bg-white"
                }`}
              >
                {isSelected && <Check className="h-3.5 w-3.5 text-[#C8A96B]" />}
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

              {/* Toggle icon */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-all ${
                  isSelected
                    ? "bg-[#163A2B]/10 text-[#163A2B]"
                    : "bg-[#163A2B]/5 text-[#9AA89A]"
                }`}
              >
                {isSelected ? (
                  <Minus className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Running total */}
      {selected.length > 0 && (
        <div
          className="mt-6 flex items-center justify-between rounded-xl px-5 py-4"
          style={{ background: "#163A2B" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(247,243,235,0.5)" }}>
              {selected.length} {selected.length === 1 ? "service" : "services"} selected
            </p>
            <p className="text-[13px] font-medium mt-0.5" style={{ color: "#FCFAF5" }}>
              {totalDuration} min total
            </p>
          </div>
          <p className="text-[20px] font-semibold" style={{ color: "#C8A96B" }}>
            {formatCurrency(totalPrice)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Date & Time ────────────────────────────────────────────────────────

function StepDateTime({
  visitType,
  selectedDate,
  onSelectDate,
  slots,
  loading,
  selectedSlot,
  onSelectSlot,
}: {
  visitType: VisitType;
  selectedDate: Date | undefined;
  onSelectDate: (d: Date | undefined) => void;
  slots: Slot[];
  loading: boolean;
  selectedSlot: Slot | null;
  onSelectSlot: (s: Slot) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  const availableSlots = slots.filter((s) => s.available);
  const isTodaySelected =
    !!selectedDate && toLocalYmd(selectedDate) === toLocalYmd(new Date());
  const visitOption = VISIT_TYPE_OPTIONS[visitType];

  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Select Date & Time
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Choose your preferred date and an available start time.
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
              disabled={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                return d < today || d > maxDate;
              }}
              className="rounded-md"
            />
          </div>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: "#9AA89A" }}>
            Available Times
          </p>
          <p className="text-[12px] mb-3" style={{ color: "#6B7A6F" }}>
            {visitOption.label}: {formatTime(visitOption.availability.startTime)} - {formatTime(visitOption.availability.endTime)}
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
                {isTodaySelected
                  ? "No more available slots today. Please choose another date."
                  : `No available ${visitOption.label.toLowerCase()} slots for this date`}
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

// ── Step 5: Therapist ─────────────────────────────────────────────────────────

function StepTherapist({
  availableStaff,
  selected,
  onSelect,
}: {
  availableStaff: StaffOption[];
  selected: "auto" | string;
  onSelect: (choice: "auto" | string) => void;
}) {
  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Choose Your Therapist
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Pick a preferred therapist or let us match you with the best available.
      </p>

      <div className="flex flex-col gap-3">
        {/* Auto-assign option */}
        <button
          onClick={() => onSelect("auto")}
          className={`flex items-center gap-4 p-5 rounded-xl border text-left transition-all duration-300 ${
            selected === "auto"
              ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
              : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
          }`}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
              selected === "auto" ? "bg-[#163A2B] text-[#C8A96B]" : "bg-[#163A2B]/5 text-[#163A2B]"
            }`}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold" style={{ color: "#163A2B" }}>
                Auto-assign
              </p>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "#163A2B", color: "#C8A96B" }}
              >
                Recommended
              </span>
            </div>
            <p className="text-[12px] mt-1" style={{ color: "#6B7A6F" }}>
              We will assign the best available therapist by seniority.
            </p>
          </div>
          {selected === "auto" && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#163A2B] shrink-0">
              <Check className="h-3.5 w-3.5 text-[#C8A96B]" />
            </div>
          )}
        </button>

        {/* Individual therapist options */}
        {availableStaff.length > 0 && (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide pt-2" style={{ color: "#9AA89A" }}>
              Or choose a specific therapist
            </p>
            {availableStaff.map((staff) => (
              <button
                key={staff.staff_id}
                onClick={() => onSelect(staff.staff_id)}
                className={`flex items-center gap-4 p-5 rounded-xl border text-left transition-all duration-300 ${
                  selected === staff.staff_id
                    ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
                    : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                    selected === staff.staff_id
                      ? "bg-[#163A2B] text-[#C8A96B]"
                      : "bg-[#163A2B]/5 text-[#163A2B]"
                  }`}
                >
                  <User className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold" style={{ color: "#163A2B" }}>
                      {staff.staff_name}
                    </p>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={
                        staff.staff_tier === "senior"
                          ? { background: "#C8A96B20", color: "#8A6B35" }
                          : staff.staff_tier === "mid"
                          ? { background: "#163A2B15", color: "#163A2B" }
                          : { background: "#F0ECE5", color: "#6B7A6F" }
                      }
                    >
                      {TIER_LABEL[staff.staff_tier] ?? staff.staff_tier}
                    </span>
                  </div>
                  <p className="text-[12px] mt-1" style={{ color: "#9AA89A" }}>
                    Available at your selected time
                  </p>
                </div>
                {selected === staff.staff_id && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#163A2B] shrink-0">
                    <Check className="h-3.5 w-3.5 text-[#C8A96B]" />
                  </div>
                )}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Step 6: Details ────────────────────────────────────────────────────────────

function StepDetails({
  form,
  onChange,
  error,
  visitType,
}: {
  form: { fullName: string; phone: string; email: string; notes: string };
  onChange: (f: typeof form) => void;
  error: string;
  visitType: VisitType;
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

      <div className="flex flex-col gap-5">
        <div>
          <label
            className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "#9AA89A" }}
          >
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
          <label
            className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "#9AA89A" }}
          >
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
          <label
            className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "#9AA89A" }}
          >
            <Mail className="h-3.5 w-3.5" />
            Email{" "}
            <span className="normal-case font-normal">(optional)</span>
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
          <label
            className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "#9AA89A" }}
          >
            <FileText className="h-3.5 w-3.5" />
            Notes{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            placeholder={
              visitType === "home_service"
                ? "Address and any special instructions..."
                : "Any special requests or health considerations..."
            }
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

// ── Step 7: Success ────────────────────────────────────────────────────────────

function StepSuccess({
  bookingId,
  services,
  mode,
}: {
  bookingId: string;
  services: Service[];
  mode: BookingWizardMode;
}) {
  return (
    <div className="text-center py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#163A2B] text-[#C8A96B] mx-auto mb-6">
        <Check className="h-10 w-10" />
      </div>
      <h2
        className="text-2xl sm:text-3xl font-medium mb-3"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        {mode === "inhouse" ? "Booking Saved" : "Booking Received"}
      </h2>
      <p className="text-[15px] max-w-md mx-auto mb-6" style={{ color: "#6B7A6F" }}>
        {mode === "inhouse"
          ? "The appointment has been saved and confirmed in the CRM workspace."
          : "Thank you for choosing Cradle Massage & Wellness Spa. Your appointment request has been received and our team will contact you shortly to confirm."}
      </p>

      {/* Service list recap */}
      {services.length > 0 && (
        <div
          className="inline-flex flex-col items-start gap-1.5 rounded-xl px-6 py-4 mb-6 text-left"
          style={{ background: "#FCFAF5", border: "1px solid #EDE4D3" }}
        >
          {services.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#C8A96B" }} />
              <span className="text-[13px] font-medium" style={{ color: "#163A2B" }}>
                {s.name}
              </span>
            </div>
          ))}
        </div>
      )}

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
        {mode === "inhouse"
          ? "You can view or adjust this booking anytime from the bookings workspace."
          : "A confirmation has been sent to our front desk. If you need to make any changes, please call us directly."}
      </p>
    </div>
  );
}
