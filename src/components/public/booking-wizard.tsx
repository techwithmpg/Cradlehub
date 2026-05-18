"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import Image from "next/image";
import Link from "next/link";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookingServicePicker,
  type BookingWizardService,
} from "@/components/public/booking-service-picker";
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
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createOnlineBookingMultiAction } from "@/lib/actions/online-booking";
import { createInhouseBookingMultiAction } from "@/lib/actions/inhouse-booking";
import {
  PlacesAutocomplete,
  type GoogleAddressComponent,
  type PlaceSelectResult,
  type PlacesAutocompleteStatus,
} from "@/components/public/places-autocomplete";
import {
  getSlotDispatchStatus,
  type ExistingHsBooking,
  type SlotDispatchStatus,
} from "@/lib/bookings/dispatch-slot-filter";
import {
  VISIT_TYPE_OPTIONS,
  VISIT_TYPE_ORDER,
  filterSlotsByVisitType,
  getBookingTypeForVisitType,
  getVisitTypeForBookingType,
  getVisitTypeAvailability,
  isVisitTypeEnabled,
  isTimeAllowedForVisitType,
  type BookingType,
  type BookingWizardMode,
  type VisitType,
} from "@/lib/bookings/visit-type-availability";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
};

type Service = BookingWizardService;

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
  staff_full_name?: string | null;
  staff_nickname?: string | null;
  staff_avatar_url?: string | null;
  staff_tier: string;
  staff_type?: string;
};

type StaffLookup = {
  name: string | null;
  fullName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  staffType: string | null;
  serviceIds: string[];
  isServiceProvider: boolean;
};

type BookingContextService = {
  serviceId?: string;
  id?: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  categoryId?: string | null;
  categoryName?: string | null;
  categorySortOrder?: number | null;
  availableInSpa?: boolean;
  availableHomeService?: boolean;
};

type BookingContextStaff = {
  id: string;
  name?: string | null;
  fullName?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  staffType?: string | null;
  serviceIds?: string[];
};

type BookingContextServiceEligibility = {
  serviceId: string;
  hasStaffMappings: boolean;
};

type InitialCustomer = {
  fullName: string;
  phone: string;
  email: string | null;
};

const STEPS_BASE = [
  { id: 1, name: "branch",    label: "Branch" },
  { id: 2, name: "visit",     label: "Visit Type" },
  { id: 3, name: "services",  label: "Services" },
  { id: 4, name: "date_time", label: "Date & Time" },
  { id: 5, name: "therapist", label: "Therapist" },
  { id: 6, name: "details",   label: "Details" },
];

const STEPS_HS = [
  { id: 1, name: "branch",    label: "Branch" },
  { id: 2, name: "visit",     label: "Visit Type" },
  { id: 3, name: "services",  label: "Services" },
  { id: 4, name: "location",  label: "Location" },
  { id: 5, name: "date_time", label: "Date & Time" },
  { id: 6, name: "therapist", label: "Therapist" },
  { id: 7, name: "details",   label: "Details" },
];

const MOBILE_PROGRESS_STEPS = ["Branch", "Service", "Date & Time", "Details", "Confirm"] as const;
const PRECISE_LOCATION_ERROR =
  "Please select your address from the Google suggestions so our therapist and driver can find you accurately.";

function getSteps(isHomeService: boolean) {
  return isHomeService ? STEPS_HS : STEPS_BASE;
}

function getStepName(stepNum: number, isHomeService: boolean): string {
  return (getSteps(isHomeService).find((s) => s.id === stepNum)?.name) ?? "branch";
}

function getMobileProgressIndex(stepName: string) {
  if (stepName === "branch") return 0;
  if (stepName === "date_time") return 2;
  if (stepName === "details" || stepName === "therapist") return 3;
  if (stepName === "success") return 4;
  return 1;
}

const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
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

