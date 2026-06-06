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
  ShieldCheck,
  LockKeyhole,
  BadgeCheck,
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
import { TherapistSelectionStep } from "@/components/features/booking/therapist-picker/therapist-selection-step";
import {
  buildTherapistPickerOptions,
  getTherapistInitials,
} from "@/components/features/booking/therapist-picker/therapist-picker-utils";
import {
  getSlotDispatchStatus,
  type ExistingHsBooking,
  type SlotDispatchStatus,
} from "@/lib/bookings/dispatch-slot-filter";
import { isPastSlot, BRANCH_TIMEZONE } from "@/lib/engine/slot-time";
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
  imageUrl?: string | null;
  imageAlt?: string | null;
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
const BOOKING_PAGE_BACKGROUND =
  "radial-gradient(circle at 80% 8%, rgba(212,181,122,0.14), transparent 34%), radial-gradient(circle at 12% 18%, rgba(30,61,47,0.38), transparent 38%), linear-gradient(180deg, #031B16 0%, #05241D 45%, #02140F 100%)";
const BOOKING_HERO_OVERLAY =
  "radial-gradient(circle at 76% 24%, rgba(212,181,122,0.18), transparent 34%), linear-gradient(90deg, rgba(3,27,22,0.78) 0%, rgba(3,27,22,0.42) 46%, rgba(3,27,22,0.12) 100%), linear-gradient(180deg, rgba(3,27,22,0.12) 0%, rgba(3,27,22,0.78) 100%)";
const WARM_HEADING_STYLE = {
  fontFamily: "var(--sp-font-display)",
  color: "#F6EBD6",
} as const;
const WARM_BODY_STYLE = { color: "rgba(246,235,214,0.82)" } as const;
const WARM_MUTED_STYLE = { color: "rgba(246,235,214,0.62)" } as const;
const WARM_LABEL_STYLE = { color: "#D4B57A" } as const;
const WARM_GLASS_PANEL_CLS =
  "border border-[#D4B57A]/25 bg-[#0D2B20]/65 shadow-[0_24px_70px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";
const WARM_SELECTED_CARD_CLS =
  "border-[#D4B57A]/80 bg-[#0D2B20]/78 ring-1 ring-[#D4B57A]/45 shadow-[0_0_34px_rgba(212,181,122,0.18)]";
const WARM_IDLE_CARD_CLS =
  "border-[#D4B57A]/25 bg-[#0D2B20]/58 hover:border-[#D4B57A]/55 hover:bg-[#0D2B20]/72";
const WARM_PRIMARY_BUTTON_CLS =
  "bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] text-[#031B16] shadow-[0_18px_42px_rgba(200,169,106,0.25)]";
const WARM_DISABLED_BUTTON_CLS =
  "border border-[#D4B57A]/18 bg-[#0A261E]/62 text-[#F6EBD6]/38";
const WARM_SKELETON_CLS =
  "bg-[#05241D]/65 after:via-[#D4B57A]/18";
