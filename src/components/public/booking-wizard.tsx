"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useId,
  type RefObject,
  type ReactNode,
} from "react";
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
  X,
  Users,
  Gift,
  Plus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createOnlineBookingMultiAction } from "@/lib/actions/online-booking";
import { createInhouseBookingMultiAction } from "@/lib/actions/inhouse-booking";
import { validateBookingDraft } from "@/lib/bookings/booking-wizard-validation";
import type { BookingForChoice, BookingPaymentChoice } from "@/lib/bookings/booking-order-contract";
import {
  PlacesAutocomplete,
  type GoogleAddressComponent,
  type PlaceSelectResult,
  type PlacesAutocompleteStatus,
} from "@/components/public/places-autocomplete";
import { TherapistSelectionStep } from "@/components/features/booking/therapist-picker/therapist-selection-step";
import { TherapistDropdownPicker } from "@/components/features/booking/therapist-picker/therapist-dropdown-picker";
import {
  buildTherapistPickerOptions,
  getTherapistInitials,
} from "@/components/features/booking/therapist-picker/therapist-picker-utils";
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
  type BookingType,
  type BookingWizardMode,
  type VisitType,
} from "@/lib/bookings/visit-type-availability";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";
import {
  getOrCreateCheckoutAttemptId,
  resetCheckoutAttemptId,
} from "@/lib/bookings/bkg3-atomic-contract";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
};

type Service = BookingWizardService;

type WizardAttendee = {
  id: string;
  name: string;
  isOrganizer: boolean;
  serviceIds: string[];
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
  staff_full_name?: string | null;
  staff_nickname?: string | null;
  staff_avatar_url?: string | null;
  staff_tier: string;
  staff_type?: string;
  staff_schedule_available?: boolean;
};

type StaffLookup = {
  name: string | null;
  fullName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  staffType: string | null;
  tier: string;
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
  bookingMode?: "automatic" | "consultation";
  consultationMessage?: string | null;
};

type BookingContextStaff = {
  id: string;
  name?: string | null;
  fullName?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  staffType?: string | null;
  tier?: string;
  serviceIds?: string[];
};

type InitialCustomer = {
  fullName: string;
  phone: string;
  email: string | null;
};

const STEPS_BASE = [
  { id: 1, name: "branch", label: "Branch" },
  { id: 2, name: "visit", label: "Visit Type" },
  { id: 3, name: "services", label: "Services" },
  { id: 4, name: "date_time", label: "Date & Time" },
  { id: 5, name: "therapist", label: "Therapist" },
  { id: 6, name: "details", label: "Details" },
];

const STEPS_HS = [
  { id: 1, name: "branch", label: "Branch" },
  { id: 2, name: "visit", label: "Visit Type" },
  { id: 3, name: "services", label: "Services" },
  { id: 4, name: "location", label: "Location" },
  { id: 5, name: "date_time", label: "Date & Time" },
  { id: 6, name: "therapist", label: "Therapist" },
  { id: 7, name: "details", label: "Details" },
];

const MOBILE_PROGRESS_STEPS = ["Branch", "Service", "Date & Time", "Details", "Confirm"] as const;
const PRECISE_LOCATION_ERROR =
  "Please select your address from the Google suggestions so our therapist and driver can find you accurately.";
const DEFAULT_STAFF_PREFERENCE = "auto" as const;
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
const WARM_DISABLED_BUTTON_CLS = "border border-[#D4B57A]/18 bg-[#0A261E]/62 text-[#F6EBD6]/38";
const WARM_SKELETON_CLS = "bg-[#05241D]/65 after:via-[#D4B57A]/18";
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
  weekday: "flex-1 rounded-lg text-[0.8rem] font-medium text-[#F6EBD6]/58 select-none",
  week: "mt-2 flex w-full",
  month_grid: "w-full border-collapse",
  day: "group/day relative aspect-square h-full w-full rounded-lg p-0 text-center select-none",
  day_button:
    "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 rounded-lg border border-transparent bg-transparent text-[#F6EBD6] leading-none font-medium transition-colors hover:border-[#D4B57A]/55 hover:bg-[#05241D]/80 focus-visible:border-[#D4B57A]/75 focus-visible:ring-2 focus-visible:ring-[#D4B57A]/20 disabled:text-[#F6EBD6]/24 disabled:hover:border-transparent disabled:hover:bg-transparent data-[selected-single=true]:border-[#D4B57A] data-[selected-single=true]:bg-[#D4B57A] data-[selected-single=true]:text-[#031B16] data-[selected-single=true]:shadow-[0_0_22px_rgba(212,181,122,0.22)] data-[selected-single=true]:hover:bg-[#D4B57A]",
  today: "rounded-lg border border-[#D4B57A]/45 bg-[#05241D]/72 text-[#F6EBD6]",
  outside: "text-[#F6EBD6]/24 aria-selected:text-[#031B16]",
  disabled: "text-[#F6EBD6]/22 opacity-45",
  selected: "rounded-lg",
  hidden: "invisible",
};

function getSteps(isHomeService: boolean) {
  return isHomeService ? STEPS_HS : STEPS_BASE;
}