function staffCanPerformSelectedServices(
  lookup: StaffLookup | undefined,
  selectedServiceIds: string[],
  serviceIdsWithStaffMappings: Set<string>
): boolean {
  // The availability API already filters the returned slot rows to service-capable
  // providers. The booking-context lookup is only enrichment for display.
  if (!lookup) return true;
  if (!lookup.isServiceProvider) return false;
  if (selectedServiceIds.length === 0) return false;

  const constrainedServiceIds = selectedServiceIds.filter((serviceId) =>
    serviceIdsWithStaffMappings.has(serviceId)
  );

  if (constrainedServiceIds.length === 0) return true;
  if (lookup.serviceIds.length === 0) return true;

  return constrainedServiceIds.every((serviceId) =>
    lookup.serviceIds.includes(serviceId)
  );
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
// Tier is used internally for seniority sorting but never displayed to customers.
function staffAtSlot(
  rawSlots: Slot[],
  slotTime: string,
  staffLookup: Map<string, StaffLookup>,
  selectedServiceIds: string[],
  serviceIdsWithStaffMappings: Set<string>
): StaffOption[] {
  const seen = new Set<string>();
  const out: StaffOption[] = [];
  for (const s of rawSlots) {
    if (!s.available) continue;
    if (!s.slot_time.startsWith(slotTime.substring(0, 5))) continue;
    if (seen.has(s.staff_id)) continue;
    const lookup = staffLookup.get(s.staff_id);
    if (!staffCanPerformSelectedServices(lookup, selectedServiceIds, serviceIdsWithStaffMappings)) {
      continue;
    }
    seen.add(s.staff_id);
    const displayName = lookup?.nickname ?? lookup?.name ?? s.staff_name;
    out.push({
      staff_id: s.staff_id,
      staff_name: displayName,
      staff_full_name: lookup?.fullName ?? s.staff_name,
      staff_nickname: lookup?.nickname ?? null,
      staff_avatar_url: lookup?.avatarUrl ?? null,
      staff_tier: s.staff_tier,
      staff_type: lookup?.staffType ?? undefined,
    });
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
  const { isOffline } = useNetworkStatus();

  // Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rawSlots, setRawSlots] = useState<Slot[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingRules, setBookingRules] = useState<BranchBookingRules | null>(
    null
  );
  const [staffLookup, setStaffLookup] = useState<Map<string, StaffLookup>>(new Map());
  const [serviceIdsWithStaffMappings, setServiceIdsWithStaffMappings] = useState<Set<string>>(
    new Set()
  );
  const [existingHsBookings, setExistingHsBookings] = useState<ExistingHsBooking[]>([]);
  const [hsDriverCapacity, setHsDriverCapacity] = useState(1);

  // Loading
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ bookingId: string } | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState("");

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
    // Home service address fields
    hsAddress: "",
    hsAddressDetails: "",
    hsBarangay: "",
    hsCity: "",
    hsLandmark: "",
    hsParkingNotes: "",
    hsZone: "",
    // Geocoded from Places Autocomplete (null = not yet geocoded)
    hsLat: null as number | null,
    hsLng: null as number | null,
    hsPlaceId: "",
    hsFormattedAddress: "",
    hsAddressComponents: [] as GoogleAddressComponent[],
    hsMapUrl: "",
    // CRM in-house payment capture (inhouse mode only)
    paymentMethod: "",
    paymentReference: "",
    paymentNote: "",
  });
  const [formError, setFormError] = useState("");
  const [placesStatus, setPlacesStatus] = useState<PlacesAutocompleteStatus>("idle");

  // Computed
  const totalDuration = useMemo(
    () => selectedServices.reduce((s, svc) => s + svc.durationMinutes, 0),
    [selectedServices]
  );
  const totalPrice = useMemo(
    () => selectedServices.reduce((s, svc) => s + svc.price, 0),
    [selectedServices]
  );
  const selectedServiceIds = useMemo(
    () => selectedServices.map((service) => service.id),
    [selectedServices]
  );
  const selectedVisitType = useMemo(
    () => getVisitTypeForBookingType(bookingType, mode),
    [bookingType, mode]
  );
  const visitType = useMemo(
    () =>
      isVisitTypeEnabled(selectedVisitType, bookingRules)
        ? selectedVisitType
        : "in_spa",
    [bookingRules, selectedVisitType]
  );
  const isHomeService = visitType === "home_service";
  const steps = useMemo(() => getSteps(isHomeService), [isHomeService]);
  const currentStepName = useMemo(() => getStepName(step, isHomeService), [step, isHomeService]);
  const successStep = isHomeService ? 8 : 7;

  // Services filtered by visit type eligibility
  const eligibleServices = useMemo(
    () =>
      services.filter((svc) =>
        isHomeService
          ? (svc.availableHomeService ?? false)
          : (svc.availableInSpa ?? true)
      ),
    [services, isHomeService]
  );
  const availableStaffAtSlot = useMemo(
    () =>
      selectedSlot
        ? staffAtSlot(
            rawSlots,
            selectedSlot.slot_time,
            staffLookup,
            selectedServiceIds,
            serviceIdsWithStaffMappings
          )
        : [],
    [rawSlots, selectedSlot, selectedServiceIds, serviceIdsWithStaffMappings, staffLookup]
  );
  const selectedStaffForBooking = useMemo(
    () => {
      // "prefer-auto" — user explicitly clicked "Use any available provider instead"
      // when only one provider was available. Honour their choice even though one
      // specific provider exists.
      if (selectedStaff === "prefer-auto") return "auto";
      // Specific provider chosen — validate they are still available at this slot.
      if (selectedStaff !== "auto") {
        return availableStaffAtSlot.some((s) => s.staff_id === selectedStaff)
          ? selectedStaff
          : "auto";
      }
      // Default "auto" (no explicit selection yet) — if there is exactly one
      // qualified provider, wire them in so the booking is assigned to them.
      if (availableStaffAtSlot.length === 1) {
        return availableStaffAtSlot[0]!.staff_id;
      }
      return "auto";
    },
    [availableStaffAtSlot, selectedStaff]
  );

  // Dispatch status per slot_time (home_service only)
  const dispatchStatuses = useMemo<Map<string, SlotDispatchStatus>>(() => {
    if (!isHomeService) return new Map();
    return new Map(
      slots.map((s) => [
        s.slot_time,
        getSlotDispatchStatus(
          s.slot_time,
          totalDuration,
          existingHsBookings,
          form.hsZone,
          hsDriverCapacity,
        ),
      ])
    );
  }, [isHomeService, slots, totalDuration, existingHsBookings, form.hsZone, hsDriverCapacity]);

  // Public booking: hide hard-conflict HS slots entirely
  const displaySlots = useMemo(() => {
    if (!isHomeService || mode !== "public") return slots;
    return slots.filter((s) => dispatchStatuses.get(s.slot_time) !== "hard");
  }, [isHomeService, mode, slots, dispatchStatuses]);

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
    fetch(`/api/public/booking-context?branchId=${selectedBranch.id}&mode=${mode}`)
      .then((r) => r.json())
      .then((data) => {
        const svcs = (data.services ?? []).map(
          (s: BookingContextService) => ({
            id: s.serviceId ?? s.id ?? "",
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            price: s.price,
            categoryId: s.categoryId ?? null,
            categoryName: s.categoryName ?? "Wellness",
            categorySortOrder: s.categorySortOrder ?? 999,
            availableInSpa: s.availableInSpa ?? true,
            availableHomeService: s.availableHomeService ?? false,
          })
        );
        setServices(svcs);
        // Build a provider lookup from booking-context response for public staff filtering.
        const staffList = (data.staff ?? []) as BookingContextStaff[];
        const nextStaffLookup = new Map<string, StaffLookup>();
        for (const member of staffList) {
          nextStaffLookup.set(member.id, {
            name: member.name ?? member.fullName ?? null,
            fullName: member.fullName ?? member.name ?? null,
            nickname: member.nickname ?? null,
            avatarUrl: member.avatarUrl ?? null,
            staffType: member.staffType ?? null,
            serviceIds: member.serviceIds ?? [],
            isServiceProvider: true,
          });
        }
        const serviceEligibility = (data.serviceEligibility ?? []) as BookingContextServiceEligibility[];
        setStaffLookup(nextStaffLookup);
        setServiceIdsWithStaffMappings(
          new Set(
            serviceEligibility
              .filter((entry) => entry.hasStaffMappings)
              .map((entry) => entry.serviceId)
          )
        );
        setBookingRules((data.bookingRules ?? null) as BranchBookingRules | null);
        setLoadingServices(false);
      })
      .catch(() => {
        setBookingRules(null);
        setStaffLookup(new Map());
        setServiceIdsWithStaffMappings(new Set());
        setLoadingServices(false);
      });
    return () => clearTimeout(id);
  }, [mode, selectedBranch]);

  // Fetch existing HS bookings for dispatch filtering (home_service + date known)
  useEffect(() => {
    if (!isHomeService || !selectedBranch || !selectedDate) return;
    const dateStr = toLocalYmd(selectedDate);
    fetch(`/api/public/dispatch-slots?branchId=${selectedBranch.id}&date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => {
        setExistingHsBookings((data.slots ?? []) as ExistingHsBooking[]);
        if (typeof data.driverCapacity === "number") {
          setHsDriverCapacity(data.driverCapacity);
        }
      })
      .catch(() => { /* non-fatal — dispatch filter degrades to "ok" */ });
  }, [isHomeService, selectedBranch, selectedDate]);

  // Fetch slots when branch + services + date are all selected
  useEffect(() => {
    if (!selectedBranch || selectedServices.length === 0 || !selectedDate) {
      return;
    }
    const id = setTimeout(() => setLoadingSlots(true), 0);
    const dateStr = toLocalYmd(selectedDate);
    const serviceIds = selectedServices.map((s) => s.id).join(",");
    fetch(
      `/api/booking/available-slots?branchId=${selectedBranch.id}&serviceIds=${serviceIds}&date=${dateStr}`
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error ?? "Unable to load branch services.");
        }
        return data;
      })
      .then((data) => {
        const all = (data.slots ?? []) as Slot[];
        const visitTypeSlots = filterSlotsByVisitType(
          all,
          visitType,
          bookingRules
        );
        setRawSlots(visitTypeSlots);
        setSlots(normalizePublicSlots(visitTypeSlots));
        setAvailabilityMessage(data.reason?.message ?? "");
        setLoadingSlots(false);
      })
      .catch(() => {
        setRawSlots([]);
        setSlots([]);
        setAvailabilityMessage("Unable to load branch availability. Please try again.");
        setLoadingSlots(false);
      });
    return () => clearTimeout(id);
  }, [selectedBranch, selectedServices, selectedDate, visitType, bookingRules]);

  const toggleService = useCallback((svc: Service) => {
    setSelectedServices((prev) => {
      const idx = prev.findIndex((s) => s.id === svc.id);
      return idx >= 0
        ? [...prev.slice(0, idx), ...prev.slice(idx + 1)]
        : [...prev, svc];
    });
    // Downstream state depends on service selection
    setRawSlots([]);
    setSlots([]);
    setSelectedSlot(null);
    setSelectedStaff("auto");
    setAvailabilityMessage("");
  }, []);

  const handleVisitTypeSelect = useCallback((nextVisitType: VisitType) => {
    if (!isVisitTypeEnabled(nextVisitType, bookingRules)) return;
    setBookingType(getBookingTypeForVisitType(nextVisitType, mode));
    // Clear services that aren't eligible for the new visit type
    setSelectedServices((prev) =>
      prev.filter((svc) =>
        nextVisitType === "home_service"
          ? (svc.availableHomeService ?? false)
          : (svc.availableInSpa ?? true)
      )
    );
    setRawSlots([]);
    setSlots([]);
    setSelectedSlot(null);
    setSelectedStaff("auto");
    setAvailabilityMessage("");
    setExistingHsBookings([]);
    setHsDriverCapacity(1);
  }, [bookingRules, mode]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const handleBack = useCallback(() => {
    if (currentStepName === "date_time") {
      setSelectedSlot(null);
      setSelectedStaff("auto");
    } else if (currentStepName === "therapist") {
      setSelectedStaff("auto");
    }
    setStep((s) => Math.max(1, s - 1));
  }, [currentStepName]);

  const handleSubmit = useCallback(async () => {
    if (!selectedBranch || selectedServices.length === 0 || !selectedDate || !selectedSlot) return;
    if (isOffline) {
      setFormError("You're offline. Check your connection and try again.");
      return;
    }
    if (!isVisitTypeEnabled(visitType, bookingRules)) {
      const option = VISIT_TYPE_OPTIONS[visitType];
      const message = `${option.label} is not available for this branch. Please choose another visit type.`;
      toast.error("Visit type unavailable", { description: message });
      setFormError(message);
      setStep(2);
      return;
    }
    if (!isTimeAllowedForVisitType(selectedSlot.slot_time, visitType, bookingRules)) {
      const option = VISIT_TYPE_OPTIONS[visitType];
      const availability = getVisitTypeAvailability(visitType, bookingRules);
      const message = `${option.label} appointments are available from ${formatTime(availability.startTime)} to ${formatTime(availability.endTime)}. Please select another time.`;
      toast.error("Time unavailable", { description: message });
      setFormError(message);
      setStep(isHomeService ? 5 : 4);
      return;
    }
    if (!form.fullName.trim() || !form.phone.trim()) {
      setFormError("Please enter your full name and phone number.");
      return;
    }
    if (mode === "public" && isHomeService && !isPreciseHomeServiceLocation(form)) {
      setFormError(PRECISE_LOCATION_ERROR);
      setStep(4);
      return;
    }
    setFormError("");
    setSubmitting(true);

    const hsPayload =
      visitType === "home_service"
        ? {
            homeServiceAddress:          form.hsAddress || undefined,
            homeServiceAddressDetails:   form.hsAddressDetails || undefined,
            homeServiceBarangay:         form.hsBarangay || undefined,
            homeServiceCity:             form.hsCity || undefined,
            homeServiceLandmark:         form.hsLandmark || undefined,
            homeServiceParkingNotes:     form.hsParkingNotes || undefined,
            homeServiceCustomerNotes:    form.hsParkingNotes || undefined,
            homeServiceZone:             form.hsZone || "unknown",
            homeServiceLat:              form.hsLat ?? undefined,
            homeServiceLng:              form.hsLng ?? undefined,
            homeServicePlaceId:          form.hsPlaceId || undefined,
            homeServiceFormattedAddress: form.hsFormattedAddress || undefined,
            homeServiceAddressComponents: form.hsAddressComponents.length > 0
              ? form.hsAddressComponents
              : undefined,
            homeServiceMapUrl:           form.hsMapUrl || undefined,
          }
        : {};

    const payload = {
      branchId: selectedBranch.id,
      serviceIds: selectedServices.map((s) => s.id),
      staffId: selectedStaffForBooking !== "auto" ? selectedStaffForBooking : undefined,
      date: toLocalYmd(selectedDate),
      startTime: selectedSlot.slot_time,
      fullName: form.fullName,
      phone: form.phone,
      email: form.email || undefined,
      notes: form.notes || undefined,
      ...hsPayload,
    };

    const result =
      mode === "inhouse"
        ? await createInhouseBookingMultiAction({
            ...payload,
            type:             getBookingTypeForVisitType(visitType, "inhouse"),
            paymentMethod:    form.paymentMethod as "cash" | "gcash" | "maya" | "card" | "other",
            paymentReference: form.paymentReference.trim() || undefined,
            paymentNote:      form.paymentNote.trim() || undefined,
          })
        : await createOnlineBookingMultiAction({
            ...payload,
            type: getBookingTypeForVisitType(visitType, "public"),
          });

    setSubmitting(false);
    if (result.ok) {
      toast.success(mode === "inhouse" ? "Booking saved" : "Booking request received", {
        description: mode === "inhouse"
          ? "Appointment saved to the CRM workspace."
          : "Our CRM team will contact you shortly to confirm payment and finalize your appointment.",
      });
      setSuccess({ bookingId: result.bookingId });
      setStep(successStep);
    } else {
      const isNetworkError =
        result.message.toLowerCase().includes("fetch") ||
        result.message.toLowerCase().includes("network") ||
        result.message.toLowerCase().includes("failed to");
      const description = isNetworkError
        ? "Check your connection and try again."
        : result.message;
      toast.error("Booking failed", { description });
      setFormError(description);
    }
  }, [selectedBranch, selectedServices, selectedDate, selectedSlot, visitType, bookingRules, selectedStaffForBooking, form, mode, isHomeService, successStep, isOffline]);

  const preciseHomeServiceLocationSelected = isPreciseHomeServiceLocation(form);
  const preciseLocationRequired = mode === "public" && isHomeService;
  const hsAddressFilled =
    !isHomeService ||
    (preciseLocationRequired
      ? preciseHomeServiceLocationSelected
      : form.hsAddress.trim().length >= 5 &&
        (form.hsBarangay.trim().length >= 2 || form.hsCity.trim().length >= 2));

  // Public home-service location is Google place-first; zone stays unknown for
  // backward-compatible dispatch metadata and can be refined by operations later.
  const locationValid =
    !isHomeService
      ? true
      : preciseLocationRequired
        ? preciseHomeServiceLocationSelected
        : form.hsZone !== "unknown" && form.hsZone !== "";

  const canProceed =
    currentStepName === "branch"    ? !!selectedBranch
    : currentStepName === "visit"   ? !!bookingType && isVisitTypeEnabled(visitType, bookingRules)
    : currentStepName === "services" ? selectedServices.length > 0
    : currentStepName === "location" ? locationValid
    : currentStepName === "date_time" ? !!selectedSlot
    : currentStepName === "therapist" ? true
    : currentStepName === "details"  ? (
        form.fullName.trim().length >= 2 &&
        form.phone.trim().length >= 7 &&
        hsAddressFilled &&
        (mode !== "inhouse" || form.paymentMethod.trim().length > 0)
      )
    : false;
  const canClickContinue = currentStepName === "location" || canProceed;
  const mobileProgressIndex = getMobileProgressIndex(currentStepName);

  const handleContinue = useCallback(() => {
    if (currentStepName === "location" && !locationValid) {
      setFormError(
        preciseLocationRequired
          ? PRECISE_LOCATION_ERROR
          : "Please select a location zone before continuing."
      );
      return;
    }

    setFormError("");
    setStep((current) => current + 1);
  }, [currentStepName, locationValid, preciseLocationRequired]);

  return (
    <div className={mode === "public" ? "min-h-screen pt-14 md:pt-0" : ""} style={{ background: mode === "public" ? "#F7F3EB" : "transparent" }}>
      {mode === "public" && (
        <div className="relative hidden overflow-hidden pt-28 pb-12 md:block lg:pt-32 lg:pb-16">
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

      <div className={mode === "public" ? "mx-auto max-w-5xl px-4 pb-32 pt-7 md:px-6 md:py-10 lg:py-14" : "mx-auto max-w-6xl py-2"}>
        {mode === "public" && currentStepName !== "success" && (
          <div className="mb-5 text-center md:hidden">
            <h1 className="text-[19px] font-semibold text-[#10261D]">
              Book an Appointment
            </h1>
          </div>
        )}

        {mode === "public" && currentStepName !== "success" && (
          <div className="mb-8 md:hidden">
            <div className="flex items-start justify-between">
              {MOBILE_PROGRESS_STEPS.map((label, index) => (
                <div key={label} className="relative flex flex-1 flex-col items-center">
                  {index < MOBILE_PROGRESS_STEPS.length - 1 && (
                    <span
                      className={`absolute left-1/2 top-3 h-px w-full ${
                        mobileProgressIndex > index ? "bg-[#063D2D]" : "bg-[#D8C8AA]"
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      mobileProgressIndex >= index
                        ? "border-[#063D2D] bg-[#063D2D] text-[#FCFAF5]"
                        : "border-[#D8C8AA] bg-[#FBF6EC] text-[#A79A86]"
                    }`}
                  >
                    {mobileProgressIndex > index ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span
                    className={`mt-2 text-center text-[9.5px] font-medium leading-3 ${
                      mobileProgressIndex >= index ? "text-[#10261D]" : "text-[#857967]"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stepper */}
        {currentStepName !== "success" && (
          <div className="mb-12 hidden items-center justify-center md:flex">
            <div className="flex items-center gap-0.5 sm:gap-2">
              {steps.map((s, i) => (
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
                  {i < steps.length - 1 && (
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
            {currentStepName === "branch" && (
              <StepBranches
                branches={branches}
                loading={loadingBranches}
                selected={selectedBranch}
                onSelect={(b) => {
                  setSelectedBranch(b);
                  setBookingRules(null);
                  setSelectedServices([]);
                  setRawSlots([]);
                  setSlots([]);
                  setSelectedSlot(null);
                  setSelectedStaff("auto");
                  setAvailabilityMessage("");
                }}
              />
            )}
            {currentStepName === "visit" && (
              <StepVisitType
                selected={visitType}
                bookingRules={bookingRules}
                onSelect={handleVisitTypeSelect}
              />
            )}
            {currentStepName === "services" && (
              <BookingServicePicker
                services={eligibleServices}
                loading={loadingServices}
                selected={selectedServices}
                onToggle={toggleService}
                totalDuration={totalDuration}
                totalPrice={totalPrice}
                visitType={visitType}
              />
            )}
            {currentStepName === "location" && (
              <StepLocation
                form={form}
                onChange={(nextForm) => {
                  setForm(nextForm);
                  if (formError === PRECISE_LOCATION_ERROR) {
                    setFormError("");
                  }
                }}
                placesStatus={placesStatus}
                onPlacesStatusChange={setPlacesStatus}
                preciseLocationRequired={mode === "public"}
                mode={mode}
                error={formError}
              />
            )}
            {currentStepName === "date_time" && (
              <StepDateTime
                visitType={visitType}
                bookingRules={bookingRules}
                selectedDate={selectedDate}
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  setRawSlots([]);
                  setSlots([]);
                  setSelectedSlot(null);
                  setSelectedStaff("auto");
                  setAvailabilityMessage("");
                }}
                slots={displaySlots}
                loading={loadingSlots}
                serviceCount={selectedServices.length}
                availabilityMessage={availabilityMessage}
                selectedSlot={selectedSlot}
                onSelectSlot={(s) => {
                  setSelectedSlot(s);
                  setSelectedStaff("auto");
                }}
                dispatchStatuses={dispatchStatuses}
                mode={mode}
              />
            )}
            {currentStepName === "therapist" && (
              <StepTherapist
                availableStaff={availableStaffAtSlot}
                selected={selectedStaffForBooking}
                onSelect={setSelectedStaff}
              />
            )}
            {currentStepName === "details" && (
              <StepDetails
                form={form}
                onChange={setForm}
                error={formError}
                visitType={visitType}
                mode={mode}
              />
            )}
            {currentStepName === "success" && success && (
              <StepSuccess bookingId={success.bookingId} services={selectedServices} mode={mode} />
            )}

            {/* Navigation */}
            {currentStepName !== "success" && (
              <div
                className={
                  mode === "public"
                    ? "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#EDE4D3] bg-[#FBF6EC]/95 px-4 py-3 shadow-[0_-8px_22px_rgba(16,38,29,0.12)] backdrop-blur md:static md:mt-10 md:border-t md:bg-transparent md:px-0 md:pt-8 md:shadow-none md:backdrop-blur-0"
                    : "flex items-center justify-between mt-10 pt-8 border-t border-[#EDE4D3]"
                }
                style={{ paddingBottom: mode === "public" ? "max(0.75rem, env(safe-area-inset-bottom))" : undefined }}
              >
                <button
                  onClick={handleBack}
                  disabled={currentStepName === "branch"}
                  className="flex min-h-11 items-center gap-2 text-[13px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#163A2B]"
                  style={{ color: "#6B7A6F" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                {currentStepName !== "details" ? (
                  <button
                    onClick={handleContinue}
                    disabled={!canClickContinue}
                    className={[
                      "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[7px] px-8 py-3 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 hover:shadow-lg md:flex-none md:rounded-full",
                      canClickContinue
                        ? "bg-[#063D2D] text-[#FCFAF5] md:bg-[linear-gradient(135deg,#C8A96B,#B68A3C)] md:text-[#10261D]"
                        : "bg-[#EDE4D3] text-[#9AA89A]",
                    ].join(" ")}
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceed || submitting || isOffline}
                    className={[
                      "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[7px] px-8 py-3 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 hover:shadow-lg md:flex-none md:rounded-full",
                      canProceed && !isOffline
                        ? "bg-[#063D2D] text-[#FCFAF5] md:bg-[linear-gradient(135deg,#C8A96B,#B68A3C)] md:text-[#10261D]"
                        : "bg-[#EDE4D3] text-[#9AA89A]",
                    ].join(" ")}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === "inhouse" ? "Saving..." : "Confirming..."}
                      </>
                    ) : (
                      <>
                        {mode === "inhouse" ? "Confirm & Record Payment" : "Confirm Booking"}
                        <Check className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          {currentStepName !== "success" && (
            <div className="hidden lg:block">
              <BookingSummary
                branch={selectedBranch}
                services={selectedServices}
                totalDuration={totalDuration}
                totalPrice={totalPrice}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                selectedStaff={selectedStaffForBooking}
                availableStaff={availableStaffAtSlot}
                visitType={visitType}
                bookingRules={bookingRules}
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
  bookingRules,
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
  bookingRules: BranchBookingRules | null;
}) {
  const staffLabel =
    selectedStaff === "auto"
      ? "Any available provider"
      : availableStaff.find((s) => s.staff_id === selectedStaff)?.staff_name;
  const visitOption = VISIT_TYPE_OPTIONS[visitType];
  const availability = getVisitTypeAvailability(visitType, bookingRules);

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
          sub={`${formatTime(availability.startTime)} - ${formatTime(availability.endTime)}`}
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
        className="mb-2 text-[18px] font-semibold md:text-2xl md:font-medium"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Select Branch
      </h2>
      <p className="mb-5 text-[13px] leading-6 md:mb-8 md:text-[14px]" style={{ color: "#6B7A6F" }}>
        Please choose the branch where you would like to book.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {branches.map((branch, index) => (
          <button
            key={branch.id}
            onClick={() => onSelect(branch)}
            className={`grid grid-cols-[84px_1fr_auto] gap-3 rounded-[10px] border p-3 text-left transition-all duration-300 md:flex md:items-start md:gap-4 md:rounded-xl md:p-5 ${
              selected?.id === branch.id
                ? "border-[#063D2D] bg-white shadow-[0_8px_22px_rgba(16,38,29,0.08)] md:border-[#C8A96B] md:bg-[#C8A96B]/5 md:shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
                : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
            }`}
          >
            <div className="relative h-[92px] overflow-hidden rounded-[7px] bg-[#E9DDC8] md:hidden">
              <Image
                src={index % 2 === 0 ? SPA_IMAGES.contact : SPA_IMAGES.booking}
                alt={`${branch.name} branch`}
                fill
                className="object-cover"
                sizes="84px"
              />
            </div>
            <div
              className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg md:flex ${
                selected?.id === branch.id
                  ? "bg-[#163A2B] text-[#C8A96B]"
                  : "bg-[#163A2B]/5 text-[#163A2B]"
              }`}
            >
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-[#F6E8C8] px-2 py-1 text-[10px] font-semibold text-[#9A6A1F] md:hidden">
                Services vary by branch
              </span>
              <p className="text-[14px] font-semibold" style={{ color: "#163A2B" }}>
                {branch.name}
              </p>
              {branch.address && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 md:text-[12px]" style={{ color: "#6B7A6F" }}>
                  {branch.address}
                </p>
              )}
              <p className="mt-2 text-[10.5px] text-[#3F4F44] md:hidden">
                Open daily · 10:00 AM - 10:00 PM
              </p>
            </div>
            <div className="flex items-center justify-center self-center md:hidden">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                  selected?.id === branch.id
                    ? "border-[#063D2D] bg-[#063D2D] text-[#FCFAF5]"
                    : "border-[#A79A86] bg-white text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
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
  bookingRules,
  onSelect,
}: {
  selected: VisitType;
  bookingRules: BranchBookingRules | null;
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
          const availability = getVisitTypeAvailability(visitType, bookingRules);
          const isEnabled = isVisitTypeEnabled(visitType, bookingRules);
          const isSelected = selected === visitType;
          const Icon = visitType === "home_service" ? Home : Building;

          return (
            <button
              key={visitType}
              type="button"
              disabled={!isEnabled}
              onClick={() => {
                if (isEnabled) onSelect(visitType);
              }}
              className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-300 ${
                isSelected
                  ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
                  : isEnabled
                    ? "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
                    : "border-[#EDE4D3] bg-white opacity-55 cursor-not-allowed"
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
                  {isEnabled ? option.description : "Not available for this branch."}
                </p>
                <p className="text-[11px] mt-3 font-medium" style={{ color: "#C8A96B" }}>
                  {formatTime(availability.startTime)} - {formatTime(availability.endTime)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4: Date & Time ────────────────────────────────────────────────────────

function StepDateTime({
  visitType,
  bookingRules,
  selectedDate,
  onSelectDate,
  slots,
  loading,
  serviceCount,
  availabilityMessage,
  selectedSlot,
  onSelectSlot,
  dispatchStatuses,
  mode,
}: {
  visitType: VisitType;
  bookingRules: BranchBookingRules | null;
  selectedDate: Date | undefined;
  onSelectDate: (d: Date | undefined) => void;
  slots: Slot[];
  loading: boolean;
  serviceCount: number;
  availabilityMessage: string;
  selectedSlot: Slot | null;
  onSelectSlot: (s: Slot) => void;
  dispatchStatuses: Map<string, SlotDispatchStatus>;
  mode: BookingWizardMode;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(
    maxDate.getDate() + (bookingRules?.maxAdvanceBookingDays ?? 30)
  );

  const availableSlots = slots.filter((s) => s.available);
  const isTodaySelected =
    !!selectedDate && toLocalYmd(selectedDate) === toLocalYmd(new Date());
  const visitOption = VISIT_TYPE_OPTIONS[visitType];
  const availability = getVisitTypeAvailability(visitType, bookingRules);
  const emptyMessage =
    availabilityMessage ||
    (slots.length > 0
      ? "No available times for this date. Try another day."
      : "No available staff for this service at this branch.");

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
            {visitOption.label}: {formatTime(availability.startTime)} - {formatTime(availability.endTime)}
          </p>
          {serviceCount === 0 ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed"
              style={{ borderColor: "#EDE4D3", background: "#FCFAF5" }}
            >
              <p className="text-[13px]" style={{ color: "#9AA89A" }}>
                Choose a service to see available times.
              </p>
            </div>
          ) : !selectedDate ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed"
              style={{ borderColor: "#EDE4D3", background: "#FCFAF5" }}
            >
              <p className="text-[13px]" style={{ color: "#9AA89A" }}>
                Choose a date to see available times.
              </p>
            </div>
          ) : loading ? (
            <div>
              <p className="mb-3 text-[13px]" style={{ color: "#6B7A6F" }}>
                Checking available times...
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            </div>
          ) : availableSlots.length === 0 ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed"
              style={{ borderColor: "#EDE4D3", background: "#FCFAF5" }}
            >
              <p className="text-[13px]" style={{ color: "#6B7A6F" }}>
                {isTodaySelected
                  ? "No more available slots today. Please choose another date."
                  : emptyMessage}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableSlots.map((slot) => {
                const dispatch = dispatchStatuses.get(slot.slot_time);
                const isWarning = dispatch === "warning";
                const isHard = dispatch === "hard";
                const isSelected = selectedSlot?.slot_time === slot.slot_time;
                // inhouse: show hard slots with warning; public: hard slots filtered before here
                return (
                  <button
                    type="button"
                    key={slot.slot_time}
                    onClick={() => !isHard && onSelectSlot(slot)}
                    disabled={isHard && mode === "inhouse"}
                    className={`relative flex flex-col items-center justify-center rounded-lg py-2.5 px-2 text-[12px] font-medium transition-all duration-300 ${
                      isSelected
                        ? "bg-[#163A2B] text-[#C8A96B] shadow-md"
                        : isHard
                        ? "bg-white text-[#9AA89A] border border-[#EDE4D3] opacity-50 cursor-not-allowed"
                        : isWarning
                        ? "bg-amber-50 text-[#163A2B] border border-amber-200 hover:border-amber-400"
                        : "bg-white text-[#163A2B] border border-[#EDE4D3] hover:border-[#C8A96B]/50"
                    }`}
                  >
                    {formatTime(slot.slot_time)}
                    {isWarning && !isSelected && (
                      <span className="text-[9px] font-semibold text-amber-600 leading-none mt-0.5">
                        Review
                      </span>
                    )}
                    {isHard && mode === "inhouse" && (
                      <span className="text-[9px] font-semibold text-red-500 leading-none mt-0.5">
                        Conflict
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Therapist ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Premium provider photo card — used in the multi-provider 4-column grid.
function ProviderPhotoCard({
  staff,
  isSelected,
  isRecommended,
  onSelect,
}: {
  staff: StaffOption;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}) {
  const displayName = staff.staff_nickname ?? staff.staff_name;
  const initials = getInitials(staff.staff_name);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`relative flex flex-col items-center text-center rounded-2xl border pt-6 pb-4 px-3 transition-all duration-200 ${
        isSelected
          ? "border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
          : "border-[#EDE4D3] bg-white hover:border-[#C8A96B]/50 hover:shadow-sm"
      }`}
    >
      {/* Recommended ribbon */}
      {isRecommended && (
        <div
          className="absolute top-0 left-0 rounded-tl-2xl rounded-br-xl text-[9px] font-semibold uppercase tracking-wide px-2.5 py-1"
          style={{ background: "#163A2B", color: "#C8A96B" }}
        >
          Recommended
        </div>
      )}

      {/* Selection indicator */}
      <div
        className={`absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
          isSelected ? "border-[#163A2B] bg-[#163A2B]" : "border-[#EDE4D3]"
        }`}
      >
        {isSelected && <Check className="h-2.5 w-2.5 text-[#C8A96B]" />}
      </div>

      {/* Photo / initials avatar */}
      <div className="relative mb-3 h-16 w-16 shrink-0 overflow-hidden rounded-full">
        {staff.staff_avatar_url ? (
          <Image
            src={staff.staff_avatar_url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center text-[16px] font-semibold ${
              isSelected ? "bg-[#163A2B] text-[#C8A96B]" : "bg-[#163A2B]/10 text-[#163A2B]"
            }`}
            aria-hidden="true"
          >
            {initials || <User className="h-5 w-5" />}
          </div>
        )}
      </div>

      {/* Name */}
      <p className="w-full truncate text-[13px] font-semibold leading-5" style={{ color: "#163A2B" }}>
        {displayName}
      </p>

      {/* Availability dot */}
      <div className="mt-1 flex items-center gap-1">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
        <span className="text-[11px]" style={{ color: "#6B7A6F" }}>Available</span>
      </div>
    </button>
  );
}

function StepTherapist({
  availableStaff,
  selected,
  onSelect,
}: {
  availableStaff: StaffOption[];
  selected: "auto" | string;
  onSelect: (choice: "auto" | string) => void;
}) {
  const isSingle = availableStaff.length === 1;
  const isMultiple = availableStaff.length > 1;

  // ── Case 2: Exactly one qualified provider — auto-assigned ─────────────
  if (isSingle) {
    const provider = availableStaff[0]!;
    const displayName = provider.staff_nickname ?? provider.staff_name;
    const initials = getInitials(provider.staff_name);
    const isAuto = selected === "auto";

    return (
      <div>
        <h2
          className="text-2xl font-medium mb-2"
          style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
        >
          Provider assigned
        </h2>
        <p className="text-[14px] mb-6" style={{ color: "#6B7A6F" }}>
          We&apos;ve matched you with the only available qualified provider for this service and time.
        </p>

        {isAuto ? (
          /* User switched to "any available" — show the any-available card selected */
          <div>
            <button
              type="button"
              onClick={() => onSelect("auto")}
              aria-pressed={true}
              className="flex w-full items-center gap-4 p-5 rounded-xl border text-left border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold" style={{ color: "#163A2B" }}>
                  Any available provider
                </p>
                <p className="text-[12px] mt-1" style={{ color: "#6B7A6F" }}>
                  We&apos;ll assign the best qualified staff.
                </p>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#163A2B] shrink-0">
                <Check className="h-3.5 w-3.5 text-[#C8A96B]" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSelect(provider.staff_id)}
              className="mt-3 text-[12px] font-semibold underline underline-offset-2"
              style={{ color: "#163A2B" }}
            >
              Switch back to {displayName}
            </button>
          </div>
        ) : (
          /* Auto-assigned provider card */
          <div>
            <div className="flex items-center gap-4 p-5 rounded-xl border border-[#C8A96B] bg-[#C8A96B]/5 shadow-[0_4px_16px_rgba(200,169,107,0.15)]">
              {/* Photo / initials */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                {provider.staff_avatar_url ? (
                  <Image
                    src={provider.staff_avatar_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center rounded-xl bg-[#163A2B] text-[14px] font-semibold text-[#C8A96B]"
                    aria-hidden="true"
                  >
                    {initials || <User className="h-5 w-5" />}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold" style={{ color: "#163A2B" }}>
                  {displayName}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  <p className="text-[12px]" style={{ color: "#6B7A6F" }}>
                    Available and assigned for you
                  </p>
                </div>
              </div>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#163A2B]">
                <Check className="h-3.5 w-3.5 text-[#C8A96B]" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelect("prefer-auto")}
              className="mt-3 text-[12px] font-semibold underline underline-offset-2"
              style={{ color: "#6B7A6F" }}
            >
              Use any available provider instead
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Case 1 (multiple) + Case 3 (zero) ─────────────────────────────────
  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Choose your provider
      </h2>
      <p className="text-[14px] mb-6" style={{ color: "#6B7A6F" }}>
        Select a specific provider or continue with any available provider.
      </p>

      <div className="flex flex-col gap-4">
        {/* Any available provider card */}
        <button
          type="button"
          onClick={() => onSelect("auto")}
          aria-pressed={selected === "auto"}
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
                Any available provider
              </p>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "#163A2B", color: "#C8A96B" }}
              >
                Recommended
              </span>
            </div>
            <p className="text-[12px] mt-1" style={{ color: "#6B7A6F" }}>
              We&apos;ll assign the best qualified staff based on availability and service.
            </p>
          </div>
          {selected === "auto" && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#163A2B] shrink-0">
              <Check className="h-3.5 w-3.5 text-[#C8A96B]" />
            </div>
          )}
        </button>

        {/* Multi-provider photo grid */}
        {isMultiple && (
          <>
            <div className="flex items-center justify-between pt-1">
              <p
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "#9AA89A" }}
              >
                Available providers for this time
              </p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                <span className="text-[11px]" style={{ color: "#6B7A6F" }}>Available</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {availableStaff.map((staff, index) => (
                <ProviderPhotoCard
                  key={staff.staff_id}
                  staff={staff}
                  isSelected={selected === staff.staff_id}
                  isRecommended={index === 0}
                  onSelect={() => onSelect(staff.staff_id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Case 3: No specific providers available */}
        {!isMultiple && (
          <div
            className="rounded-xl border border-dashed px-4 py-5 text-[13px] leading-6"
            style={{ background: "#FCFAF5", borderColor: "#EDE4D3", color: "#6B7A6F" }}
          >
            No specific provider is available for this time. You can continue with Any Available and
            our team will assign the best qualified staff.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared input style ─────────────────────────────────────────────────────────
const INPUT_CLS = "w-full rounded-xl border border-[#EDE4D3] bg-white px-4 py-3 text-[14px] text-[#163A2B] placeholder:text-[#9AA89A] outline-none transition-all focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/20";
const LABEL_CLS = "flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2";

// ── Step 4 (HS only): Location ────────────────────────────────────────────────

function isPreciseHomeServiceLocation(form: DetailsForm): boolean {
  return (
    form.hsPlaceId.trim().length > 0 &&
    form.hsFormattedAddress.trim().length >= 5 &&
    typeof form.hsLat === "number" &&
    Number.isFinite(form.hsLat) &&
    typeof form.hsLng === "number" &&
    Number.isFinite(form.hsLng)
  );
}

function getAddressComponent(
  components: GoogleAddressComponent[],
  types: string[]
): string {
  return (
    components.find((component) =>
      types.some((type) => component.types.includes(type))
    )?.long_name ?? ""
  );
}

function applySelectedPlace(form: DetailsForm, result: PlaceSelectResult): DetailsForm {
  const barangay = getAddressComponent(result.addressComponents, [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_3",
  ]);
  const city = getAddressComponent(result.addressComponents, [
    "locality",
    "administrative_area_level_2",
    "administrative_area_level_1",
  ]);

  return {
    ...form,
    hsAddress: result.formattedAddress,
    hsLat: result.lat,
    hsLng: result.lng,
    hsPlaceId: result.placeId,
    hsFormattedAddress: result.formattedAddress,
    hsAddressComponents: result.addressComponents,
    hsMapUrl: result.mapUrl,
    hsBarangay: barangay || form.hsBarangay,
    hsCity: city || form.hsCity,
  };
}

function clearSelectedPlace(form: DetailsForm, hsAddress: string): DetailsForm {
  return {
    ...form,
    hsAddress,
    hsLat: null,
    hsLng: null,
    hsPlaceId: "",
    hsFormattedAddress: "",
    hsAddressComponents: [],
    hsMapUrl: "",
  };
}

function placesStatusMessage(status: PlacesAutocompleteStatus): string {
  if (status === "missing_key") {
    return "Google address search is unavailable right now. Please contact us so a CSR can help confirm your home-service location.";
  }
  if (status === "failed") {
    return "Google address search failed to load. Please refresh the page or contact us for help booking home service.";
  }
  if (status === "place_missing_coordinates") {
    return "That selected place did not include coordinates. Please choose a different Google suggestion.";
  }
  if (status === "loading") {
    return "Loading Google address suggestions...";
  }
  return "";
}

function StepLocation({
  form,
  onChange,
  placesStatus,
  onPlacesStatusChange,
  preciseLocationRequired,
  mode,
  error,
}: {
  form: DetailsForm;
  onChange: (f: DetailsForm) => void;
  placesStatus: PlacesAutocompleteStatus;
  onPlacesStatusChange: (status: PlacesAutocompleteStatus) => void;
  preciseLocationRequired: boolean;
  mode: BookingWizardMode;
  error: string;
}) {
  const preciseLocationSelected = isPreciseHomeServiceLocation(form);
  const hasTypedAddress = form.hsAddress.trim().length > 0;
  const statusMessage = placesStatusMessage(placesStatus);
  const showSelectionError =
    (preciseLocationRequired && hasTypedAddress && !preciseLocationSelected) ||
    error === PRECISE_LOCATION_ERROR;
  const helperId = "hs-address-helper";
  const showCustomerCompactLocation = mode === "public";

  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
      >
        Your Location
      </h2>
      <p className="text-[14px] mb-8" style={{ color: "#6B7A6F" }}>
        Search and select your exact location so our therapist and driver can find you easily.
      </p>

      <div className="flex flex-col gap-5">
        {!showCustomerCompactLocation && (
          <div>
            <label htmlFor="hs-zone" className={LABEL_CLS} style={{ color: "#9AA89A" }}>
              <MapPin className="h-3.5 w-3.5" />
              Location Zone *
            </label>
            <select
              id="hs-zone"
              value={form.hsZone}
              onChange={(event) => onChange({ ...form, hsZone: event.target.value })}
              className={INPUT_CLS}
            >
              <option value="" disabled>Select your zone...</option>
              {HS_ZONE_OPTIONS.filter((option) => option.value !== "unknown").map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] mt-1" style={{ color: "#9AA89A" }}>
              Helps us verify we have a driver available in your area before you pick a time.
            </p>
          </div>
        )}

        <div>
          {!preciseLocationSelected ? (
            <>
              <label htmlFor="hs-address-location" className={LABEL_CLS} style={{ color: "#9AA89A" }}>
                <MapPin className="h-3.5 w-3.5" />
                Search your home location *
              </label>
              <PlacesAutocomplete
                id="hs-address-location"
                value={form.hsAddress}
                onChange={(value) => onChange(clearSelectedPlace(form, value))}
                onPlaceSelect={(result: PlaceSelectResult | null) => {
                  if (result) {
                    onChange(applySelectedPlace(form, result));
                  }
                }}
                onStatusChange={onPlacesStatusChange}
                placeholder="Search your address, building, or nearby landmark"
                className={INPUT_CLS}
                ariaDescribedBy={helperId}
              />
              <p id={helperId} className="text-[11px] mt-1" style={{ color: "#9AA89A" }}>
                Choose a Google suggestion; typed text alone is not enough for routing.
              </p>
            </>
          ) : (
            <div
              className="flex items-start gap-3 rounded-xl border px-4 py-3"
              style={{ background: "#F7FBF5", borderColor: "#CDE3C7" }}
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6B3C]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2F6B3C]">
                  Selected location
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-[#163A2B]">
                  {form.hsFormattedAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(clearSelectedPlace(form, ""))}
                className="rounded-full border border-[#CDE3C7] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#2F6B3C] transition-colors hover:bg-white"
              >
                Change
              </button>
            </div>
          )}

          {statusMessage && (
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-[12px] ${
                placesStatus === "loading"
                  ? "bg-[#FCFAF5] text-[#6B7A6F]"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {statusMessage}
            </p>
          )}

          {showSelectionError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
              {PRECISE_LOCATION_ERROR}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="hs-delivery-notes" className={LABEL_CLS} style={{ color: "#9AA89A" }}>
            Delivery notes{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="hs-delivery-notes"
            value={form.hsParkingNotes}
            onChange={(event) => onChange({ ...form, hsParkingNotes: event.target.value })}
            placeholder="House number, unit, gate color, landmark, parking instructions..."
            rows={3}
            className={`${INPUT_CLS} resize-none`}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 6 (or 7 for HS): Details ─────────────────────────────────────────────

type DetailsForm = {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  hsAddress: string;
  hsAddressDetails: string;
  hsBarangay: string;
  hsCity: string;
  hsLandmark: string;
  hsParkingNotes: string;
  hsZone: string;
  hsLat: number | null;
  hsLng: number | null;
  hsPlaceId: string;
  hsFormattedAddress: string;
  hsAddressComponents: GoogleAddressComponent[];
  hsMapUrl: string;
  // CRM in-house payment capture
  paymentMethod: string;
  paymentReference: string;
  paymentNote: string;
};

const HS_ZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "unknown",               label: "Not sure / Let CSR confirm" },
  { value: "central_bacolod",       label: "Central Bacolod" },
  { value: "north_bacolod_talisay", label: "North Bacolod / Talisay" },
  { value: "south_bacolod_alijis",  label: "South Bacolod / Alijis" },
  { value: "east_bacolod",          label: "East Bacolod" },
  { value: "outside_bacolod",       label: "Outside Bacolod" },
];

function StepDetails({
  form,
  onChange,
  error,
  visitType,
  mode,
}: {
  form: DetailsForm;
  onChange: (f: DetailsForm) => void;
  error: string;
  visitType: VisitType;
  mode: BookingWizardMode;
}) {
  const isHomeService = visitType === "home_service";

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
        {/* Contact info */}
        <div>
          <label className={`${LABEL_CLS}`} style={{ color: "#9AA89A" }}>
            <User className="h-3.5 w-3.5" />
            Full Name *
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => onChange({ ...form, fullName: e.target.value })}
            placeholder="Enter your full name"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className={`${LABEL_CLS}`} style={{ color: "#9AA89A" }}>
            <Phone className="h-3.5 w-3.5" />
            Phone Number *
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value })}
            placeholder="e.g. 0917 123 4567"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className={`${LABEL_CLS}`} style={{ color: "#9AA89A" }}>
            <Mail className="h-3.5 w-3.5" />
            Email{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="your@email.com"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className={`${LABEL_CLS}`} style={{ color: "#9AA89A" }}>
            <FileText className="h-3.5 w-3.5" />
            Notes{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            placeholder="Share any comfort notes or special requests."
            rows={3}
            className={`${INPUT_CLS} resize-none`}
          />
        </div>

        {/* CRM In-House Payment Capture */}
        {mode === "inhouse" && (
          <div
            className="flex flex-col gap-4 rounded-2xl p-5 border"
            style={{ background: "#F0FDF4", borderColor: "#86EFAC" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4" style={{ color: "#16A34A" }} />
              <p className="text-[13px] font-semibold" style={{ color: "#15803D" }}>
                Payment
              </p>
              <span
                className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "#DCFCE7", color: "#15803D" }}
              >
                Required
              </span>
            </div>
            <p className="text-[12px] -mt-2" style={{ color: "#166534" }}>
              Record the customer&apos;s payment before finalizing this in-house booking.
            </p>

            <div>
              <label className={`${LABEL_CLS}`} style={{ color: "#166534" }}>
                Payment method *
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => onChange({ ...form, paymentMethod: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="" disabled>Select payment method…</option>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className={`${LABEL_CLS}`} style={{ color: "#166534" }}>
                Reference / receipt no.{" "}
                <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.paymentReference}
                onChange={(e) => onChange({ ...form, paymentReference: e.target.value })}
                placeholder="e.g. GCash ref #, receipt number"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={`${LABEL_CLS}`} style={{ color: "#166534" }}>
                Payment note{" "}
                <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={form.paymentNote}
                onChange={(e) => onChange({ ...form, paymentNote: e.target.value })}
                placeholder="Internal note about this payment…"
                rows={2}
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
          </div>
        )}

        {/* Home Service Address */}
        {isHomeService && (
          <div
            className="flex flex-col gap-4 rounded-2xl p-5 border"
            style={{ background: "#FCFAF5", borderColor: "#C8A96B40" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4" style={{ color: "#C8A96B" }} />
              <p className="text-[13px] font-semibold" style={{ color: "#163A2B" }}>
                Home Service Address
              </p>
              <span
                className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "#C8A96B20", color: "#8A6B35" }}
              >
                Required
              </span>
            </div>
            <p className="text-[12px] -mt-2" style={{ color: "#6B7A6F" }}>
              We will use the selected Google location from the Location step for dispatch and routing.
            </p>

            {mode === "inhouse" && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 border" style={{ background: "white", borderColor: "#EDE4D3" }}>
                <MapPin className="h-4 w-4 shrink-0" style={{ color: "#C8A96B" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9AA89A" }}>Zone</p>
                  <p className="text-[13px] font-medium" style={{ color: "#163A2B" }}>
                    {HS_ZONE_OPTIONS.find((o) => o.value === form.hsZone)?.label ?? form.hsZone}
                  </p>
                </div>
              </div>
            )}

            {isPreciseHomeServiceLocation(form) ? (
              <div
                className="flex items-start gap-3 rounded-xl border px-4 py-3"
                style={{ background: "white", borderColor: "#EDE4D3" }}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6B3C]" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2F6B3C]">
                    Selected location
                  </p>
                  <p className="mt-0.5 text-[13px] leading-5" style={{ color: "#163A2B" }}>
                    {form.hsFormattedAddress}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: "#6B7A6F" }}>
                    Place ID captured for routing.
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
                {PRECISE_LOCATION_ERROR}
              </p>
            )}

            {form.hsAddressDetails && (
              <div className="rounded-xl border px-4 py-3" style={{ background: "white", borderColor: "#EDE4D3" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9AA89A" }}>
                  House / Unit Details
                </p>
                <p className="mt-0.5 text-[13px]" style={{ color: "#163A2B" }}>
                  {form.hsAddressDetails}
                </p>
              </div>
            )}

            {mode === "inhouse" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={`${LABEL_CLS}`} style={{ color: "#9AA89A" }}>
                    Barangay *
                  </label>
                  <input
                    type="text"
                    value={form.hsBarangay}
                    onChange={(event) => onChange({ ...form, hsBarangay: event.target.value })}
                    placeholder="e.g. Brgy. San Antonio"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={`${LABEL_CLS}`} style={{ color: "#9AA89A" }}>
                    City / Municipality *
                  </label>
                  <input
                    type="text"
                    value={form.hsCity}
                    onChange={(event) => onChange({ ...form, hsCity: event.target.value })}
                    placeholder="e.g. Bacolod City"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            )}
          </div>
        )}
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
        {mode === "inhouse" ? "Booking Saved" : "Booking request received ✨"}
      </h2>
      <p className="text-[15px] max-w-md mx-auto mb-6" style={{ color: "#6B7A6F" }}>
        {mode === "inhouse"
          ? "The appointment has been saved and confirmed in the CRM workspace."
          : "Thanks for booking with CradleHub. Our CRM team will contact you shortly to confirm your payment and finalize your appointment."}
      </p>

      {mode === "public" && (
        <div
          className="mx-auto mb-6 max-w-md rounded-xl px-5 py-4 text-left"
          style={{ background: "#FCFAF5", border: "1px solid #EDE4D3" }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#C8A96B" }}>
            Next step
          </p>
          <p className="mt-1 text-[13px] leading-6" style={{ color: "#3F4F44" }}>
            Wait for our CRM confirmation. We are temporarily holding your selected time while we process your request, so please keep your phone nearby.
          </p>
        </div>
      )}

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
          : "Your request is with our CRM team. If you need to make any changes, please call us directly."}
      </p>

      {mode === "public" && (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#EDE4D3] bg-white px-5 text-[13px] font-semibold text-[#163A2B] transition-colors hover:border-[#C8A96B]"
          >
            Back to home
          </Link>
          <Link
            href="/book"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#163A2B] px-5 text-[13px] font-semibold text-[#FCFAF5] transition-opacity hover:opacity-90"
          >
            Book another service
          </Link>
        </div>
      )}
    </div>
  );
}