const BOOKING_CALENDAR_CLASSNAMES = {
  root: "w-fit text-[#F6EBD6]",
  months: "relative flex flex-col gap-4 md:flex-row",
  month: "flex w-full flex-col gap-4",
  month_caption: "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
  caption_label: "select-none text-sm font-semibold text-[#D4B57A]",
  nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
  button_previous:
    "size-(--cell-size) select-none rounded-lg border border-[#D4B57A]/25 bg-[#05241D]/55 p-0 text-[#D4B57A] transition-colors hover:border-[#D4B57A]/55 hover:bg-[#0D2B20]/80 aria-disabled:opacity-35",
  button_next:
    "size-(--cell-size) select-none rounded-lg border border-[#D4B57A]/25 bg-[#05241D]/55 p-0 text-[#D4B57A] transition-colors hover:border-[#D4B57A]/55 hover:bg-[#0D2B20]/80 aria-disabled:opacity-35",
  weekdays: "flex",
  weekday:
    "flex-1 rounded-lg text-[0.8rem] font-medium text-[#F6EBD6]/58 select-none",
  week: "mt-2 flex w-full",
  month_grid: "w-full border-collapse",
  day: "group/day relative aspect-square h-full w-full rounded-lg p-0 text-center select-none",
  day_button:
    "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 rounded-lg border border-transparent bg-transparent text-[#F6EBD6] leading-none font-medium transition-colors hover:border-[#D4B57A]/55 hover:bg-[#05241D]/80 focus-visible:border-[#D4B57A]/75 focus-visible:ring-2 focus-visible:ring-[#D4B57A]/20 disabled:text-[#F6EBD6]/24 disabled:hover:border-transparent disabled:hover:bg-transparent data-[selected-single=true]:border-[#D4B57A] data-[selected-single=true]:bg-[#D4B57A] data-[selected-single=true]:text-[#031B16] data-[selected-single=true]:shadow-[0_0_22px_rgba(212,181,122,0.22)] data-[selected-single=true]:hover:bg-[#D4B57A]",
  today:
    "rounded-lg border border-[#D4B57A]/45 bg-[#05241D]/72 text-[#F6EBD6]",
  outside: "text-[#F6EBD6]/24 aria-selected:text-[#031B16]",
  disabled: "text-[#F6EBD6]/22 opacity-45",
  selected: "rounded-lg",
  hidden: "invisible",
};

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
  selectedServiceIds: string[]
): boolean {
  // The availability API already filters the returned slot rows to service-capable
  // providers. The booking-context lookup is only enrichment for display and may
  // not contain a complete staff_services map for every capable therapist.
  if (!lookup) return true;
  if (!lookup.isServiceProvider) return false;
  if (selectedServiceIds.length === 0) return false;

  return true;
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
  selectedServiceIds: string[]
): StaffOption[] {
  const seen = new Set<string>();
  const out: StaffOption[] = [];
  for (const s of rawSlots) {
    if (!s.available) continue;
    if (!s.slot_time.startsWith(slotTime.substring(0, 5))) continue;
    if (seen.has(s.staff_id)) continue;
    const lookup = staffLookup.get(s.staff_id);
    if (!staffCanPerformSelectedServices(lookup, selectedServiceIds)) {
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
  initialVisitType = undefined,
}: {
  mode?: BookingWizardMode;
  initialBranchId?: string | null;
  initialCustomer?: InitialCustomer | null;
  /**
   * Optional: seed the wizard with a specific visit type selected.
   * Used by CRM when opening /crm/bookings/new?type=home_service or ?type=walkin.
   * When omitted the wizard defaults to "in_spa" — preserving existing public booking behavior.
   */
  initialVisitType?: VisitType;
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
    // Seed from initialVisitType when provided (CRM walk-in / home-service routing).
    // Falls back to "in_spa" default — preserves existing public booking behavior.
    getBookingTypeForVisitType(initialVisitType ?? "in_spa", mode)
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
  const isTherapistStep = currentStepName === "therapist";
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
            selectedServiceIds
          )
        : [],
    [rawSlots, selectedSlot, selectedServiceIds, staffLookup]
  );
  const selectedStaffForBooking = useMemo(
    () => {
      // Specific provider chosen — validate they are still available at this slot.
      if (selectedStaff !== "auto") {
        return availableStaffAtSlot.some((s) => s.staff_id === selectedStaff)
          ? selectedStaff
          : "auto";
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
            imageUrl: s.imageUrl ?? null,
            imageAlt: s.imageAlt ?? null,
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
        setStaffLookup(nextStaffLookup);
        setBookingRules((data.bookingRules ?? null) as BranchBookingRules | null);
        setLoadingServices(false);
      })
      .catch(() => {
        setBookingRules(null);
        setStaffLookup(new Map());
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
    // Guard: reject if the selected slot has already passed in the branch
    // timezone. This catches stale selections where the customer loaded the
    // page, waited, and the chosen slot expired before they submitted.
    if (
      isPastSlot({
        selectedDate: toLocalYmd(selectedDate),
        slotStartTime: selectedSlot.slot_time,
        timezone: BRANCH_TIMEZONE,
      })
    ) {
      setSelectedSlot(null);
      setFormError(
        "That time has already passed. Please select a later time."
      );
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
    <div
      className={
        mode === "public"
          ? "public-booking-surface min-h-screen w-full max-w-full overflow-x-hidden pt-14 text-[#F6EBD6] md:pt-0"
          : ""
      }
      style={{ background: mode === "public" ? BOOKING_PAGE_BACKGROUND : "transparent" }}
    >
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
                background: BOOKING_HERO_OVERLAY,
              }}
            />
          </div>
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <p
              className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-3"
              style={WARM_LABEL_STYLE}
            >
              Book Your Pause
            </p>
            <h1
              className="text-3xl sm:text-4xl font-medium"
              style={WARM_HEADING_STYLE}
            >
              Choose your care
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-6" style={WARM_BODY_STYLE}>
              Select your branch, treatment, time, and details. We&apos;ll guide you gently.
            </p>
          </div>
        </div>
      )}

      <div
        className={
          mode === "public"
            ? isTherapistStep
              ? "mx-auto w-full max-w-full overflow-x-hidden px-4 pb-32 pt-7 md:max-w-7xl md:px-8 md:py-10 md:overflow-visible lg:py-12"
              : "mx-auto w-full max-w-full overflow-x-hidden px-4 pb-32 pt-7 md:max-w-5xl md:px-6 md:py-10 md:overflow-visible lg:py-14"
            : "mx-auto max-w-6xl py-2"
        }
      >
        {mode === "public" && currentStepName !== "success" && (
          <div className="mb-6 text-left md:hidden">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4B57A]">
              Book Your Pause
            </p>
            <h1 className="text-[32px] font-medium leading-none text-[#F6EBD6] [font-family:var(--sp-font-display)]">
              Choose your care
            </h1>
            <p className="mt-3 max-w-[320px] text-[13px] leading-6 text-[#F6EBD6]/72">
              Select your branch, treatment, time, and details. We&apos;ll guide you gently.
            </p>
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
                        mobileProgressIndex > index ? "bg-[#D4B57A]" : "bg-[#D4B57A]/22"
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      mobileProgressIndex >= index
                        ? "border-[#D4B57A] bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] text-[#031B16] shadow-[0_8px_22px_rgba(212,181,122,0.24)]"
                        : "border-[#D4B57A]/28 bg-[#05241D]/70 text-[#F6EBD6]/45 backdrop-blur"
                    }`}
                  >
                    {mobileProgressIndex > index ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span
                    className={`mt-2 text-center text-[9.5px] font-medium leading-3 ${
                      mobileProgressIndex >= index ? "text-[#F6EBD6]" : "text-[#F6EBD6]/45"
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
                          ? "border border-[#D4B57A]/45 bg-[#05241D] text-[#D4B57A]"
                          : step === s.id
                          ? "bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] text-[#031B16]"
                          : "border border-[#D4B57A]/22 bg-[#05241D]/70 text-[#F6EBD6]/42"
                      }`}
                    >
                      {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
                    </div>
                    <span
                      className={`hidden sm:block text-[10px] mt-1.5 font-medium ${
                        step >= s.id ? "text-[#F6EBD6]" : "text-[#F6EBD6]/42"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-4 sm:w-8 lg:w-12 h-0.5 rounded-full mb-4 sm:mb-3 transition-colors duration-300 ${
                        step > s.id ? "bg-[#D4B57A]" : "bg-[#D4B57A]/20"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="grid min-w-0 gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="min-w-0 lg:col-span-2">
            {currentStepName === "branch" && (
              <StepBranches
                branches={branches}
                loading={loadingBranches}
                selected={selectedBranch}
                mode={mode}
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
                theme={mode === "public" ? "warm" : "default"}
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
                selectedSlot={selectedSlot}
                selected={selectedStaffForBooking}
                onSelect={setSelectedStaff}
                selectedServices={selectedServices}
                totalDuration={totalDuration}
                totalPrice={totalPrice}
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
                    ? isTherapistStep
                      ? "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#D4B57A]/25 bg-[#031B16]/82 px-4 py-3 shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl md:relative md:mt-8 md:border-t md:bg-transparent md:px-0 md:pt-6 md:shadow-none md:backdrop-blur-0"
                      : "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#D4B57A]/25 bg-[#031B16]/82 px-4 py-3 shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl md:static md:mt-10 md:border-t md:bg-transparent md:px-0 md:pt-8 md:shadow-none md:backdrop-blur-0"
                    : "flex items-center justify-between mt-10 pt-8 border-t border-[#EDE4D3]"
                }
                style={{ paddingBottom: mode === "public" ? "max(0.75rem, env(safe-area-inset-bottom))" : undefined }}
              >
                <button
                  onClick={handleBack}
                  disabled={currentStepName === "branch"}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-[#D4B57A]/35 bg-[#031B16]/50 px-4 text-[13px] font-medium text-[#F6EBD6] transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:border-[#D4B57A]/60 md:bg-transparent"
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
                      isTherapistStep
                        ? canClickContinue
                          ? `${WARM_PRIMARY_BUTTON_CLS} md:absolute md:left-1/2 md:min-w-[280px] md:-translate-x-1/2`
                          : `${WARM_DISABLED_BUTTON_CLS} md:absolute md:left-1/2 md:min-w-[280px] md:-translate-x-1/2`
                        : canClickContinue
                          ? WARM_PRIMARY_BUTTON_CLS
                          : WARM_DISABLED_BUTTON_CLS,
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
                        ? WARM_PRIMARY_BUTTON_CLS
                        : WARM_DISABLED_BUTTON_CLS,
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
                variant={isTherapistStep ? "therapist" : "default"}
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D4B57A]/25 bg-[#05241D]/70">
        <Icon className="h-4 w-4 text-[#D4B57A]" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide" style={WARM_LABEL_STYLE}>
          {label}
        </p>
        <p className="text-[13px] font-medium mt-0.5" style={value ? WARM_BODY_STYLE : WARM_MUTED_STYLE}>
          {value || placeholder}
        </p>
        {sub && <p className="text-[11px] mt-0.5" style={WARM_MUTED_STYLE}>{sub}</p>}
      </div>
    </div>
  );
}

function TherapistSummaryItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-[#D4B57A]/16 py-4 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4B57A]/22 bg-[#05241D]/70">
        <Icon className="h-[18px] w-[18px] text-[#D4B57A]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={WARM_LABEL_STYLE}>
          {label}
        </p>
        <div className="mt-1 text-[14px] font-semibold leading-5" style={WARM_BODY_STYLE}>
          {children}
        </div>
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
  variant = "default",
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
  variant?: "default" | "therapist";
}) {
  const selectedStaffOption =
    selectedStaff === "auto"
      ? null
      : availableStaff.find((s) => s.staff_id === selectedStaff) ?? null;
  const staffLabel =
    selectedStaff === "auto"
      ? "Any available provider"
      : selectedStaffOption?.staff_full_name ?? selectedStaffOption?.staff_name;
  const staffSubLabel =
    selectedStaffOption && staffLabel
      ? `${selectedStaffOption.staff_nickname?.trim() || getTherapistInitials(staffLabel)} · Available at ${selectedSlot ? formatTime(selectedSlot.slot_time) : "selected time"}`
      : undefined;
  const visitOption = VISIT_TYPE_OPTIONS[visitType];
  const availability = getVisitTypeAvailability(visitType, bookingRules);
  const dateTimeLabel =
    selectedDate && selectedSlot
      ? `${selectedDate.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })} at ${formatTime(selectedSlot.slot_time)}`
      : undefined;

  if (variant === "therapist") {
    return (
      <div className="sticky top-24">
        <div className={`rounded-[20px] p-6 ${WARM_GLASS_PANEL_CLS}`}>
          <h3
            className="text-[21px] font-medium"
            style={WARM_HEADING_STYLE}
          >
            Booking Summary
          </h3>

          <div className="mt-5">
            <TherapistSummaryItem icon={Building} label="Branch">
              {branch?.name ?? <span className="font-medium text-[#F6EBD6]/45">Not selected</span>}
            </TherapistSummaryItem>
            <TherapistSummaryItem icon={visitType === "home_service" ? Home : User} label="Visit Type">
              <p>{visitOption.label}</p>
              <p className="mt-1 text-[12px] font-medium" style={WARM_MUTED_STYLE}>
                {formatTime(availability.startTime)} - {formatTime(availability.endTime)}
              </p>
            </TherapistSummaryItem>
            <TherapistSummaryItem icon={Sparkles} label={services.length === 1 ? "Service" : "Services"}>
              {services.length === 0 ? (
                <span className="font-medium text-[#F6EBD6]/45">Not selected</span>
              ) : (
                <>
                  {services.map((s) => (
                    <p key={s.id}>{s.name}</p>
                  ))}
                  <p className="mt-2 text-[12px] font-semibold" style={WARM_LABEL_STYLE}>
                    {totalDuration} min · {formatCurrency(totalPrice)}
                  </p>
                </>
              )}
            </TherapistSummaryItem>
            <TherapistSummaryItem icon={CalendarDays} label="Date & Time">
              {dateTimeLabel ?? <span className="font-medium text-[#F6EBD6]/45">Not selected</span>}
            </TherapistSummaryItem>
            <TherapistSummaryItem icon={User} label="Therapist">
              {staffLabel ?? <span className="font-medium text-[#F6EBD6]/45">Not selected</span>}
              {staffSubLabel ? (
                <p className="mt-1 text-[12px] font-medium text-[#F6EBD6]/60">
                  {staffSubLabel}
                </p>
              ) : null}
            </TherapistSummaryItem>
          </div>

          <div className="mt-6 flex gap-4 rounded-xl border border-[#D4B57A]/25 bg-[#05241D]/58 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4B57A]/30 bg-[#031B16]/48 text-[#D4B57A] shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p
                className="text-[14px] font-semibold"
                style={WARM_HEADING_STYLE}
              >
                Your booking is safe with us
              </p>
              <p className="mt-2 text-[13px] leading-6" style={WARM_BODY_STYLE}>
                We never share your personal information with third parties.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px]" style={WARM_MUTED_STYLE}>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#B68A3C]" />
            Secure booking
          </span>
          <span className="text-[#C8A96B]">•</span>
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole className="h-3.5 w-3.5 text-[#B68A3C]" />
            No hidden fees
          </span>
          <span className="text-[#C8A96B]">•</span>
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5 text-[#B68A3C]" />
            100% secure
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`sticky top-28 rounded-2xl p-6 ${WARM_GLASS_PANEL_CLS}`}
    >
      <h3
        className="text-[14px] font-semibold mb-5"
        style={WARM_HEADING_STYLE}
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D4B57A]/25 bg-[#05241D]/70">
            <Clock className="h-4 w-4 text-[#D4B57A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={WARM_LABEL_STYLE}>
              Services
            </p>
            {services.length === 0 ? (
              <p className="text-[13px] font-medium mt-0.5" style={WARM_MUTED_STYLE}>
                Not selected
              </p>
            ) : (
              <>
                {services.map((s) => (
                  <p key={s.id} className="text-[13px] font-medium mt-0.5" style={WARM_BODY_STYLE}>
                    {s.name}
                  </p>
                ))}
                <p className="text-[11px] mt-1.5 font-medium" style={WARM_LABEL_STYLE}>
                  {totalDuration} min · {formatCurrency(totalPrice)}
                </p>
              </>
            )}
          </div>
        </div>

        <SummaryRow
          icon={CalendarDays}
          label="Date & Time"
          value={dateTimeLabel}
          placeholder="Not selected"
        />
        <SummaryRow
          icon={User}
          label="Therapist"
          value={staffLabel}
          placeholder="Not selected"
          sub={staffSubLabel}
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
  mode,
  onSelect,
}: {
  branches: Branch[];
  loading: boolean;
  selected: Branch | null;
  mode: BookingWizardMode;
  onSelect: (b: Branch) => void;
}) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className={
              mode === "public"
                ? `h-28 rounded-xl ${WARM_SKELETON_CLS}`
                : "h-28 rounded-xl"
            }
          />
        ))}
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[15px] font-medium" style={WARM_HEADING_STYLE}>
          No branches available
        </p>
        <p className="text-[13px] mt-2" style={WARM_MUTED_STYLE}>
          Please check back soon or contact us directly.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2
        className="mb-2 text-[18px] font-semibold md:text-2xl md:font-medium"
        style={WARM_HEADING_STYLE}
      >
        Select Branch
      </h2>
      <p className="mb-5 text-[13px] leading-6 md:mb-8 md:text-[14px]" style={WARM_BODY_STYLE}>
        Please choose the branch where you would like to book.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {branches.map((branch, index) => (
          <button
            key={branch.id}
            onClick={() => onSelect(branch)}
            className={`grid grid-cols-[84px_1fr_auto] gap-3 rounded-[10px] border p-3 text-left transition-all duration-300 md:flex md:items-start md:gap-4 md:rounded-xl md:p-5 ${
              selected?.id === branch.id
                ? WARM_SELECTED_CARD_CLS
                : WARM_IDLE_CARD_CLS
            }`}
          >
            <div className="relative h-[92px] overflow-hidden rounded-[7px] bg-[#05241D] md:hidden">
              <Image
                src={index % 2 === 0 ? SPA_IMAGES.contact : SPA_IMAGES.booking}
                alt={`${branch.name} branch`}
                fill
                className="object-cover"
                sizes="84px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#031B16]/68 via-transparent to-transparent" />
            </div>
            <div
              className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg md:flex ${
                selected?.id === branch.id
                  ? "border border-[#D4B57A]/35 bg-[#031B16]/70 text-[#D4B57A]"
                  : "border border-[#D4B57A]/20 bg-[#05241D]/70 text-[#D4B57A]"
              }`}
            >
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-[#D4B57A]/25 bg-[#031B16]/60 px-2 py-1 text-[10px] font-semibold text-[#D4B57A] md:hidden">
                Services vary by branch
              </span>
              <p className="text-[14px] font-semibold" style={WARM_HEADING_STYLE}>
                {branch.name}
              </p>
              {branch.address && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 md:text-[12px]" style={WARM_MUTED_STYLE}>
                  {branch.address}
                </p>
              )}
              <p className="mt-2 text-[10.5px] text-[#F6EBD6]/58 md:hidden">
                Open daily · 10:00 AM - 10:00 PM
              </p>
            </div>
            <div className="flex items-center justify-center self-center md:hidden">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                  selected?.id === branch.id
                    ? "border-[#D4B57A] bg-[#D4B57A] text-[#031B16]"
                    : "border-[#D4B57A]/30 bg-[#031B16]/40 text-transparent"
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
        style={WARM_HEADING_STYLE}
      >
        Choose Visit Type
      </h2>
      <p className="text-[14px] mb-8" style={WARM_BODY_STYLE}>
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
                  ? WARM_SELECTED_CARD_CLS
                  : isEnabled
                    ? WARM_IDLE_CARD_CLS
                    : "cursor-not-allowed border-[#D4B57A]/12 bg-[#05241D]/32 opacity-55"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                  isSelected
                    ? "border border-[#D4B57A]/40 bg-[#031B16]/70 text-[#D4B57A]"
                    : "border border-[#D4B57A]/22 bg-[#05241D]/70 text-[#D4B57A]"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold" style={WARM_HEADING_STYLE}>
                    {option.label}
                  </p>
                  {isSelected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D4B57A] shrink-0">
                      <Check className="h-3.5 w-3.5 text-[#031B16]" />
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-1" style={WARM_BODY_STYLE}>
                  {isEnabled ? option.description : "Not available for this branch."}
                </p>
                <p className="text-[11px] mt-3 font-medium" style={WARM_LABEL_STYLE}>
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
        style={WARM_HEADING_STYLE}
      >
        Select Date & Time
      </h2>
      <p className="text-[14px] mb-8" style={WARM_BODY_STYLE}>
        Choose your preferred date and an available start time.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={WARM_LABEL_STYLE}>
            Date
          </p>
          <div
            className={
              mode === "public"
                ? `overflow-x-auto flex justify-center rounded-xl p-3 md:justify-start ${WARM_GLASS_PANEL_CLS}`
                : "rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-3 overflow-x-auto flex justify-center md:justify-start backdrop-blur-xl"
            }
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onSelectDate}
              disabled={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                return d < today || d > maxDate;
              }}
              className={
                mode === "public"
                  ? "rounded-md bg-transparent p-0 text-[#F6EBD6] [--cell-radius:0.65rem] [--cell-size:2.25rem] sm:[--cell-size:2.5rem] [&_.rdp-chevron]:text-[#D4B57A]"
                  : "rounded-md"
              }
              classNames={
                mode === "public" ? BOOKING_CALENDAR_CLASSNAMES : undefined
              }
            />
          </div>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={WARM_LABEL_STYLE}>
            Available Times
          </p>
          <p className="text-[12px] mb-3" style={WARM_MUTED_STYLE}>
            {visitOption.label}: {formatTime(availability.startTime)} - {formatTime(availability.endTime)}
          </p>
          {serviceCount === 0 ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50"
            >
              <p className="text-[13px]" style={WARM_MUTED_STYLE}>
                Choose a service to see available times.
              </p>
            </div>
          ) : !selectedDate ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50"
            >
              <p className="text-[13px]" style={WARM_MUTED_STYLE}>
                Choose a date to see available times.
              </p>
            </div>
          ) : loading ? (
            <div>
              <p className="mb-3 text-[13px]" style={WARM_MUTED_STYLE}>
                Checking available times...
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className={
                      mode === "public"
                        ? `h-10 rounded-lg ${WARM_SKELETON_CLS}`
                        : "h-10 rounded-lg"
                    }
                  />
                ))}
              </div>
            </div>
          ) : availableSlots.length === 0 ? (
            <div
              className="flex items-center justify-center h-48 rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50 px-5 text-center"
            >
              <p className="text-[13px]" style={WARM_MUTED_STYLE}>
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
                        ? "bg-[#D4B57A] text-[#031B16] shadow-[0_12px_28px_rgba(212,181,122,0.22)]"
                        : isHard
                        ? "cursor-not-allowed border border-[#D4B57A]/12 bg-[#05241D]/35 text-[#F6EBD6]/35 opacity-50"
                        : isWarning
                        ? "border border-[#D4B57A]/38 bg-[#B88945]/16 text-[#F6EBD6] hover:border-[#D4B57A]/65"
                        : "border border-[#D4B57A]/25 bg-[#0D2B20]/62 text-[#F6EBD6] hover:border-[#D4B57A]/60"
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

function StepTherapist({
  availableStaff,
  selectedSlot,
  selected,
  onSelect,
  selectedServices,
  totalDuration,
  totalPrice,
}: {
  availableStaff: StaffOption[];
  selectedSlot: Slot | null;
  selected: "auto" | string;
  onSelect: (choice: "auto" | string) => void;
  selectedServices: Service[];
  totalDuration: number;
  totalPrice: number;
}) {
  const slotLabel = selectedSlot ? formatTime(selectedSlot.slot_time) : "selected time";
  const pickerOptions = buildTherapistPickerOptions(availableStaff, slotLabel);

  return (
    <TherapistSelectionStep
      options={pickerOptions}
      value={selected}
      onValueChange={onSelect}
      serviceCount={selectedServices.length}
      totalDuration={totalDuration}
      totalPriceLabel={formatCurrency(totalPrice)}
    />
  );
}

// ── Shared input style ─────────────────────────────────────────────────────────
const INPUT_CLS = "w-full rounded-xl border border-[#D4B57A]/25 bg-[#05241D]/70 px-4 py-3 text-[14px] text-[#F6EBD6] placeholder:text-[#F6EBD6]/45 outline-none transition-all focus:border-[#D4B57A]/75 focus:ring-2 focus:ring-[#D4B57A]/25";
const PUBLIC_INPUT_CLS = "w-full rounded-xl border border-[#D4B57A]/25 bg-[#05241D]/75 px-4 py-3 text-[14px] text-[#F6EBD6] placeholder:text-[#F6EBD6]/45 outline-none transition-all selection:bg-[#D4B57A]/30 focus:border-[#D4B57A]/75 focus:ring-2 focus:ring-[#D4B57A]/20";
const LABEL_CLS = "flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2 text-[#D4B57A]";

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
  const fieldClassName = mode === "public" ? PUBLIC_INPUT_CLS : INPUT_CLS;
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
        style={WARM_HEADING_STYLE}
      >
        Your Location
      </h2>
      <p className="text-[14px] mb-8" style={WARM_BODY_STYLE}>
        Search and select your exact location so our therapist and driver can find you easily.
      </p>

      <div className="flex flex-col gap-5">
        {!showCustomerCompactLocation && (
          <div>
            <label htmlFor="hs-zone" className={LABEL_CLS}>
              <MapPin className="h-3.5 w-3.5" />
              Location Zone *
            </label>
            <select
              id="hs-zone"
              value={form.hsZone}
              onChange={(event) => onChange({ ...form, hsZone: event.target.value })}
              className={fieldClassName}
            >
              <option value="" disabled>Select your zone...</option>
              {HS_ZONE_OPTIONS.filter((option) => option.value !== "unknown").map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] mt-1" style={WARM_MUTED_STYLE}>
              Helps us verify we have a driver available in your area before you pick a time.
            </p>
          </div>
        )}

        <div>
          {!preciseLocationSelected ? (
            <>
              <label htmlFor="hs-address-location" className={LABEL_CLS}>
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
                className={fieldClassName}
                theme="warm"
                ariaDescribedBy={helperId}
              />
              <p id={helperId} className="text-[11px] mt-1" style={WARM_MUTED_STYLE}>
                Choose a Google suggestion; typed text alone is not enough for routing.
              </p>
            </>
          ) : (
            <div
              className="flex items-start gap-3 rounded-xl border border-[#D4B57A]/28 bg-[#0D2B20]/65 px-4 py-3 backdrop-blur-xl"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4B57A]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4B57A]">
                  Selected location
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-[#F6EBD6]">
                  {form.hsFormattedAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(clearSelectedPlace(form, ""))}
                className="rounded-full border border-[#D4B57A]/35 bg-[#031B16]/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#D4B57A] transition-colors hover:border-[#D4B57A]/70"
              >
                Change
              </button>
            </div>
          )}

          {statusMessage && (
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-[12px] ${
                placesStatus === "loading"
                  ? "border border-[#D4B57A]/20 bg-[#05241D]/58 text-[#F6EBD6]/70"
                  : "border border-[#D4B57A]/30 bg-[#B88945]/14 text-[#F6EBD6]"
              }`}
            >
              {statusMessage}
            </p>
          )}

          {showSelectionError && (
            <p className="mt-2 rounded-lg border border-red-300/25 bg-red-950/30 px-3 py-2 text-[12px] font-medium text-red-100">
              {PRECISE_LOCATION_ERROR}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="hs-delivery-notes" className={LABEL_CLS}>
            Delivery notes{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="hs-delivery-notes"
            value={form.hsParkingNotes}
            onChange={(event) => onChange({ ...form, hsParkingNotes: event.target.value })}
            placeholder="House number, unit, gate color, landmark, parking instructions..."
            rows={3}
            className={`${fieldClassName} resize-none`}
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
  const fieldClassName = mode === "public" ? PUBLIC_INPUT_CLS : INPUT_CLS;

  return (
    <div>
      <h2
        className="text-2xl font-medium mb-2"
        style={WARM_HEADING_STYLE}
      >
        Your Details
      </h2>
      <p className="text-[14px] mb-8" style={WARM_BODY_STYLE}>
        Please provide your contact information to complete the booking.
      </p>

      <div className="flex flex-col gap-5">
        {/* Contact info */}
        <div>
          <label className={LABEL_CLS}>
            <User className="h-3.5 w-3.5" />
            Full Name *
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => onChange({ ...form, fullName: e.target.value })}
            placeholder="Enter your full name"
            className={fieldClassName}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            <Phone className="h-3.5 w-3.5" />
            Phone Number *
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value })}
            placeholder="e.g. 0917 123 4567"
            className={fieldClassName}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            <Mail className="h-3.5 w-3.5" />
            Email{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="your@email.com"
            className={fieldClassName}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            <FileText className="h-3.5 w-3.5" />
            Notes{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            placeholder="Share any comfort notes or special requests."
            rows={3}
            className={`${fieldClassName} resize-none`}
          />
        </div>

        {/* CRM In-House Payment Capture */}
        {mode === "inhouse" && (
          <div
            className="flex flex-col gap-4 rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-5 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4" style={WARM_LABEL_STYLE} />
              <p className="text-[13px] font-semibold" style={WARM_HEADING_STYLE}>
                Payment
              </p>
              <span
                className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "rgba(212,181,122,0.14)", color: "#D4B57A" }}
              >
                Required
              </span>
            </div>
            <p className="text-[12px] -mt-2" style={WARM_BODY_STYLE}>
              Record the customer&apos;s payment before finalizing this in-house booking.
            </p>

            <div>
              <label className={LABEL_CLS}>
                Payment method *
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => onChange({ ...form, paymentMethod: e.target.value })}
                className={fieldClassName}
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
              <label className={LABEL_CLS}>
                Reference / receipt no.{" "}
                <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.paymentReference}
                onChange={(e) => onChange({ ...form, paymentReference: e.target.value })}
                placeholder="e.g. GCash ref #, receipt number"
                className={fieldClassName}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>
                Payment note{" "}
                <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={form.paymentNote}
                onChange={(e) => onChange({ ...form, paymentNote: e.target.value })}
                placeholder="Internal note about this payment…"
                rows={2}
                className={`${fieldClassName} resize-none`}
              />
            </div>
          </div>
        )}

        {/* Home Service Address */}
        {isHomeService && (
          <div
            className="flex flex-col gap-4 rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-5 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4" style={WARM_LABEL_STYLE} />
              <p className="text-[13px] font-semibold" style={WARM_HEADING_STYLE}>
                Home Service Address
              </p>
              <span
                className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "rgba(212,181,122,0.14)", color: "#D4B57A" }}
              >
                Required
              </span>
            </div>
            <p className="text-[12px] -mt-2" style={WARM_BODY_STYLE}>
              We will use the selected Google location from the Location step for dispatch and routing.
            </p>

            {mode === "inhouse" && (
              <div className="flex items-center gap-2 rounded-xl border border-[#D4B57A]/22 bg-[#05241D]/58 px-4 py-3">
                <MapPin className="h-4 w-4 shrink-0" style={WARM_LABEL_STYLE} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={WARM_LABEL_STYLE}>Zone</p>
                  <p className="text-[13px] font-medium" style={WARM_BODY_STYLE}>
                    {HS_ZONE_OPTIONS.find((o) => o.value === form.hsZone)?.label ?? form.hsZone}
                  </p>
                </div>
              </div>
            )}

            {isPreciseHomeServiceLocation(form) ? (
              <div
                className="flex items-start gap-3 rounded-xl border border-[#D4B57A]/22 bg-[#05241D]/58 px-4 py-3"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4B57A]" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4B57A]">
                    Selected location
                  </p>
                  <p className="mt-0.5 text-[13px] leading-5" style={WARM_BODY_STYLE}>
                    {form.hsFormattedAddress}
                  </p>
                  <p className="mt-1 text-[11px]" style={WARM_MUTED_STYLE}>
                    Place ID captured for routing.
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-red-300/25 bg-red-950/30 px-4 py-3 text-[13px] font-medium text-red-100">
                {PRECISE_LOCATION_ERROR}
              </p>
            )}

            {form.hsAddressDetails && (
              <div className="rounded-xl border border-[#D4B57A]/22 bg-[#05241D]/58 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={WARM_LABEL_STYLE}>
                  House / Unit Details
                </p>
                <p className="mt-0.5 text-[13px]" style={WARM_BODY_STYLE}>
                  {form.hsAddressDetails}
                </p>
              </div>
            )}

            {mode === "inhouse" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>
                    Barangay *
                  </label>
                  <input
                    type="text"
                    value={form.hsBarangay}
                    onChange={(event) => onChange({ ...form, hsBarangay: event.target.value })}
                    placeholder="e.g. Brgy. San Antonio"
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    City / Municipality *
                  </label>
                  <input
                    type="text"
                    value={form.hsCity}
                    onChange={(event) => onChange({ ...form, hsCity: event.target.value })}
                    placeholder="e.g. Bacolod City"
                    className={fieldClassName}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-5 rounded-lg border border-red-300/25 bg-red-950/30 px-4 py-3 text-[13px] font-medium text-red-100">
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
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#D4B57A]/40 bg-[#0D2B20]/72 text-[#D4B57A] shadow-[0_20px_54px_rgba(0,0,0,0.32)]">
        <Check className="h-10 w-10" />
      </div>
      <h2
        className="text-2xl sm:text-3xl font-medium mb-3"
        style={WARM_HEADING_STYLE}
      >
        {mode === "inhouse" ? "Booking Saved" : "Your calm is booked"}
      </h2>
      <p className="text-[15px] max-w-md mx-auto mb-6" style={WARM_BODY_STYLE}>
        {mode === "inhouse"
          ? "The appointment has been saved and confirmed in the CRM workspace."
          : "We can't wait to care for you. Our CRM team will contact you shortly to confirm your payment and finalize your appointment."}
      </p>

      {mode === "public" && (
        <div
          className="mx-auto mb-6 max-w-md rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 px-5 py-4 text-left backdrop-blur-xl"
        >
          <p className="text-[12px] font-semibold uppercase tracking-wide" style={WARM_LABEL_STYLE}>
            Next step
          </p>
          <p className="mt-1 text-[13px] leading-6" style={WARM_BODY_STYLE}>
            Wait for our CRM confirmation. We are temporarily holding your selected time while we process your request, so please keep your phone nearby.
          </p>
        </div>
      )}

      {/* Service list recap */}
      {services.length > 0 && (
        <div
          className="mb-6 inline-flex flex-col items-start gap-1.5 rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 px-6 py-4 text-left backdrop-blur-xl"
        >
          {services.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0" style={WARM_LABEL_STYLE} />
              <span className="text-[13px] font-medium" style={WARM_BODY_STYLE}>
                {s.name}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className="mb-8 inline-flex items-center gap-3 rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 px-6 py-4 backdrop-blur-xl"
      >
        <span className="text-[12px] font-medium uppercase tracking-wide" style={WARM_LABEL_STYLE}>
          Booking ID
        </span>
        <span className="text-[14px] font-semibold font-mono" style={WARM_BODY_STYLE}>
          {bookingId.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <p className="text-[12px]" style={WARM_MUTED_STYLE}>
        {mode === "inhouse"
          ? "You can view or adjust this booking anytime from the bookings workspace."
          : "Your request is with our CRM team. If you need to make any changes, please call us directly."}
      </p>

      {mode === "public" && (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D4B57A]/35 bg-[#031B16]/48 px-5 text-[13px] font-semibold text-[#F6EBD6] transition-colors hover:border-[#D4B57A]/70"
          >
            Back to home
          </Link>
          <Link
            href="/book"
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[13px] font-semibold transition-opacity hover:opacity-90 ${WARM_PRIMARY_BUTTON_CLS}`}
          >
            Book another service
          </Link>
        </div>
      )}
    </div>
  );
}