function getStepName(stepNum: number, isHomeService: boolean): string {
  return getSteps(isHomeService).find((s) => s.id === stepNum)?.name ?? "branch";
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

function formatSheetDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCompactDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isMobileBookingViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
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
  return Array.from(byTime.values()).sort((a, b) => a.slot_time.localeCompare(b.slot_time));
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

function staffQualifiedForSelectedServices(
  lookup: StaffLookup,
  selectedServiceIds: string[]
): boolean {
  return (
    lookup.isServiceProvider &&
    selectedServiceIds.length > 0 &&
    selectedServiceIds.every((serviceId) => lookup.serviceIds.includes(serviceId))
  );
}

function qualifiedStaffPreferenceOptions(
  staffLookup: Map<string, StaffLookup>,
  availableStaff: StaffOption[],
  selectedServiceIds: string[]
): StaffOption[] {
  const availableById = new Map(availableStaff.map((member) => [member.staff_id, member]));

  return Array.from(staffLookup.entries())
    .filter(([, lookup]) => staffQualifiedForSelectedServices(lookup, selectedServiceIds))
    .map(([staffId, lookup]) => {
      const available = availableById.get(staffId);
      const fullName = lookup.fullName ?? lookup.name ?? "Staff member";
      return {
        staff_id: staffId,
        staff_name: lookup.nickname ?? lookup.name ?? fullName,
        staff_full_name: fullName,
        staff_nickname: lookup.nickname,
        staff_avatar_url: lookup.avatarUrl,
        staff_tier: lookup.tier,
        staff_type: lookup.staffType ?? undefined,
        staff_schedule_available: Boolean(available),
      };
    })
    .sort((a, b) => {
      const availabilityDifference =
        Number(b.staff_schedule_available) - Number(a.staff_schedule_available);
      if (availabilityDifference !== 0) return availabilityDifference;
      const tierDifference = (TIER_ORDER[a.staff_tier] ?? 9) - (TIER_ORDER[b.staff_tier] ?? 9);
      return tierDifference !== 0 ? tierDifference : a.staff_name.localeCompare(b.staff_name);
    });
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
  const stepScrollRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const checkoutAttemptIdRef = useRef<string>(getOrCreateCheckoutAttemptId());

  useEffect(() => {
    // Sync with persistent sessionStorage attempt ID upon client hydration
    checkoutAttemptIdRef.current = getOrCreateCheckoutAttemptId();
  }, []);

  // Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rawSlots, setRawSlots] = useState<Slot[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingRules, setBookingRules] = useState<BranchBookingRules | null>(null);
  const [staffLookup, setStaffLookup] = useState<Map<string, StaffLookup>>(new Map());
  const [existingHsBookings, setExistingHsBookings] = useState<ExistingHsBooking[]>([]);
  const [hsDriverCapacity, setHsDriverCapacity] = useState(1);

  // Loading
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    bookingId: string;
    orderId?: string;
    orderNumber?: string;
    staffPreferenceNeedsConfirmation: boolean;
  } | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  // Selections
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<"auto" | string>(DEFAULT_STAFF_PREFERENCE);
  const [bookingType, setBookingType] = useState<BookingType>(
    // Seed from initialVisitType when provided (CRM walk-in / home-service routing).
    // Falls back to "in_spa" default — preserves existing public booking behavior.
    getBookingTypeForVisitType(initialVisitType ?? "in_spa", mode)
  );

  // Progressive Disclosure: Booking for & Attendees
  const [bookingFor, setBookingFor] = useState<BookingForChoice>("me");
  const [recipientName, setRecipientName] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<BookingPaymentChoice>("pay_later");
  const [attendees, setAttendees] = useState<WizardAttendee[]>([
    {
      id: "att-1",
      name: "Guest 1 (You)",
      isOrganizer: true,
      serviceIds: [],
    },
  ]);
  const [activeAttendeeId, setActiveAttendeeId] = useState<string>("att-1");

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
  const activeAttendee = useMemo(
    () => attendees.find((a) => a.id === activeAttendeeId) ?? attendees[0],
    [attendees, activeAttendeeId]
  );

  const activeServicesForPicker = useMemo(() => {
    if (bookingFor === "me_and_others" && activeAttendee) {
      return services.filter((s) => activeAttendee.serviceIds.includes(s.id));
    }
    return selectedServices;
  }, [bookingFor, activeAttendee, services, selectedServices]);

  const allSelectedServiceIds = useMemo(() => {
    if (bookingFor === "me_and_others") {
      return Array.from(new Set(attendees.flatMap((a) => a.serviceIds)));
    }
    return selectedServices.map((service) => service.id);
  }, [bookingFor, attendees, selectedServices]);

  const allSelectedServices = useMemo(() => {
    return services.filter((s) => allSelectedServiceIds.includes(s.id));
  }, [services, allSelectedServiceIds]);

  const totalDuration = useMemo(() => {
    if (bookingFor === "me_and_others") {
      return Math.max(
        ...attendees.map((att) =>
          att.serviceIds.reduce((sum, sId) => {
            const svc = services.find((s) => s.id === sId);
            return sum + (svc?.durationMinutes ?? 0);
          }, 0)
        ),
        0
      );
    }
    return selectedServices.reduce((s, svc) => s + svc.durationMinutes, 0);
  }, [bookingFor, attendees, services, selectedServices]);

  const totalPrice = useMemo(() => {
    if (bookingFor === "me_and_others") {
      return attendees.reduce((total, att) => {
        return (
          total +
          att.serviceIds.reduce((sum, sId) => {
            const svc = services.find((s) => s.id === sId);
            return sum + (svc?.price ?? 0);
          }, 0)
        );
      }, 0);
    }
    return selectedServices.reduce((s, svc) => s + svc.price, 0);
  }, [bookingFor, attendees, services, selectedServices]);

  const selectedServiceIds = allSelectedServiceIds;
  const selectedVisitType = useMemo(
    () => getVisitTypeForBookingType(bookingType, mode),
    [bookingType, mode]
  );
  const visitType = useMemo(
    () => (isVisitTypeEnabled(selectedVisitType, bookingRules) ? selectedVisitType : "in_spa"),
    [bookingRules, selectedVisitType]
  );
  const isHomeService = visitType === "home_service";
  const steps = useMemo(() => getSteps(isHomeService), [isHomeService]);
  const visibleSteps = mode === "public" ? steps.filter((item) => item.name !== "therapist") : steps;
  const currentStepName = useMemo(() => getStepName(step, isHomeService), [step, isHomeService]);
  const isTherapistStep = currentStepName === "therapist";
  const successStep = isHomeService ? 8 : 7;

  // Services filtered by visit type eligibility
  const eligibleServices = useMemo(
    () =>
      services.filter((svc) =>
        isHomeService ? (svc.availableHomeService ?? false) : (svc.availableInSpa ?? true)
      ),
    [services, isHomeService]
  );
  const availableStaffAtSlot = useMemo(
    () =>
      selectedSlot
        ? staffAtSlot(rawSlots, selectedSlot.slot_time, staffLookup, selectedServiceIds)
        : [],
    [rawSlots, selectedSlot, selectedServiceIds, staffLookup]
  );
  const staffPreferenceOptions = useMemo(
    () =>
      mode === "public"
        ? qualifiedStaffPreferenceOptions(staffLookup, availableStaffAtSlot, selectedServiceIds)
        : availableStaffAtSlot,
    [availableStaffAtSlot, mode, selectedServiceIds, staffLookup]
  );
  const selectedStaffForBooking = useMemo(() => {
    // Public manual choices are preferences: qualification is required, but
    // schedule conflicts are reviewed by CRM after the booking is received.
    if (selectedStaff !== "auto") {
      return staffPreferenceOptions.some((s) => s.staff_id === selectedStaff)
        ? selectedStaff
        : DEFAULT_STAFF_PREFERENCE;
    }
    return DEFAULT_STAFF_PREFERENCE;
  }, [selectedStaff, staffPreferenceOptions]);

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
          hsDriverCapacity
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
              : null) ??
            nextBranches[0] ??
            null;
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
        const svcs = ((data.services ?? []) as BookingContextService[])
          .filter((service) => mode === "inhouse" || service.bookingMode !== "consultation")
          .map((s) => ({
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
            bookingMode: s.bookingMode ?? "automatic",
            consultationMessage: s.consultationMessage ?? null,
          }));
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
            tier: member.tier ?? "therapist",
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
      .catch(() => {
        /* non-fatal — dispatch filter degrades to "ok" */
      });
  }, [isHomeService, selectedBranch, selectedDate]);

  // Fetch slots when branch + services + date are all selected
  useEffect(() => {
    const hasServicesSelected =
      bookingFor === "me_and_others"
        ? attendees.some((a) => a.serviceIds.length > 0)
        : selectedServices.length > 0;

    if (!selectedBranch || !hasServicesSelected || !selectedDate) {
      return;
    }
    const id = setTimeout(() => setLoadingSlots(true), 0);
    const dateStr = toLocalYmd(selectedDate);
    const params = new URLSearchParams({
      branchId: selectedBranch.id,
      date: dateStr,
      deliveryType: visitType,
    });

    if (bookingFor === "me_and_others") {
      const attendeePayload = attendees
        .filter((a) => a.serviceIds.length > 0)
        .map((a) => ({
          id: a.id,
          name: a.name,
          isOrganizer: a.isOrganizer,
          serviceIds: a.serviceIds,
        }));
      params.set("attendees", JSON.stringify(attendeePayload));
      params.set("serviceIds", allSelectedServiceIds.join(","));
    } else {
      params.set("serviceIds", selectedServices.map((s) => s.id).join(","));
    }

    fetch(`/api/booking/available-slots?${params.toString()}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error ?? "Unable to load branch services.");
        }
        return data;
      })
      .then((data) => {
        const all = (data.slots ?? []) as Slot[];
        const visitTypeSlots = filterSlotsByVisitType(all, visitType, bookingRules);
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
  }, [
    selectedBranch,
    selectedServices,
    selectedDate,
    visitType,
    bookingRules,
    bookingFor,
    attendees,
    allSelectedServiceIds,
  ]);

  const toggleService = useCallback(
    (svc: Service) => {
      if (bookingFor === "me_and_others") {
        setAttendees((prev) =>
          prev.map((att) => {
            if (att.id !== activeAttendeeId) return att;
            const exists = att.serviceIds.includes(svc.id);
            const nextServiceIds = exists
              ? att.serviceIds.filter((id) => id !== svc.id)
              : [...att.serviceIds, svc.id];
            return { ...att, serviceIds: nextServiceIds };
          })
        );
      } else {
        setSelectedServices((prev) => {
          const idx = prev.findIndex((s) => s.id === svc.id);
          const next = idx >= 0 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : [...prev, svc];
          setAttendees([
            {
              id: "att-1",
              name:
                bookingFor === "someone_else" ? recipientName || "Guest" : form.fullName || "Me",
              isOrganizer: bookingFor !== "someone_else",
              serviceIds: next.map((s) => s.id),
            },
          ]);
          return next;
        });
      }

      // Downstream state depends on service selection
      setRawSlots([]);
      setSlots([]);
      setSelectedSlot(null);
      setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
      setAvailabilityMessage("");
    },
    [bookingFor, activeAttendeeId, form.fullName, recipientName]
  );

  const handleBookingForChange = useCallback(
    (choice: BookingForChoice) => {
      setBookingFor(choice);
      if (choice === "me") {
        setAttendees([
          {
            id: "att-1",
            name: form.fullName || "Me",
            isOrganizer: true,
            serviceIds: selectedServices.map((s) => s.id),
          },
        ]);
        setActiveAttendeeId("att-1");
      } else if (choice === "someone_else") {
        setAttendees([
          {
            id: "att-1",
            name: recipientName || "Guest",
            isOrganizer: false,
            serviceIds: selectedServices.map((s) => s.id),
          },
        ]);
        setActiveAttendeeId("att-1");
      } else if (choice === "me_and_others") {
        setAttendees((prev) => {
          const firstServices = selectedServices.map((s) => s.id);
          const next: WizardAttendee[] = [
            {
              id: "att-1",
              name: form.fullName || "Guest 1 (You)",
              isOrganizer: true,
              serviceIds: prev[0]?.serviceIds?.length ? prev[0].serviceIds : firstServices,
            },
          ];
          if (prev.length > 1) {
            next.push(...prev.slice(1));
          } else {
            next.push({
              id: "att-2",
              name: "Guest 2",
              isOrganizer: false,
              serviceIds: [],
            });
          }
          return next;
        });
        setActiveAttendeeId("att-1");
      }
      setRawSlots([]);
      setSlots([]);
      setSelectedSlot(null);
      setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
    },
    [form.fullName, recipientName, selectedServices]
  );

  const handleAddAttendee = useCallback(() => {
    setAttendees((prev) => {
      if (prev.length >= 10) return prev;
      const nextNum = prev.length + 1;
      const nextId = `att-${Date.now()}-${nextNum}`;
      const next = [
        ...prev,
        {
          id: nextId,
          name: `Guest ${nextNum}`,
          isOrganizer: false,
          serviceIds: [],
        },
      ];
      setActiveAttendeeId(nextId);
      return next;
    });
    setRawSlots([]);
    setSlots([]);
    setSelectedSlot(null);
  }, []);

  const handleRemoveAttendee = useCallback(
    (idToRemove: string) => {
      setAttendees((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((a) => a.id !== idToRemove);
        if (activeAttendeeId === idToRemove) {
          setActiveAttendeeId(filtered[0]?.id ?? "att-1");
        }
        return filtered;
      });
      setRawSlots([]);
      setSlots([]);
      setSelectedSlot(null);
    },
    [activeAttendeeId]
  );

  const handleRenameAttendee = useCallback((idToRename: string, nextName: string) => {
    setAttendees((prev) => prev.map((a) => (a.id === idToRename ? { ...a, name: nextName } : a)));
  }, []);

  const handleVisitTypeSelect = useCallback(
    (nextVisitType: VisitType) => {
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
      setAttendees((prev) =>
        prev.map((att) => ({
          ...att,
          serviceIds: att.serviceIds.filter((sId) => {
            const svc = services.find((s) => s.id === sId);
            return nextVisitType === "home_service"
              ? (svc?.availableHomeService ?? false)
              : (svc?.availableInSpa ?? true);
          }),
        }))
      );
      setRawSlots([]);
      setSlots([]);
      setSelectedSlot(null);
      setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
      setAvailabilityMessage("");
      setExistingHsBookings([]);
      setHsDriverCapacity(1);
    },
    [bookingRules, mode, services]
  );

  useEffect(() => {
    if (mode === "public" && isMobileBookingViewport()) {
      stepScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mode, step]);

  const handleBack = useCallback(() => {
    if (currentStepName === "date_time") {
      setSelectedSlot(null);
      setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
    } else if (currentStepName === "therapist") {
      setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
    }
    setStep((s) => Math.max(1, s - (mode === "public" && currentStepName === "details" ? 2 : 1)));
  }, [currentStepName, mode]);

  const handleConfirmBooking = useCallback(async () => {
    if (isSubmittingRef.current || submitting) return;

    const validation = validateBookingDraft({
      selectedBranch,
      visitType,
      bookingRules,
      bookingFor,
      recipientName,
      attendees,
      allSelectedServiceIds,
      selectedDate: selectedDate ?? null,
      selectedSlot,
      form,
      mode,
      isHomeService,
      isOffline,
    });

    if (!validation.ok) {
      const message = validation.message || "Please check your booking details.";
      setFormError(message);
      toast.error("Please check your details", { description: message });

      if (validation.targetStep && validation.targetStep !== step) {
        setStep(validation.targetStep);
      } else {
        if (mode === "public" && isMobileBookingViewport()) {
          stepScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
      if (validation.focusField) {
        setTimeout(() => {
          const el = document.getElementById(`wizard-${validation.focusField}`);
          el?.focus();
        }, 50);
      }
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setFormError("");

    try {
      const hsPayload =
        visitType === "home_service"
          ? {
              homeServiceAddress: form.hsAddress || undefined,
              homeServiceAddressDetails: form.hsAddressDetails || undefined,
              homeServiceBarangay: form.hsBarangay || undefined,
              homeServiceCity: form.hsCity || undefined,
              homeServiceLandmark: form.hsLandmark || undefined,
              homeServiceParkingNotes: form.hsParkingNotes || undefined,
              homeServiceCustomerNotes: form.hsParkingNotes || undefined,
              homeServiceZone: form.hsZone || "unknown",
              homeServiceLat: form.hsLat ?? undefined,
              homeServiceLng: form.hsLng ?? undefined,
              homeServicePlaceId: form.hsPlaceId || undefined,
              homeServiceFormattedAddress: form.hsFormattedAddress || undefined,
              homeServiceAddressComponents:
                form.hsAddressComponents.length > 0 ? form.hsAddressComponents : undefined,
              homeServiceMapUrl: form.hsMapUrl || undefined,
            }
          : {};

      const attendeePayload =
        bookingFor === "me_and_others"
          ? attendees.map((a) => ({
              id: a.id,
              name: a.name.trim() || (a.isOrganizer ? form.fullName || "Organizer" : "Guest"),
              isOrganizer: a.isOrganizer,
              serviceIds: a.serviceIds,
            }))
          : bookingFor === "someone_else"
            ? [
                {
                  id: "att-1",
                  name: recipientName.trim() || "Guest",
                  isOrganizer: false,
                  serviceIds: selectedServices.map((s) => s.id),
                },
              ]
            : [
                {
                  id: "att-1",
                  name: form.fullName.trim() || "Guest",
                  isOrganizer: true,
                  serviceIds: selectedServices.map((s) => s.id),
                },
              ];

      // Ensure we read/persist the persistent session attempt ID for this confirmation
      const attemptId = getOrCreateCheckoutAttemptId();
      checkoutAttemptIdRef.current = attemptId;

      const payload = {
        website: "",
        branchId: selectedBranch!.id,
        serviceIds: allSelectedServiceIds,
        bookingFor,
        recipientName: bookingFor === "someone_else" ? recipientName.trim() : undefined,
        attendees: attendeePayload,
        paymentChoice,
        staffId: selectedStaffForBooking !== "auto" ? selectedStaffForBooking : undefined,
        date: toLocalYmd(selectedDate!),
        startTime: selectedSlot!.slot_time,
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        notes: form.notes || undefined,
        idempotencyKey: attemptId,
        ...hsPayload,
      };

      const result =
        mode === "inhouse"
          ? await createInhouseBookingMultiAction({
              branchId: payload.branchId,
              serviceIds: selectedServices.map((s) => s.id),
              staffId: payload.staffId,
              date: payload.date,
              startTime: payload.startTime,
              fullName: payload.fullName,
              phone: payload.phone,
              email: payload.email,
              notes: payload.notes,
              idempotencyKey: attemptId,
              ...hsPayload,
              type: getBookingTypeForVisitType(visitType, "inhouse"),
              // Post a receipt only when staff explicitly marks payment as collected.
              paymentReceived: paymentChoice === "pay_now",
              paymentMethod:
                paymentChoice === "pay_now" ? form.paymentMethod || undefined : undefined,
              paymentReference:
                paymentChoice === "pay_now" ? form.paymentReference || undefined : undefined,
              paymentNote: paymentChoice === "pay_now" ? form.paymentNote || undefined : undefined,
            })
          : await createOnlineBookingMultiAction({
              ...payload,
              type: getBookingTypeForVisitType(visitType, "public"),
            });

      if (result.ok) {
        const staffPreferenceNeedsConfirmation =
          mode === "public" &&
          "staffPreferenceNeedsConfirmation" in result &&
          result.staffPreferenceNeedsConfirmation === true;
        toast.success(mode === "inhouse" ? "Booking saved" : "Your booking is confirmed 🌿", {
          description:
            mode === "inhouse"
              ? "Appointment saved to the CRM workspace."
              : "Thank you for choosing Cradle Wellness Living. We look forward to taking care of you.",
        });
        setSuccess({
          bookingId: result.bookingId,
          orderId: "orderId" in result ? (result.orderId as string) : undefined,
          orderNumber: "orderNumber" in result ? (result.orderNumber as string) : undefined,
          staffPreferenceNeedsConfirmation,
        });
        setStep(successStep);
        // Refresh session attempt ID for any subsequent new booking flow while keeping success state stable
        checkoutAttemptIdRef.current = resetCheckoutAttemptId();
      } else {
        const isNetworkError =
          result.message.toLowerCase().includes("fetch") ||
          result.message.toLowerCase().includes("network") ||
          result.message.toLowerCase().includes("failed to");
        const description = isNetworkError
          ? "Check your connection and try again."
          : result.message || "We couldn't confirm your booking. Please try again.";
        toast.error("Booking failed", { description });
        setFormError(description);
        if (mode === "public" && isMobileBookingViewport()) {
          stepScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    } catch (err: unknown) {
      console.error("[BookingWizard] Booking submission error:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We couldn't confirm your booking. Please try again.";
      toast.error("Booking error", { description: message });
      setFormError(message);
      if (mode === "public" && isMobileBookingViewport()) {
        stepScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    selectedBranch,
    selectedServices,
    allSelectedServiceIds,
    bookingFor,
    recipientName,
    attendees,
    paymentChoice,
    selectedDate,
    selectedSlot,
    visitType,
    bookingRules,
    selectedStaffForBooking,
    form,
    mode,
    isHomeService,
    successStep,
    isOffline,
    submitting,
    step,
  ]);

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
  const locationValid = !isHomeService
    ? true
    : preciseLocationRequired
      ? preciseHomeServiceLocationSelected
      : form.hsZone !== "unknown" && form.hsZone !== "";

  const canProceed =
    currentStepName === "branch"
      ? !!selectedBranch
      : currentStepName === "visit"
        ? !!bookingType && isVisitTypeEnabled(visitType, bookingRules)
        : currentStepName === "services"
          ? bookingFor === "me"
            ? selectedServices.length > 0
            : bookingFor === "someone_else"
              ? selectedServices.length > 0 && recipientName.trim().length >= 2
              : attendees.length >= 2 && attendees.every((a) => a.serviceIds.length > 0)
          : currentStepName === "location"
            ? locationValid
            : currentStepName === "date_time"
              ? !!selectedSlot
              : currentStepName === "therapist"
                ? true
                : currentStepName === "details"
                  ? form.fullName.trim().length >= 2 &&
                    form.phone.trim().length >= 7 &&
                    hsAddressFilled &&
                    (mode !== "inhouse" ||
                      paymentChoice !== "pay_now" ||
                      form.paymentMethod.trim().length > 0)
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
    setStep((current) => current + (mode === "public" && currentStepName === "date_time" ? 2 : 1));
  }, [currentStepName, locationValid, mode, preciseLocationRequired]);

  return (
    <div
      className={
        mode === "public"
          ? `public-booking-surface flex h-[100dvh] min-h-[100dvh] w-full max-w-full flex-col overflow-hidden pt-14 text-[#F6EBD6] md:block md:h-auto md:min-h-screen md:overflow-x-hidden md:overflow-y-visible ${currentStepName === "details" ? "md:pt-20" : "md:pt-0"}`
          : ""
      }
      style={{ background: mode === "public" ? BOOKING_PAGE_BACKGROUND : "transparent" }}
    >
      {mode === "public" && currentStepName !== "details" && (
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
            <h1 className="text-3xl sm:text-4xl font-medium" style={WARM_HEADING_STYLE}>
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
              ? "mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden px-4 pt-3 md:block md:max-w-7xl md:overflow-visible md:px-8 md:py-10 lg:py-12"
              : currentStepName === "details"
                ? "mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden px-4 pt-2 md:block md:max-w-5xl md:overflow-visible md:px-6 md:py-5"
                : "mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden px-4 pt-3 md:block md:max-w-5xl md:overflow-visible md:px-6 md:py-10 lg:py-14"
            : "mx-auto max-w-6xl py-2"
        }
      >
        {mode === "public" && currentStepName !== "success" && (
          <div className="mb-3 shrink-0 text-center md:hidden">
            {currentStepName === "details" ? (
              <h1 className="text-[22px] font-medium leading-tight text-[#F6EBD6] [font-family:var(--sp-font-display)]">
                Details
              </h1>
            ) : (
              <>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#D4B57A]">
                  Book Your Pause
                </p>
                <h1 className="text-[22px] font-medium leading-none text-[#F6EBD6] [font-family:var(--sp-font-display)]">
                  Choose your care
                </h1>
                <p className="mx-auto mt-1.5 max-w-[270px] text-[11px] leading-4 text-[#F6EBD6]/68">
                  Select your branch, treatment, time, and details. We&apos;ll guide you gently.
                </p>
              </>
            )}
          </div>
        )}

        {mode === "public" && currentStepName !== "success" && (
          <div className="mb-4 shrink-0 md:hidden">
            <div className="flex items-start justify-between">
              {MOBILE_PROGRESS_STEPS.map((label, index) => (
                <div key={label} className="relative flex flex-1 flex-col items-center">
                  {index < MOBILE_PROGRESS_STEPS.length - 1 && (
                    <span
                      className={`absolute left-1/2 top-2.5 h-px w-full ${
                        mobileProgressIndex > index ? "bg-[#D4B57A]" : "bg-[#D4B57A]/22"
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold ${
                      mobileProgressIndex >= index
                        ? "border-[#D4B57A] bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] text-[#031B16] shadow-[0_8px_22px_rgba(212,181,122,0.24)]"
                        : "border-[#D4B57A]/28 bg-[#05241D]/70 text-[#F6EBD6]/45 backdrop-blur"
                    }`}
                  >
                    {mobileProgressIndex > index ? <Check className="h-2.5 w-2.5" /> : index + 1}
                  </span>
                  <span
                    className={`mt-1.5 text-center text-[8.5px] font-medium leading-3 ${
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
          <div className={`${currentStepName === "details" && mode === "public" ? "mb-5" : "mb-12"} hidden items-center justify-center md:flex`}>
            <div className="flex items-center gap-0.5 sm:gap-2">
              {visibleSteps.map((s, i) => (
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
                      {step > s.id ? <Check className="h-3.5 w-3.5" /> : mode === "public" ? i + 1 : s.id}
                    </div>
                    <span
                      className={`hidden sm:block text-[10px] mt-1.5 font-medium ${
                        step >= s.id ? "text-[#F6EBD6]" : "text-[#F6EBD6]/42"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < visibleSteps.length - 1 && (
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
        <div
          className={
            mode === "public"
              ? currentStepName === "details"
                ? "flex min-h-0 flex-1 flex-col overflow-hidden md:block md:overflow-visible"
                : "flex min-h-0 flex-1 flex-col overflow-hidden md:grid md:gap-8 md:overflow-visible lg:grid-cols-3"
              : "grid min-w-0 gap-8 lg:grid-cols-3"
          }
        >
          {/* Main */}
          <div
            className={
              mode === "public"
                ? currentStepName === "details"
                  ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:block md:overflow-visible"
                  : "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:block md:overflow-visible lg:col-span-2"
                : "min-w-0 lg:col-span-2"
            }
          >
            <div
              ref={stepScrollRef}
              className={
                mode === "public"
                  ? [
                      "min-h-0 flex-1 overscroll-contain md:overflow-visible md:pb-0",
                      "overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))]",
                    ].join(" ")
                  : ""
              }
            >
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
                    setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
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
                <div>
                  {mode === "public" && (
                    <BookingForSection
                      bookingFor={bookingFor}
                      onBookingForChange={handleBookingForChange}
                      recipientName={recipientName}
                      onRecipientNameChange={setRecipientName}
                      attendees={attendees}
                      activeAttendeeId={activeAttendeeId}
                      onSelectAttendee={setActiveAttendeeId}
                      onAddAttendee={handleAddAttendee}
                      onRemoveAttendee={handleRemoveAttendee}
                      onRenameAttendee={handleRenameAttendee}
                      mode={mode}
                    />
                  )}
                  <BookingServicePicker
                    services={eligibleServices}
                    loading={loadingServices}
                    selected={activeServicesForPicker}
                    onToggle={toggleService}
                    heading={
                      mode === "public"
                        ? bookingFor === "me_and_others"
                          ? activeAttendee?.isOrganizer
                            ? "Treatment for you"
                            : `Treatment for ${activeAttendee?.name || "guest"}`
                          : bookingFor === "someone_else"
                            ? "Choose their treatment"
                            : "Choose your treatment"
                        : undefined
                    }
                    totalDuration={totalDuration}
                    totalPrice={totalPrice}
                    visitType={visitType}
                    theme={mode === "public" ? "warm" : "default"}
                  />
                </div>
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
                    const hasSelected =
                      bookingFor === "me_and_others"
                        ? attendees.some((a) => a.serviceIds.length > 0)
                        : selectedServices.length > 0;
                    setLoadingSlots(Boolean(d && selectedBranch && hasSelected));
                    setRawSlots([]);
                    setSlots([]);
                    setSelectedSlot(null);
                    setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
                    setAvailabilityMessage("");
                  }}
                  slots={displaySlots}
                  loading={loadingSlots}
                  serviceCount={allSelectedServices.length}
                  availabilityMessage={availabilityMessage}
                  selectedSlot={selectedSlot}
                  onSelectSlot={(s) => {
                    setSelectedSlot(s);
                    setSelectedStaff(DEFAULT_STAFF_PREFERENCE);
                  }}
                  dispatchStatuses={dispatchStatuses}
                  mode={mode}
                />
              )}
              {currentStepName === "therapist" && (
                <StepTherapist
                  availableStaff={staffPreferenceOptions}
                  selectedSlot={selectedSlot}
                  selected={selectedStaffForBooking}
                  onSelect={setSelectedStaff}
                  selectedServices={allSelectedServices}
                  totalDuration={totalDuration}
                  totalPrice={totalPrice}
                  preferenceConfirmationRequired={mode === "public"}
                  bookingFor={bookingFor}
                  attendeesCount={attendees.length}
                />
              )}
              {currentStepName === "details" && (
                <StepDetails
                  form={form}
                  onChange={setForm}
                  error={formError}
                  visitType={visitType}
                  mode={mode}
                  bookingFor={bookingFor}
                  recipientName={recipientName}
                  attendees={attendees}
                  paymentChoice={paymentChoice}
                  onPaymentChoiceChange={setPaymentChoice}
                  availableStaff={staffPreferenceOptions}
                  selectedSlot={selectedSlot}
                  selectedStaff={selectedStaffForBooking}
                  onSelectStaff={setSelectedStaff}
                />
              )}
              {currentStepName === "success" && success && (
                <StepSuccess
                  bookingId={success.bookingId}
                  orderNumber={success.orderNumber}
                  bookingFor={bookingFor}
                  recipientName={recipientName}
                  attendees={attendees}
                  services={allSelectedServices}
                  selectedBranch={selectedBranch}
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  visitType={visitType}
                  hsAddress={form.hsFormattedAddress || form.hsAddress}
                  paymentChoice={paymentChoice}
                  totalPrice={totalPrice}
                  mode={mode}
                  staffPreferenceNeedsConfirmation={success.staffPreferenceNeedsConfirmation}
                />
              )}
            </div>

            {/* Navigation */}
            {currentStepName !== "success" && (
              <div
                className={
                  mode === "public"
                    ? isTherapistStep
                      ? "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#D4B57A]/25 bg-[#031B16]/82 px-4 py-3 shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl md:relative md:mt-8 md:border-t md:bg-transparent md:px-0 md:pt-6 md:shadow-none md:backdrop-blur-0"
                      : currentStepName === "details"
                        ? "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#D4B57A]/25 bg-[#031B16]/82 px-4 py-3 shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl md:static md:mx-auto md:mt-5 md:w-full md:max-w-3xl md:border-t md:bg-transparent md:px-0 md:pt-5 md:shadow-none md:backdrop-blur-0"
                        : "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#D4B57A]/25 bg-[#031B16]/82 px-4 py-3 shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl md:static md:mt-10 md:border-t md:bg-transparent md:px-0 md:pt-8 md:shadow-none md:backdrop-blur-0"
                    : "flex items-center justify-between mt-10 pt-8 border-t border-[#EDE4D3]"
                }
                style={{
                  paddingBottom:
                    mode === "public" ? "max(0.75rem, env(safe-area-inset-bottom))" : undefined,
                }}
              >
                <button
                  onClick={handleBack}
                  disabled={currentStepName === "branch"}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-[#D4B57A]/35 bg-[#031B16]/50 px-4 text-[13px] font-medium text-[#F6EBD6] transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:border-[#D4B57A]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4B57A] md:bg-transparent"
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
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={submitting}
                    aria-busy={submitting}
                    className={[
                      "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[7px] px-8 py-3 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4B57A] md:flex-none md:rounded-full",
                      mode === "public" && "md:max-w-[260px]",
                      submitting ? WARM_DISABLED_BUTTON_CLS : WARM_PRIMARY_BUTTON_CLS,
                    ].join(" ")}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === "inhouse" ? "Saving..." : "Confirming booking…"}
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
          {currentStepName !== "success" && !(mode === "public" && currentStepName === "details") && (
            <div className="hidden lg:block">
              <BookingSummary
                branch={selectedBranch}
                services={allSelectedServices}
                totalDuration={totalDuration}
                totalPrice={totalPrice}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                selectedStaff={selectedStaffForBooking}
                availableStaff={staffPreferenceOptions}
                visitType={visitType}
                bookingRules={bookingRules}
                variant={isTherapistStep ? "therapist" : "default"}
                bookingFor={bookingFor}
                recipientName={recipientName}
                attendees={attendees}
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
        <p
          className="text-[13px] font-medium mt-0.5"
          style={value ? WARM_BODY_STYLE : WARM_MUTED_STYLE}
        >
          {value || placeholder}
        </p>
        {sub && (
          <p className="text-[11px] mt-0.5" style={WARM_MUTED_STYLE}>
            {sub}
          </p>
        )}
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
  bookingFor,
  recipientName,
  attendees,
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
  bookingFor?: BookingForChoice;
  recipientName?: string;
  attendees?: WizardAttendee[];
}) {
  const selectedStaffOption =
    selectedStaff === "auto"
      ? null
      : (availableStaff.find((s) => s.staff_id === selectedStaff) ?? null);
  const staffLabel =
    selectedStaff === "auto"
      ? "Any available provider"
      : (selectedStaffOption?.staff_full_name ?? selectedStaffOption?.staff_name);
  const staffSubLabel =
    selectedStaffOption && staffLabel
      ? `${selectedStaffOption.staff_nickname?.trim() || getTherapistInitials(staffLabel)} · ${
          selectedStaffOption.staff_schedule_available === false
            ? "Preference subject to confirmation"
            : `Available at ${selectedSlot ? formatTime(selectedSlot.slot_time) : "selected time"}`
        }`
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
          <h3 className="text-[21px] font-medium" style={WARM_HEADING_STYLE}>
            Booking Summary
          </h3>

          <div className="mt-5">
            <TherapistSummaryItem icon={Building} label="Branch">
              {branch?.name ?? <span className="font-medium text-[#F6EBD6]/45">Not selected</span>}
            </TherapistSummaryItem>
            {bookingFor === "someone_else" && (
              <TherapistSummaryItem icon={Gift} label="For Recipient">
                {recipientName || "Guest"}
              </TherapistSummaryItem>
            )}
            {bookingFor === "me_and_others" && attendees && (
              <TherapistSummaryItem icon={Users} label="Guests">
                {attendees.length} Guests
              </TherapistSummaryItem>
            )}
            <TherapistSummaryItem
              icon={visitType === "home_service" ? Home : User}
              label="Visit Type"
            >
              <p>{visitOption.label}</p>
              <p className="mt-1 text-[12px] font-medium" style={WARM_MUTED_STYLE}>
                {formatTime(availability.startTime)} - {formatTime(availability.endTime)}
              </p>
            </TherapistSummaryItem>
            <TherapistSummaryItem
              icon={Sparkles}
              label={services.length === 1 ? "Service" : "Services"}
            >
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
                <p className="mt-1 text-[12px] font-medium text-[#F6EBD6]/60">{staffSubLabel}</p>
              ) : null}
            </TherapistSummaryItem>
          </div>

          <div className="mt-6 flex gap-4 rounded-xl border border-[#D4B57A]/25 bg-[#05241D]/58 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4B57A]/30 bg-[#031B16]/48 text-[#D4B57A] shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={WARM_HEADING_STYLE}>
                Your booking is safe with us
              </p>
              <p className="mt-2 text-[13px] leading-6" style={WARM_BODY_STYLE}>
                We never share your personal information with third parties.
              </p>
            </div>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px]"
          style={WARM_MUTED_STYLE}
        >
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
    <div className={`sticky top-28 rounded-2xl p-6 ${WARM_GLASS_PANEL_CLS}`}>
      <h3 className="text-[14px] font-semibold mb-5" style={WARM_HEADING_STYLE}>
        Booking Summary
      </h3>
      <div className="flex flex-col gap-5">
        <SummaryRow
          icon={Building}
          label="Branch"
          value={branch?.name}
          placeholder="Not selected"
        />
        {bookingFor === "someone_else" && (
          <SummaryRow icon={Gift} label="For Recipient" value={recipientName || "Guest"} />
        )}
        {bookingFor === "me_and_others" && attendees && (
          <SummaryRow icon={Users} label="Guests" value={`${attendees.length} Guests`} />
        )}
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

// ── Booking for progressive disclosure selector ───────────────────────────────

export function BookingForSection({
  bookingFor,
  onBookingForChange,
  recipientName,
  onRecipientNameChange,
  attendees,
  activeAttendeeId,
  onSelectAttendee,
  onAddAttendee,
  onRemoveAttendee,
  onRenameAttendee,
  mode,
}: {
  bookingFor: BookingForChoice;
  onBookingForChange: (choice: BookingForChoice) => void;
  recipientName: string;
  onRecipientNameChange: (name: string) => void;
  attendees: WizardAttendee[];
  activeAttendeeId: string;
  onSelectAttendee: (id: string) => void;
  onAddAttendee: () => void;
  onRemoveAttendee: (id: string) => void;
  onRenameAttendee: (id: string, name: string) => void;
  mode: BookingWizardMode;
}) {
  const activeAttendee = attendees.find((a) => a.id === activeAttendeeId) ?? attendees[0];
  const inputClass = mode === "public" ? PUBLIC_INPUT_CLS : INPUT_CLS;
  const guestTabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bookingFor !== "me_and_others") return;
    const strip = guestTabsRef.current;
    const activeTab = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !activeTab) return;
    const left = activeTab.offsetLeft - strip.offsetLeft;
    const right = left + activeTab.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = right - strip.clientWidth;
    }
  }, [bookingFor, activeAttendeeId, attendees.length]);

  return (
    <div className={`mb-4 rounded-2xl p-3 md:mb-6 md:p-5 ${WARM_GLASS_PANEL_CLS}`}>
      <p
        className="text-[11px] font-semibold uppercase tracking-wider mb-3"
        style={WARM_LABEL_STYLE}
      >
        Who is this booking for?
      </p>

      <div role="radiogroup" aria-label="Who is this booking for?" className="grid grid-cols-3 gap-1 rounded-xl border border-[#D4B57A]/30 bg-[#031B16]/55 p-1">
        {([
          ["me", "Me"],
          ["me_and_others", "Me + Guests"],
          ["someone_else", "Someone Else"],
        ] as const).map(([choice, label]) => (
          <label
            key={choice}
            className={`flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-lg px-1 text-center text-[11px] font-semibold leading-tight transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D4B57A] min-[390px]:text-[12px] ${
              bookingFor === choice
                ? "bg-[#D4B57A] text-[#031B16]"
                : "text-[#F6EBD6] hover:bg-[#D4B57A]/15"
            }`}
          >
            <input
              type="radio"
              name="booking-recipient"
              value={choice}
              checked={bookingFor === choice}
              onChange={() => onBookingForChange(choice)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>

      {/* Progressive disclosure: Someone else */}
      {bookingFor === "someone_else" && (
        <div className="mt-4 pt-4 border-t border-[#D4B57A]/15">
          <label className={LABEL_CLS}>
            <User className="h-3.5 w-3.5" />
            Recipient Full Name *
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
            placeholder="e.g. Maria Santos (Person receiving the care session)"
            className={inputClass}
          />
          <p className="mt-1.5 text-[11px]" style={WARM_MUTED_STYLE}>
            We&apos;ll prepare the appointment under their name. You can provide your own details at
            checkout for confirmation & updates.
          </p>
        </div>
      )}

      {/* Progressive disclosure: Me and others */}
      {bookingFor === "me_and_others" && (
        <div className="mt-3 border-t border-[#D4B57A]/15 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4B57A]">
              Guest Sessions
            </p>
            {attendees.length < 10 && (
              <button
                type="button"
                onClick={onAddAttendee}
                className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-[#D4B57A] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4B57A]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Guest
              </button>
            )}
          </div>

          {/* Guest Tabs */}
          <div ref={guestTabsRef} aria-label="Guest sessions" className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
            {attendees.map((att, idx) => {
              const isSelected = att.id === activeAttendeeId;
              const svcCount = att.serviceIds.length;
              return (
                <div
                  key={att.id}
                  className={`flex min-h-12 shrink-0 items-center rounded-xl border text-[12px] transition-colors ${
                    isSelected
                      ? "border-[#D4B57A] bg-[#D4B57A]/22 text-[#F6EBD6]"
                      : "border-[#D4B57A]/30 bg-[#05241D]/60 text-[#F6EBD6] hover:border-[#D4B57A]/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectAttendee(att.id)}
                    aria-pressed={isSelected}
                    aria-label={`${att.isOrganizer ? "You" : att.name}, ${svcCount} ${svcCount === 1 ? "service" : "services"} selected`}
                    className="flex min-h-11 flex-col justify-center px-3 text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#D4B57A]"
                  >
                    <span>{att.isOrganizer ? "You" : att.name}</span>
                    <span className={`text-[10px] ${svcCount > 0 ? "text-[#D4B57A]" : "text-[#F6EBD6]/65"}`}>
                      {svcCount > 0 ? `${svcCount} ${svcCount === 1 ? "service" : "services"} ✓` : "Choose service"}
                    </span>
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttendee(att.id)}
                      className="flex min-h-11 min-w-10 items-center justify-center border-l border-[#D4B57A]/20 text-[#F6EBD6]/75 hover:text-rose-300 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#D4B57A]"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Guest Custom Name */}
          {activeAttendee && (
            <div className="mt-1 flex items-center gap-2">
              <label htmlFor="active-guest-name" className="shrink-0 text-[11px] font-medium" style={WARM_LABEL_STYLE}>
                Attendee name
              </label>
              <input
                id="active-guest-name"
                type="text"
                value={activeAttendee.name}
                onChange={(e) => onRenameAttendee(activeAttendee.id, e.target.value)}
                placeholder="e.g. Sarah"
                className="min-h-10 min-w-0 flex-1 rounded-md border border-[#D4B57A]/25 bg-[#031B16]/60 px-2 text-[12px] text-[#F6EBD6] focus:border-[#D4B57A] focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
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
      <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className={
              mode === "public" ? `h-24 rounded-xl md:h-28 ${WARM_SKELETON_CLS}` : "h-28 rounded-xl"
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
        className="mb-1.5 text-[17px] font-semibold md:mb-2 md:text-2xl md:font-medium"
        style={WARM_HEADING_STYLE}
      >
        Select Branch
      </h2>
      <p
        className="mb-3 text-[12px] leading-5 md:mb-8 md:text-[14px] md:leading-6"
        style={WARM_BODY_STYLE}
      >
        Please choose the branch where you would like to book.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
        {branches.map((branch, index) => (
          <button
            key={branch.id}
            onClick={() => onSelect(branch)}
            className={`grid min-h-[96px] grid-cols-[72px_1fr_auto] gap-2.5 rounded-[10px] border p-2.5 text-left transition-all duration-300 md:flex md:min-h-0 md:items-start md:gap-4 md:rounded-xl md:p-5 ${
              selected?.id === branch.id ? WARM_SELECTED_CARD_CLS : WARM_IDLE_CARD_CLS
            }`}
          >
            <div className="relative h-[76px] overflow-hidden rounded-[7px] bg-[#05241D] md:hidden">
              <Image
                src={index % 2 === 0 ? SPA_IMAGES.contact : SPA_IMAGES.booking}
                alt={`${branch.name} branch`}
                fill
                className="object-cover"
                sizes="72px"
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
              <span className="mb-1 inline-flex rounded-full border border-[#D4B57A]/25 bg-[#031B16]/60 px-2 py-0.5 text-[9px] font-semibold text-[#D4B57A] md:hidden">
                Services vary by branch
              </span>
              <p className="text-[14px] font-semibold" style={WARM_HEADING_STYLE}>
                {branch.name}
              </p>
              {branch.address && (
                <p
                  className="mt-1 line-clamp-2 text-[11px] leading-4 md:text-[12px]"
                  style={WARM_MUTED_STYLE}
                >
                  {branch.address}
                </p>
              )}
              <p className="mt-1 text-[10px] text-[#F6EBD6]/58 md:hidden">
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
        className="mb-1.5 text-[18px] font-semibold md:mb-2 md:text-2xl md:font-medium"
        style={WARM_HEADING_STYLE}
      >
        Choose Visit Type
      </h2>
      <p className="mb-4 text-[12px] leading-5 md:mb-8 md:text-[14px]" style={WARM_BODY_STYLE}>
        Select how you would like to receive your treatment.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
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
              className={`flex min-h-[128px] items-start gap-3 rounded-xl border p-4 text-left transition-all duration-300 md:min-h-0 md:gap-4 md:p-5 ${
                isSelected
                  ? WARM_SELECTED_CARD_CLS
                  : isEnabled
                    ? WARM_IDLE_CARD_CLS
                    : "cursor-not-allowed border-[#D4B57A]/12 bg-[#05241D]/32 opacity-55"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12 ${
                  isSelected
                    ? "border border-[#D4B57A]/40 bg-[#031B16]/70 text-[#D4B57A]"
                    : "border border-[#D4B57A]/22 bg-[#05241D]/70 text-[#D4B57A]"
                }`}
              >
                <Icon className="h-5 w-5 md:h-6 md:w-6" />
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
                <p className="mt-1 text-[12px] leading-5" style={WARM_BODY_STYLE}>
                  {isEnabled ? option.description : "Not available for this branch."}
                </p>
                <p className="mt-2 text-[11px] font-medium md:mt-3" style={WARM_LABEL_STYLE}>
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
  const [isTimeSheetOpen, setIsTimeSheetOpen] = useState(false);
  const sheetTitleId = useId();
  const calendarPanelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + (bookingRules?.maxAdvanceBookingDays ?? 30));

  const availableSlots = slots.filter((s) => s.available);
  const isTodaySelected = !!selectedDate && toLocalYmd(selectedDate) === toLocalYmd(new Date());
  const visitOption = VISIT_TYPE_OPTIONS[visitType];
  const availability = getVisitTypeAvailability(visitType, bookingRules);
  const emptyMessage =
    availabilityMessage ||
    (slots.length > 0
      ? "No available times for this date. Try another day."
      : "No available staff for this service at this branch.");
  const displayEmptyMessage = isTodaySelected
    ? "No more available slots today. Please choose another date."
    : emptyMessage;

  const closeTimeSheet = useCallback(() => {
    setIsTimeSheetOpen(false);
    window.setTimeout(() => {
      calendarPanelRef.current?.focus({ preventScroll: true });
    }, 0);
  }, []);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      onSelectDate(date);
      setIsTimeSheetOpen(Boolean(date && isMobileBookingViewport()));
    },
    [onSelectDate]
  );

  const handleSlotSelect = useCallback(
    (slot: Slot) => {
      onSelectSlot(slot);
      if (isMobileBookingViewport()) {
        closeTimeSheet();
      }
    },
    [closeTimeSheet, onSelectSlot]
  );

  useEffect(() => {
    if (!isTimeSheetOpen) return;

    const focusId = window.setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTimeSheet();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeTimeSheet, isTimeSheetOpen]);

  return (
    <div className="min-h-0 h-full overflow-y-auto overscroll-contain pb-[calc(7rem+env(safe-area-inset-bottom))] md:block md:h-auto md:overflow-visible md:pb-0">
      <h2
        className="mb-1.5 text-[18px] font-semibold md:mb-2 md:text-2xl md:font-medium"
        style={WARM_HEADING_STYLE}
      >
        Select Date & Time
      </h2>
      <p className="mb-4 text-[12px] leading-5 md:mb-8 md:text-[14px]" style={WARM_BODY_STYLE}>
        Choose your preferred date and an available start time.
      </p>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8">
        <div>
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-wide md:mb-3 md:text-[12px]"
            style={WARM_LABEL_STYLE}
          >
            Date
          </p>
          <div
            ref={calendarPanelRef}
            tabIndex={-1}
            className={
              mode === "public"
                ? `flex justify-center overflow-x-auto rounded-xl p-2 focus:outline-none md:justify-start md:p-3 ${WARM_GLASS_PANEL_CLS}`
                : "rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-3 overflow-x-auto flex justify-center md:justify-start backdrop-blur-xl"
            }
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                return d < today || d > maxDate;
              }}
              className={
                mode === "public"
                  ? "rounded-md bg-transparent p-0 text-[#F6EBD6] [--cell-radius:0.65rem] [--cell-size:2rem] min-[390px]:[--cell-size:2.15rem] sm:[--cell-size:2.5rem] [&_.rdp-chevron]:text-[#D4B57A]"
                  : "rounded-md"
              }
              classNames={mode === "public" ? BOOKING_CALENDAR_CLASSNAMES : undefined}
            />
          </div>

          <SelectedDateTimeCard
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            onOpenSheet={() => setIsTimeSheetOpen(true)}
          />
          {!selectedDate && (
            <p className="mt-3 rounded-xl border border-[#D4B57A]/18 bg-[#05241D]/45 px-3 py-2 text-[12px] leading-5 text-[#F6EBD6]/62 md:hidden">
              Select a date to open available times in a bottom sheet.
            </p>
          )}
        </div>

        <div className="hidden md:block">
          <p
            className="mb-3 text-[12px] font-semibold uppercase tracking-wide"
            style={WARM_LABEL_STYLE}
          >
            Available Times
          </p>
          <p className="text-[12px] mb-3" style={WARM_MUTED_STYLE}>
            {visitOption.label}: {formatTime(availability.startTime)} -{" "}
            {formatTime(availability.endTime)}
          </p>
          {serviceCount === 0 ? (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50">
              <p className="text-[13px]" style={WARM_MUTED_STYLE}>
                Choose a service to see available times.
              </p>
            </div>
          ) : !selectedDate ? (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50">
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
                      mode === "public" ? `h-10 rounded-lg ${WARM_SKELETON_CLS}` : "h-10 rounded-lg"
                    }
                  />
                ))}
              </div>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50 px-5 text-center">
              <p className="text-[13px]" style={WARM_MUTED_STYLE}>
                {displayEmptyMessage}
              </p>
            </div>
          ) : (
            <TimeSlotsGrid
              slots={availableSlots}
              selectedSlot={selectedSlot}
              dispatchStatuses={dispatchStatuses}
              mode={mode}
              onSelectSlot={onSelectSlot}
            />
          )}
        </div>
      </div>

      <MobileTimeBottomSheet
        open={isTimeSheetOpen}
        titleId={sheetTitleId}
        selectedDate={selectedDate}
        selectedSlot={selectedSlot}
        slots={availableSlots}
        loading={loading}
        serviceCount={serviceCount}
        emptyMessage={displayEmptyMessage}
        dispatchStatuses={dispatchStatuses}
        mode={mode}
        closeButtonRef={closeButtonRef}
        onClose={closeTimeSheet}
        onSelectSlot={handleSlotSelect}
      />
    </div>
  );
}

function SelectedDateTimeCard({
  selectedDate,
  selectedSlot,
  onOpenSheet,
}: {
  selectedDate: Date | undefined;
  selectedSlot: Slot | null;
  onOpenSheet: () => void;
}) {
  if (!selectedDate) return null;

  return (
    <div className="mt-3 rounded-xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 px-3 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl md:hidden">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D4B57A]/25 bg-[#031B16]/50 text-[#D4B57A]">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#D4B57A]">
            {selectedSlot ? "Selected date & time" : "Selected date"}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold leading-5 text-[#F6EBD6]">
            {formatCompactDate(selectedDate)}
            {selectedSlot ? ` at ${formatTime(selectedSlot.slot_time)}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSheet}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-[7px] border border-[#D4B57A]/35 bg-[#031B16]/52 px-4 text-[11px] font-semibold uppercase tracking-widest text-[#D4B57A] transition-colors hover:border-[#D4B57A]/70"
      >
        {selectedSlot ? "Change time" : "View available times"}
      </button>
    </div>
  );
}

function TimeSlotButton({
  slot,
  isSelected,
  dispatchStatus,
  mode,
  onSelectSlot,
}: {
  slot: Slot;
  isSelected: boolean;
  dispatchStatus: SlotDispatchStatus | undefined;
  mode: BookingWizardMode;
  onSelectSlot: (slot: Slot) => void;
}) {
  const isWarning = dispatchStatus === "warning";
  const isHard = dispatchStatus === "hard";
  const disabled = isHard && mode === "inhouse";

  return (
    <button
      type="button"
      key={slot.slot_time}
      onClick={() => {
        if (!isHard) onSelectSlot(slot);
      }}
      disabled={disabled}
      aria-pressed={isSelected}
      className={`relative flex min-h-11 flex-col items-center justify-center rounded-lg px-2 py-2.5 text-[12px] font-medium transition-all duration-300 motion-reduce:transition-none ${
        isSelected
          ? "bg-[#D4B57A] text-[#031B16] shadow-[0_12px_28px_rgba(212,181,122,0.22)]"
          : isHard
            ? "cursor-not-allowed border border-[#D4B57A]/12 bg-[#05241D]/35 text-[#F6EBD6]/35 opacity-50"
            : isWarning
              ? "border border-[#D4B57A]/38 bg-[#B88945]/16 text-[#F6EBD6] hover:border-[#D4B57A]/65"
              : "border border-[#D4B57A]/25 bg-[#0D2B20]/62 text-[#F6EBD6] hover:border-[#D4B57A]/60"
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {formatTime(slot.slot_time)}
        {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
      </span>
      {isWarning && !isSelected && (
        <span className="mt-0.5 text-[9px] font-semibold leading-none text-amber-300">Review</span>
      )}
      {isHard && mode === "inhouse" && (
        <span className="mt-0.5 text-[9px] font-semibold leading-none text-red-300">Conflict</span>
      )}
    </button>
  );
}

function TimeSlotsGrid({
  slots,
  selectedSlot,
  dispatchStatuses,
  mode,
  onSelectSlot,
}: {
  slots: Slot[];
  selectedSlot: Slot | null;
  dispatchStatuses: Map<string, SlotDispatchStatus>;
  mode: BookingWizardMode;
  onSelectSlot: (slot: Slot) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {slots.map((slot) => (
        <TimeSlotButton
          key={slot.slot_time}
          slot={slot}
          isSelected={selectedSlot?.slot_time === slot.slot_time}
          dispatchStatus={dispatchStatuses.get(slot.slot_time)}
          mode={mode}
          onSelectSlot={onSelectSlot}
        />
      ))}
    </div>
  );
}

function MobileTimeBottomSheet({
  open,
  titleId,
  selectedDate,
  selectedSlot,
  slots,
  loading,
  serviceCount,
  emptyMessage,
  dispatchStatuses,
  mode,
  closeButtonRef,
  onClose,
  onSelectSlot,
}: {
  open: boolean;
  titleId: string;
  selectedDate: Date | undefined;
  selectedSlot: Slot | null;
  slots: Slot[];
  loading: boolean;
  serviceCount: number;
  emptyMessage: string;
  dispatchStatuses: Map<string, SlotDispatchStatus>;
  mode: BookingWizardMode;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelectSlot: (slot: Slot) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close available times"
        className="fixed inset-0 z-[70] bg-[#031B16]/65 backdrop-blur-[2px] md:hidden"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[72dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-[#D4B57A]/25 bg-[#0D2B20]/95 shadow-[0_-24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
      >
        <div className="shrink-0">
          <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-[#D4B57A]/50" />
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
            <div>
              <p
                id={titleId}
                className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#D4B57A]"
              >
                Available times
              </p>
              <p className="mt-1 text-[18px] font-semibold text-[#F6EBD6] [font-family:var(--sp-font-display)]">
                {selectedDate ? formatSheetDate(selectedDate) : "Choose a date"}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close available times"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/30 bg-[#031B16]/55 text-[#D4B57A] transition-colors hover:border-[#D4B57A]/65"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {serviceCount === 0 ? (
            <MobileTimeSheetMessage>
              Choose a service first to see available times.
            </MobileTimeSheetMessage>
          ) : !selectedDate ? (
            <MobileTimeSheetMessage>Choose a date to see available times.</MobileTimeSheetMessage>
          ) : loading ? (
            <div className="rounded-xl border border-[#D4B57A]/20 bg-[#05241D]/55 px-4 py-5">
              <p className="mb-3 text-[13px] text-[#F6EBD6]/68">Checking available times...</p>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className={`h-11 rounded-lg ${WARM_SKELETON_CLS}`} />
                ))}
              </div>
            </div>
          ) : slots.length === 0 ? (
            <MobileTimeSheetMessage>{emptyMessage}</MobileTimeSheetMessage>
          ) : (
            <TimeSlotsGrid
              slots={slots}
              selectedSlot={selectedSlot}
              dispatchStatuses={dispatchStatuses}
              mode={mode}
              onSelectSlot={onSelectSlot}
            />
          )}
        </div>

        <div className="shrink-0 border-t border-[#D4B57A]/15 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={!selectedSlot}
            className={[
              "inline-flex min-h-12 w-full items-center justify-center rounded-[7px] px-5 text-[12px] font-semibold uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-45",
              selectedSlot ? WARM_PRIMARY_BUTTON_CLS : WARM_DISABLED_BUTTON_CLS,
            ].join(" ")}
          >
            Confirm Time
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-[7px] text-[12px] font-semibold text-[#F6EBD6]/68 transition-colors hover:text-[#F6EBD6]"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function MobileTimeSheetMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-[#D4B57A]/25 bg-[#05241D]/50 px-5 text-center">
      <p className="text-[13px] leading-6 text-[#F6EBD6]/68">{children}</p>
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
  preferenceConfirmationRequired,
  bookingFor,
  attendeesCount,
}: {
  availableStaff: StaffOption[];
  selectedSlot: Slot | null;
  selected: "auto" | string;
  onSelect: (choice: "auto" | string) => void;
  selectedServices: Service[];
  totalDuration: number;
  totalPrice: number;
  preferenceConfirmationRequired: boolean;
  bookingFor?: BookingForChoice;
  attendeesCount?: number;
}) {
  const slotLabel = selectedSlot ? formatTime(selectedSlot.slot_time) : "selected time";
  const pickerOptions = buildTherapistPickerOptions(availableStaff, slotLabel);

  return (
    <div>
      {bookingFor === "me_and_others" && attendeesCount && attendeesCount > 1 && (
        <div className="mb-6 rounded-2xl border border-[#D4B57A]/28 bg-[#0D2B20]/65 p-4 text-left backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4" style={WARM_LABEL_STYLE} />
            <p className="text-[13px] font-semibold" style={WARM_HEADING_STYLE}>
              Dedicated Therapists for Your Group ({attendeesCount} Guests)
            </p>
          </div>
          <p className="text-[12px] leading-5" style={WARM_BODY_STYLE}>
            Our scheduling system assigns qualified dedicated therapists to each guest so treatments
            can proceed concurrently without delay. You can indicate a preference below or let us
            assign our top-rated specialists.
          </p>
        </div>
      )}
      <TherapistSelectionStep
        options={pickerOptions}
        value={selected}
        onValueChange={onSelect}
        serviceCount={selectedServices.length}
        totalDuration={totalDuration}
        totalPriceLabel={formatCurrency(totalPrice)}
        preferenceConfirmationRequired={preferenceConfirmationRequired}
      />
    </div>
  );
}

// ── Shared input style ─────────────────────────────────────────────────────────
const INPUT_CLS =
  "w-full rounded-xl border border-[#D4B57A]/25 bg-[#05241D]/70 px-4 py-3 text-[14px] text-[#F6EBD6] placeholder:text-[#F6EBD6]/45 outline-none transition-all focus:border-[#D4B57A]/75 focus:ring-2 focus:ring-[#D4B57A]/25";
const PUBLIC_INPUT_CLS =
  "w-full rounded-xl border border-[#D4B57A]/25 bg-[#05241D]/75 px-4 py-3 text-[14px] text-[#F6EBD6] placeholder:text-[#F6EBD6]/45 outline-none transition-all selection:bg-[#D4B57A]/30 focus:border-[#D4B57A]/75 focus:ring-2 focus:ring-[#D4B57A]/20";
const LABEL_CLS =
  "flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide mb-2 text-[#D4B57A]";

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

function getAddressComponent(components: GoogleAddressComponent[], types: string[]): string {
  return (
    components.find((component) => types.some((type) => component.types.includes(type)))
      ?.long_name ?? ""
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
        className="mb-1.5 text-[18px] font-semibold md:mb-2 md:text-2xl md:font-medium"
        style={WARM_HEADING_STYLE}
      >
        Your Location
      </h2>
      <p className="mb-4 text-[12px] leading-5 md:mb-8 md:text-[14px]" style={WARM_BODY_STYLE}>
        Search and select your exact location so our therapist and driver can find you easily.
      </p>

      <div className="flex flex-col gap-4 md:gap-5">
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
              <option value="" disabled>
                Select your zone...
              </option>
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
            <div className="flex items-start gap-3 rounded-xl border border-[#D4B57A]/28 bg-[#0D2B20]/65 px-4 py-3 backdrop-blur-xl">
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
            Delivery notes <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="hs-delivery-notes"
            value={form.hsParkingNotes}
            onChange={(event) => onChange({ ...form, hsParkingNotes: event.target.value })}
            placeholder="House number, unit, gate color, landmark, parking instructions..."
            rows={mode === "public" ? 2 : 3}
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
  { value: "unknown", label: "Not sure / Let CSR confirm" },
  { value: "central_bacolod", label: "Central Bacolod" },
  { value: "north_bacolod_talisay", label: "North Bacolod / Talisay" },
  { value: "south_bacolod_alijis", label: "South Bacolod / Alijis" },
  { value: "east_bacolod", label: "East Bacolod" },
  { value: "outside_bacolod", label: "Outside Bacolod" },
];

export function PublicStepDetails({
  form,
  onChange,
  error,
  bookingFor,
  recipientName,
  attendees,
  availableStaff,
  selectedSlot,
  selectedStaff,
  onSelectStaff,
}: {
  form: DetailsForm;
  onChange: (form: DetailsForm) => void;
  error: string;
  bookingFor?: BookingForChoice;
  recipientName?: string;
  attendees?: WizardAttendee[];
  availableStaff: StaffOption[];
  selectedSlot: Slot | null;
  selectedStaff: "auto" | string;
  onSelectStaff: (choice: "auto" | string) => void;
}) {
  const [therapistOpen, setTherapistOpen] = useState(false);
  const [optionalExpanded, setOptionalExpanded] = useState(
    Boolean(form.email.trim() || form.notes.trim())
  );
  const therapistOptions = buildTherapistPickerOptions(
    availableStaff,
    selectedSlot ? formatTime(selectedSlot.slot_time) : "selected time"
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-2 md:space-y-5">
      <div>
        <h2 className="text-[22px] font-medium leading-tight md:text-[28px]" style={WARM_HEADING_STYLE}>
          Complete your booking
        </h2>
        {bookingFor === "someone_else" && (
          <p className="mt-1 text-[13px] leading-5" style={WARM_BODY_STYLE}>
            Your contact details for {recipientName?.trim() || "the recipient"}.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-300/30 bg-red-950/35 px-3 py-2 text-[13px] text-red-100">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
        <div>
          <label htmlFor="wizard-fullName" className="mb-1 block text-[13px] font-semibold text-[#D4B57A]">
            Full name <span aria-hidden="true">*</span>
          </label>
          <input
            id="wizard-fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={(event) => onChange({ ...form, fullName: event.target.value })}
            placeholder="Your full name"
            className={PUBLIC_INPUT_CLS}
          />
        </div>
        <div>
          <label htmlFor="wizard-phone" className="mb-1 block text-[13px] font-semibold text-[#D4B57A]">
            Phone number <span aria-hidden="true">*</span>
          </label>
          <input
            id="wizard-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            value={form.phone}
            onChange={(event) => onChange({ ...form, phone: event.target.value })}
            placeholder="e.g. 0917 123 4567"
            className={PUBLIC_INPUT_CLS}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold text-[#D4B57A]">Therapist preference</p>
          <span className="text-[12px] text-[#F6EBD6]/70">Optional</span>
        </div>
        <TherapistDropdownPicker
          options={therapistOptions}
          value={selectedStaff}
          open={therapistOpen}
          onOpenChange={setTherapistOpen}
          onValueChange={onSelectStaff}
          compact
        />
        {bookingFor === "me_and_others" && (attendees?.length ?? 0) > 1 && selectedStaff === "auto" && (
          <p className="mt-1.5 text-[12px] leading-5 text-[#F6EBD6]/70">
            {attendees?.length} guests · We&apos;ll assign one qualified therapist to each guest.
          </p>
        )}
      </div>

      <div className="border-t border-[#D4B57A]/20 pt-1">
        <button
          type="button"
          aria-expanded={optionalExpanded}
          aria-controls="wizard-optional-details"
          onClick={() => setOptionalExpanded((expanded) => !expanded)}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[#D4B57A] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4B57A]"
        >
          <Plus className="size-4" aria-hidden="true" />
          {optionalExpanded ? "Hide optional details" : "Add email or special request"}
        </button>
      </div>

      <div id="wizard-optional-details" hidden={!optionalExpanded}>
        <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
          <div id="wizard-optional-email">
            <label htmlFor="wizard-email" className="mb-1 block text-[13px] font-semibold text-[#D4B57A]">
              Email (optional)
            </label>
            <input
              id="wizard-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              placeholder="your@email.com"
              className={PUBLIC_INPUT_CLS}
            />
          </div>
          <div id="wizard-optional-notes">
            <label htmlFor="wizard-notes" className="mb-1 block text-[13px] font-semibold text-[#D4B57A]">
              Special requests (optional)
            </label>
            <textarea
              id="wizard-notes"
              name="notes"
              value={form.notes}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
              placeholder="Anything we should know?"
              rows={2}
              className={`${PUBLIC_INPUT_CLS} resize-y`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDetails({
  form,
  onChange,
  error,
  visitType,
  mode,
  bookingFor,
  recipientName,
  attendees,
  paymentChoice,
  onPaymentChoiceChange,
  availableStaff,
  selectedSlot,
  selectedStaff,
  onSelectStaff,
}: {
  form: DetailsForm;
  onChange: (f: DetailsForm) => void;
  error: string;
  visitType: VisitType;
  mode: BookingWizardMode;
  bookingFor?: BookingForChoice;
  recipientName?: string;
  attendees?: WizardAttendee[];
  paymentChoice?: BookingPaymentChoice;
  onPaymentChoiceChange?: (choice: BookingPaymentChoice) => void;
  availableStaff: StaffOption[];
  selectedSlot: Slot | null;
  selectedStaff: "auto" | string;
  onSelectStaff: (choice: "auto" | string) => void;
}) {
  const publicDetails = mode === "public" ? (
    <PublicStepDetails
      form={form}
      onChange={onChange}
      error={error}
      bookingFor={bookingFor}
      recipientName={recipientName}
      attendees={attendees}
      availableStaff={availableStaff}
      selectedSlot={selectedSlot}
      selectedStaff={selectedStaff}
      onSelectStaff={onSelectStaff}
    />
  ) : null;

  const isHomeService = visitType === "home_service";
  const fieldClassName = mode === "public" ? PUBLIC_INPUT_CLS : INPUT_CLS;

  return publicDetails ?? (
    <div>
      <h2
        className="mb-1.5 text-[18px] font-semibold md:mb-2 md:text-2xl md:font-medium"
        style={WARM_HEADING_STYLE}
      >
        Your Details
      </h2>
      <p className="mb-4 text-[12px] leading-5 md:mb-8 md:text-[14px]" style={WARM_BODY_STYLE}>
        Please provide your contact information to complete the booking.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/40 bg-red-950/70 p-4 text-[13px] font-medium text-red-200 shadow-lg backdrop-blur-md"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold text-red-100">Unable to confirm booking</p>
            <p className="mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {bookingFor === "someone_else" && (
        <div className="mb-6 rounded-2xl border border-[#D4B57A]/28 bg-[#0D2B20]/65 p-4 text-left backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="h-4 w-4" style={WARM_LABEL_STYLE} />
            <p className="text-[13px] font-semibold" style={WARM_HEADING_STYLE}>
              Booking for {recipientName?.trim() || "Someone Else"}
            </p>
          </div>
          <p className="text-[12px] leading-5" style={WARM_BODY_STYLE}>
            You are completing this reservation as the organizer. Enter your personal contact
            details below so we can confirm the appointment and send the booking receipt.
          </p>
        </div>
      )}

      {bookingFor === "me_and_others" && (
        <div className="mb-6 rounded-2xl border border-[#D4B57A]/28 bg-[#0D2B20]/65 p-4 text-left backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4" style={WARM_LABEL_STYLE} />
            <p className="text-[13px] font-semibold" style={WARM_HEADING_STYLE}>
              Group Booking Organizer ({attendees?.length || 2} Guests)
            </p>
          </div>
          <p className="text-[12px] leading-5" style={WARM_BODY_STYLE}>
            As the booking organizer, your contact details will be used for appointment updates and
            notifications for your entire party.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 md:gap-5">
        {/* Contact info */}
        <div>
          <label className={LABEL_CLS}>
            <User className="h-3.5 w-3.5" />
            Full Name *
          </label>
          <input
            type="text"
            id="wizard-fullName"
            name="fullName"
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
            id="wizard-phone"
            name="phone"
            value={form.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value })}
            placeholder="e.g. 0917 123 4567"
            className={fieldClassName}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            <Mail className="h-3.5 w-3.5" />
            Email <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            type="email"
            id="wizard-email"
            name="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="your@email.com"
            className={fieldClassName}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            <FileText className="h-3.5 w-3.5" />
            Notes <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            placeholder="Share any comfort notes or special requests."
            rows={mode === "public" ? 2 : 3}
            className={`${fieldClassName} resize-none`}
          />
        </div>

        {/* CRM In-House Payment Capture */}
        {mode === "inhouse" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4" style={WARM_LABEL_STYLE} />
              <p className="text-[13px] font-semibold" style={WARM_HEADING_STYLE}>
                Payment
              </p>
            </div>
            <p className="text-[12px] -mt-2" style={WARM_BODY_STYLE}>
              Choose whether payment has actually been collected. Pay later creates an unpaid
              booking.
            </p>

            <div>
              <label htmlFor="wizard-inhouse-payment-choice" className={LABEL_CLS}>
                Payment status *
              </label>
              <select
                id="wizard-inhouse-payment-choice"
                value={paymentChoice ?? "pay_later"}
                onChange={(e) => onPaymentChoiceChange?.(e.target.value as BookingPaymentChoice)}
                className={fieldClassName}
              >
                <option value="pay_later">Pay later / not collected</option>
                <option value="pay_now">Collected now</option>
              </select>
            </div>

            {paymentChoice === "pay_now" && (
              <>
                <div>
                  <label htmlFor="wizard-inhouse-payment-method" className={LABEL_CLS}>
                    Payment method *
                  </label>
                  <select
                    id="wizard-inhouse-payment-method"
                    value={form.paymentMethod}
                    onChange={(e) => onChange({ ...form, paymentMethod: e.target.value })}
                    className={fieldClassName}
                  >
                    <option value="" disabled>
                      Select payment method…
                    </option>
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="maya">Maya</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
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
                    Payment note <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={form.paymentNote}
                    onChange={(e) => onChange({ ...form, paymentNote: e.target.value })}
                    placeholder="Internal note about this payment…"
                    rows={2}
                    className={`${fieldClassName} resize-none`}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Public Booking Payment Preference */}
        {mode === "public" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4" style={WARM_LABEL_STYLE} />
              <p className="text-[13px] font-semibold" style={WARM_HEADING_STYLE}>
                Payment: Pay at Spa / After Service
              </p>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-950/50 text-emerald-200">
                No Upfront Fee
              </span>
            </div>
            <p className="text-[12px] -mt-1 leading-5" style={WARM_BODY_STYLE}>
              Your appointment is confirmed immediately. No advance deposit or card entry is needed
              online. You may settle conveniently upon arrival or after your treatment via Cash,
              Card, Maya QR, or GCash at our front desk.
            </p>

            <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#D4B57A]/28 bg-[#05241D]/75 p-3.5">
              <BadgeCheck className="h-5 w-5 shrink-0 text-[#D4B57A]" />
              <div className="text-left">
                <p className="text-[13px] font-medium text-[#F6EBD6]">Pay Later Accepted</p>
                <p className="text-[11px] text-[#F6EBD6]/65">
                  Payment tracked separately. Zero payment provider details required online.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Home Service Address */}
        {isHomeService && (
          <div className="flex flex-col gap-4 rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/65 p-5 backdrop-blur-xl">
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
              We will use the selected Google location from the Location step for dispatch and
              routing.
            </p>

            {mode === "inhouse" && (
              <div className="flex items-center gap-2 rounded-xl border border-[#D4B57A]/22 bg-[#05241D]/58 px-4 py-3">
                <MapPin className="h-4 w-4 shrink-0" style={WARM_LABEL_STYLE} />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={WARM_LABEL_STYLE}
                  >
                    Zone
                  </p>
                  <p className="text-[13px] font-medium" style={WARM_BODY_STYLE}>
                    {HS_ZONE_OPTIONS.find((o) => o.value === form.hsZone)?.label ?? form.hsZone}
                  </p>
                </div>
              </div>
            )}

            {isPreciseHomeServiceLocation(form) ? (
              <div className="flex items-start gap-3 rounded-xl border border-[#D4B57A]/22 bg-[#05241D]/58 px-4 py-3">
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
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={WARM_LABEL_STYLE}
                >
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
                  <label className={LABEL_CLS}>Barangay *</label>
                  <input
                    type="text"
                    value={form.hsBarangay}
                    onChange={(event) => onChange({ ...form, hsBarangay: event.target.value })}
                    placeholder="e.g. Brgy. San Antonio"
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>City / Municipality *</label>
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
  orderNumber,
  bookingFor,
  recipientName,
  attendees,
  services,
  selectedBranch,
  selectedDate,
  selectedSlot,
  visitType,
  hsAddress,
  paymentChoice,
  totalPrice,
  mode,
  staffPreferenceNeedsConfirmation,
}: {
  bookingId: string;
  orderNumber?: string;
  bookingFor?: BookingForChoice;
  recipientName?: string;
  attendees?: WizardAttendee[];
  services: Service[];
  selectedBranch: Branch | null;
  selectedDate?: Date | null;
  selectedSlot: Slot | null;
  visitType: VisitType;
  hsAddress?: string;
  paymentChoice?: BookingPaymentChoice;
  totalPrice?: number;
  mode: BookingWizardMode;
  staffPreferenceNeedsConfirmation: boolean;
}) {
  const displayOrderNum = orderNumber || `CRD-${bookingId.slice(0, 8).toUpperCase()}`;
  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const formattedTime = selectedSlot ? formatTime(selectedSlot.slot_time) : "";

  return (
    <div className="text-center py-8 md:py-12">
      <div className="mx-auto mb-5 flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full border border-[#D4B57A]/40 bg-[#0D2B20]/72 text-[#D4B57A] shadow-[0_20px_54px_rgba(0,0,0,0.32)]">
        <Check className="h-8 w-8 md:h-10 md:w-10" />
      </div>

      <h2 className="text-2xl sm:text-3xl font-medium mb-2.5" style={WARM_HEADING_STYLE}>
        {mode === "inhouse" ? "Booking Saved" : "Your booking is confirmed 🌿"}
      </h2>
      <p
        className="text-[14px] md:text-[15px] max-w-md mx-auto mb-6 leading-relaxed"
        style={WARM_BODY_STYLE}
      >
        {mode === "inhouse"
          ? "The appointment has been saved and confirmed in the CRM workspace."
          : "Thank you for choosing Cradle Wellness Living. We look forward to taking care of you."}
      </p>

      {/* Confirmed Order Card */}
      <div className="mx-auto mb-6 max-w-lg rounded-2xl border border-[#D4B57A]/28 bg-[#0D2B20]/65 p-5 sm:p-6 text-left backdrop-blur-xl shadow-[0_20px_48px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-[#D4B57A]/15 pb-4 mb-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4B57A]">
              Order Number
            </span>
            <p className="text-[16px] font-mono font-bold text-[#F6EBD6]">{displayOrderNum}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Confirmed
          </span>
        </div>

        {/* Overview details grid */}
        <div className="grid grid-cols-2 gap-4 text-left mb-5">
          <div>
            <span className="text-[11px] uppercase tracking-wide text-[#D4B57A]/75 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Date & Time
            </span>
            <p className="text-[13px] font-medium text-[#F6EBD6] mt-0.5">{formattedDate}</p>
            <p className="text-[12px] text-[#F6EBD6]/75">{formattedTime}</p>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wide text-[#D4B57A]/75 flex items-center gap-1.5">
              {visitType === "home_service" ? (
                <Home className="h-3.5 w-3.5" />
              ) : (
                <Building className="h-3.5 w-3.5" />
              )}
              {visitType === "home_service" ? "Home Service" : "Branch"}
            </span>
            <p className="text-[13px] font-medium text-[#F6EBD6] mt-0.5 truncate">
              {visitType === "home_service"
                ? hsAddress || "Home Service Location"
                : selectedBranch?.name || "In-Spa Branch"}
            </p>
            {visitType === "home_service" && (
              <p className="text-[11px] text-[#D4B57A]/90">Door-to-door care</p>
            )}
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wide text-[#D4B57A]/75 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Guests
            </span>
            <p className="text-[13px] font-medium text-[#F6EBD6] mt-0.5">
              {bookingFor === "me_and_others"
                ? `${attendees?.length ?? 1} Guests`
                : bookingFor === "someone_else"
                  ? `1 Guest (for ${recipientName || "Recipient"})`
                  : "1 Guest (Just you)"}
            </p>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wide text-[#D4B57A]/75 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Total
            </span>
            <p className="text-[14px] font-bold text-[#D4B57A] mt-0.5">
              {formatCurrency(totalPrice ?? 0)}
            </p>
          </div>
        </div>

        {/* Attendees & Treatments breakdown */}
        <div className="border-t border-[#D4B57A]/15 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4B57A] mb-2.5">
            Treatments & Services
          </p>

          {bookingFor === "me_and_others" && attendees && attendees.length > 0 ? (
            <div className="flex flex-col gap-3">
              {attendees.map((att, idx) => {
                const attServices = services.filter((s) => att.serviceIds.includes(s.id));
                return (
                  <div
                    key={att.id}
                    className="rounded-xl border border-[#D4B57A]/18 bg-[#05241D]/60 p-3"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-[#F6EBD6]">
                        {att.name || `Guest ${idx + 1}`}
                      </span>
                      <span className="text-[11px] text-[#D4B57A]">
                        {attServices.length} {attServices.length === 1 ? "treatment" : "treatments"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {attServices.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 text-[11px] bg-[#0D2B20] text-[#F6EBD6]/85 px-2 py-0.5 rounded-md border border-[#D4B57A]/15"
                        >
                          <Check className="h-3 w-3 text-[#D4B57A]" />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-[#D4B57A]" />
                    <span className="text-[#F6EBD6] font-medium">{s.name}</span>
                  </div>
                  <span className="text-[#D4B57A]/85">{formatCurrency(s.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment details notice */}
        <div className="mt-4 rounded-xl border border-[#D4B57A]/22 bg-[#05241D]/75 p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4B57A]">
              Payment Status
            </span>
            <span className="text-[11px] font-medium text-[#F6EBD6]/80">
              {paymentChoice === "pay_now" ? "Online checkout" : "Pay at spa / after service"}
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-[#F6EBD6]/75">
            {paymentChoice === "pay_now"
              ? "Your reservation is confirmed. We will provide payment guidance and receipt confirmation."
              : `Your reservation is fully confirmed. You may settle the total of ${formatCurrency(totalPrice ?? 0)} upon arrival or after your service via cash, card, Maya, or GCash.`}
          </p>
        </div>
      </div>

      {staffPreferenceNeedsConfirmation && (
        <div className="mx-auto mb-6 max-w-lg rounded-xl border border-amber-300/35 bg-amber-300/10 px-5 py-3.5 text-left">
          <p className="text-[12px] leading-relaxed text-[#F6EBD6]">
            Our scheduling system has confirmed your appointment. We have noted your therapist
            preference and will ensure optimal specialist matching.
          </p>
        </div>
      )}

      <p className="text-[12px] max-w-md mx-auto" style={WARM_MUTED_STYLE}>
        {mode === "inhouse"
          ? "You can view or adjust this booking anytime from the bookings workspace."
          : "Need to make any adjustments? Please call our concierge desk directly and mention your order number."}
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
            onClick={() => {
              resetCheckoutAttemptId();
            }}
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[13px] font-semibold transition-opacity hover:opacity-90 ${WARM_PRIMARY_BUTTON_CLS}`}
          >
            Book another service
          </Link>
        </div>
      )}
    </div>
  );
}
