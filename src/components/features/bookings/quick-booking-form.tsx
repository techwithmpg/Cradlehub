"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CalendarDays,
  Clock,
  Home,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  CreditCard,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { getBranchWalkInDefaults, parseBookingTime } from "@/lib/bookings/booking-clock-time";
import { createInhouseBookingMultiAction } from "@/lib/actions/inhouse-booking";
import {
  rescheduleBookingAction,
  assignBookingTherapistAction,
  assignBookingRoomAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { getAdministrativeBookingCustomerPrefillAction } from "@/lib/actions/administrative-booking";
import { getAttendanceQueueSuggestionAction } from "@/lib/actions/attendance-queue";
import {
  getBarangayFromGooglePlace,
  getCityFromGooglePlace,
} from "@/lib/location/google-address-components";
import { cn, formatCurrency } from "@/lib/utils";
import {
  PlacesAutocomplete,
  type PlaceSelectResult,
  type PlacesAutocompleteStatus,
} from "@/components/public/places-autocomplete";
import {
  QuickBookingServiceSelector,
  formatServiceDuration,
} from "@/components/features/bookings/quick-booking-service-selector";
import { InlineServiceDurationButtons } from "@/components/features/bookings/inline-service-duration-dropdown";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import type { BranchBookingRules } from "@/lib/validations/booking-rules";
import type { BookingOrderAttendeeInput } from "@/lib/bookings/booking-order-contract";

export type QuickBookingMode = "walkin" | "phone" | "standard_future" | "home_service";

export type QuickBookingServiceOption = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  durationPolicy?: "fixed" | "extendable";
  quoteVersion?: string;
  durationAdjusted?: boolean;
  availableInSpa: boolean;
  availableHomeService: boolean;
  description?: string | null;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
};

export type QuickBookingStaffOption = {
  id: string;
  name: string;
  nickname?: string | null;
  serviceIds: string[];
};

export type QuickBookingResourceOption = {
  id: string;
  name: string;
  type?: string | null;
  capacity?: number | null;
};

export type QuickBookingCustomerOption = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
};

type QuickBookingFormProps = {
  branchId: string;
  branchName: string;
  bookingRules: Pick<
    BranchBookingRules,
    | "inSpaStartTime"
    | "inSpaEndTime"
    | "homeServiceEnabled"
    | "homeServiceStartTime"
    | "homeServiceEndTime"
    | "maxAdvanceBookingDays"
  >;
  initialMode: QuickBookingMode;
  initialCustomer?: QuickBookingCustomerOption | null;
  initialName?: string;
  initialPhone?: string;
  initialServiceId?: string;
  initialStaffId?: string;
  initialResourceId?: string;
  initialDate?: string;
  initialTime?: string;
  initialNotes?: string;
  initialHomeServiceAddress?: string;
  initialHomeServiceAccessNote?: string;
  rescheduleBookingId?: string;
  rescheduleOrderId?: string | null;
  services: QuickBookingServiceOption[];
  staff: QuickBookingStaffOption[];
  resources: QuickBookingResourceOption[];
  successBehavior?: "redirect" | "stay";
  onCancel?: () => void;
  onSuccess?: (result: {
    bookingId: string;
    date: string;
    mode: QuickBookingMode;
    customerId?: string;
    isHomeService: boolean;
  }) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onGroupBookingChange?: (groupBooking: boolean) => void;
  /** Non-submitting layout previews only. CRM creation remains capped at four attendees. */
  previewGuestCapacity?: number;
};

type CustomerSearchRow = {
  id: string;
  full_name: string;
  phone_suffix: string;
};

type CustomerSuggestion = { id: string; fullName: string; phoneSuffix: string };

type SlotRow = {
  staff_id: string;
  slot_time: string;
  available: boolean;
};

type CrmProviderAvailability = {
  staffId: string;
  fullName: string;
  nickname: string | null;
  checkedIn: boolean;
  checkedOut: boolean;
  scheduledForDay: boolean;
  scheduledAtTime: boolean;
  availableAtTime: boolean;
  selectable: boolean;
  recommended: boolean;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  serviceEndTime?: string | null;
  operationalStartTime?: string | null;
  operationalEndTime?: string | null;
  overtimeMinutes?: number;
  operationalOvertimeMinutes?: number;
  operationalStartsBeforeShift?: boolean;
  nextAvailableAt: string | null;
  reasonCode: string;
  statusLabel: string;
  warning: string | null;
};

type CrmAvailabilityResponse = {
  available: boolean;
  message?: string | null;
  warning?: string | null;
  reasonCode?: string | null;
  slots?: SlotRow[];
  availableStaffIds?: string[];
  providers?: CrmProviderAvailability[];
};

type TherapistAvailabilityStatus = "idle" | "loading" | "ready" | "empty" | "error";

type HomeServiceDistanceQuote = {
  distanceKm: number;
  distanceSource: "google_driving" | "haversine_estimate";
  freeKm: number;
  extraKm: number;
  feePerExtraKm: number;
  travelFee: number;
  warning?: string;
};

type FieldErrors = Partial<
  Record<
    | "customer"
    | "fullName"
    | "phone"
    | "service"
    | "staffId"
    | "date"
    | "time"
    | "homeServiceAddress"
    | "paymentMethod",
    string
  >
>;

const MODES: Array<{
  value: QuickBookingMode;
  label: string;
  description: string;
}> = [
  { value: "walkin", label: "Walk-in", description: "Now · In branch" },
  { value: "phone", label: "Phone / Future", description: "Book ahead or schedule by phone" },
  { value: "home_service", label: "Home Service", description: "We go to customer" },
];

const CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE =
  "Please select a valid address from the search results so distance can be calculated.";

const NO_SCHEDULED_THERAPIST_MESSAGE =
  "No qualified therapist can start at this exact time. Try another time or review staff schedules.";

function todayYmd(): string {
  return getBranchWalkInDefaults().date;
}

function nextQuarterTime(): string {
  return getBranchWalkInDefaults().time.slice(0, 5);
}

function normalizeTime(time: string): string {
  const parsed = parseBookingTime(time);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value.canonicalTime;
}

function addDaysYmd(value: string, days: number): string {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const next = new Date(year, month - 1, day + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number | null {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}

function customerName(customer: QuickBookingCustomerOption | null): string {
  return customer?.fullName.trim() || "";
}

function serviceAvailableForMode(
  service: QuickBookingServiceOption,
  mode: QuickBookingMode
): boolean {
  return mode === "home_service" ? service.availableHomeService : service.availableInSpa;
}

function formatAttendanceTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBookingClock(value: string | null | undefined): string {
  if (!value) return "--";
  const parsed = parseBookingTime(value);
  return parsed.ok ? parsed.value.displayTime : value.slice(0, 5);
}

function formatDistanceKm(distanceKm: number): string {
  return `${distanceKm.toFixed(1)} km`;
}

function mapServerErrorToFields(message: string): FieldErrors {
  const normalized = message.toLowerCase();
  if (normalized.includes("customer")) return { customer: message };
  if (normalized.includes("phone")) return { phone: message };
  if (normalized.includes("service")) return { service: message };
  if (normalized.includes("date") || normalized.includes("time") || normalized.includes("slot")) {
    return { time: message };
  }
  if (normalized.includes("address") || normalized.includes("home-service")) {
    return { homeServiceAddress: message };
  }
  if (normalized.includes("payment")) return { paymentMethod: message };
  return {};
}

async function requestCrmAvailability(params: {
  branchId: string;
  serviceIds: string[];
  serviceLines?: Array<{
    serviceId: string;
    requestedDurationMinutes?: number;
    expectedQuoteVersion?: string;
  }>;
  date: string;
  time: string;
  staffId?: string;
  bookingMode: QuickBookingMode;
  deliveryType: "in_spa" | "home_service";
  signal?: AbortSignal;
}): Promise<CrmAvailabilityResponse> {
  const response = await fetch("/api/booking/crm-availability", {
    method: "POST",
    credentials: "same-origin",
    signal: params.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: params.branchId,
      serviceIds: params.serviceIds,
      serviceLines: params.serviceLines,
      date: params.date,
      time: normalizeTime(params.time),
      staffId: params.staffId || undefined,
      bookingMode: params.bookingMode,
      deliveryType: params.deliveryType,
    }),
  });
  const data = (await response.json()) as CrmAvailabilityResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Unable to check CRM availability.");
  }

  return data;
}

export function QuickBookingForm({
  branchId,
  branchName,
  bookingRules,
  initialMode,
  initialCustomer = null,
  initialName = "",
  initialPhone = "",
  initialServiceId = "",
  initialStaffId = "",
  initialResourceId = "",
  initialDate,
  initialTime,
  initialNotes = "",
  initialHomeServiceAddress = "",
  initialHomeServiceAccessNote = "",
  rescheduleBookingId,
  rescheduleOrderId,
  services,
  staff,
  resources,
  successBehavior = "redirect",
  onCancel,
  onSuccess,
  onDirtyChange,
  onGroupBookingChange,
  previewGuestCapacity,
}: QuickBookingFormProps) {
  const router = useRouter();
  const formId = useId();
  const [initialDateValue] = useState(() => initialDate ?? todayYmd());
  const [initialTimeValue] = useState(() =>
    initialTime ? initialTime.slice(0, 5) : nextQuarterTime()
  );
  const seededCustomerQuery = initialCustomer?.fullName || initialName || "";
  const [mode, setMode] = useState<QuickBookingMode>(initialMode);
  const isPhoneFuture = mode === "phone" || mode === "standard_future";
  const [selectedCustomer, setSelectedCustomer] = useState<QuickBookingCustomerOption | null>(
    initialCustomer
  );
  const [customerQuery, setCustomerQuery] = useState(seededCustomerQuery);
  const [customerResults, setCustomerResults] = useState<CustomerSuggestion[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const [customerSearchRetry, setCustomerSearchRetry] = useState(0);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(-1);
  const [loadingCustomerIdentity, setLoadingCustomerIdentity] = useState(false);
  const selectionGeneration = useRef(0);
  const [fullName, setFullName] = useState(initialCustomer?.fullName ?? initialName);
  const [phone, setPhone] = useState(initialCustomer?.phone ?? initialPhone);
  const [email, setEmail] = useState(initialCustomer?.email ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    initialServiceId ? [initialServiceId] : []
  );
  const [lineQuotes, setLineQuotes] = useState<Record<string, ServiceLineQuote>>({});
  const [firstAttendeeId] = useState(() => crypto.randomUUID());
  const [additionalGuests, setAdditionalGuests] = useState<BookingOrderAttendeeInput[]>([]);
  const [durationEditorServiceByGuest, setDurationEditorServiceByGuest] = useState<
    Record<string, string>
  >({});
  const [summaryGuestPage, setSummaryGuestPage] = useState(0);
  const guestScrollRef = useRef<HTMLDivElement>(null);
  const groupBooking = additionalGuests.length > 0;
  const guestCardCapacity = Math.max(4, Math.min(20, previewGuestCapacity ?? 4));
  const organizerDraft: BookingOrderAttendeeInput = {
    id: firstAttendeeId,
    name: fullName.trim(),
    isOrganizer: true,
    serviceIds: selectedServiceIds,
  };
  const attendeeDrafts: BookingOrderAttendeeInput[] = [organizerDraft, ...additionalGuests];
  const visibleSummaryPage = Math.min(summaryGuestPage, Math.ceil(attendeeDrafts.length / 2) - 1);
  const allSelectedServiceIds = [
    ...new Set(attendeeDrafts.flatMap((attendee) => attendee.serviceIds)),
  ];
  const [serviceModeNotice, setServiceModeNotice] = useState("");
  const [date, setDate] = useState(initialDateValue);
  const [time, setTime] = useState(initialTimeValue);
  const [notes, setNotes] = useState(initialNotes);
  const [homeServiceAddress, setHomeServiceAddress] = useState(initialHomeServiceAddress);
  const [homeServicePlace, setHomeServicePlace] = useState<PlaceSelectResult | null>(null);
  const [homeServiceBarangay, setHomeServiceBarangay] = useState("");
  const [homeServiceCity, setHomeServiceCity] = useState("");
  const [homeServiceAccessNote, setHomeServiceAccessNote] = useState(initialHomeServiceAccessNote);
  const [placesStatus, setPlacesStatus] = useState<PlacesAutocompleteStatus>("idle");
  const [homeServiceDistanceStatus, setHomeServiceDistanceStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [homeServiceDistanceError, setHomeServiceDistanceError] = useState("");
  const [homeServiceDistanceQuote, setHomeServiceDistanceQuote] =
    useState<HomeServiceDistanceQuote | null>(null);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const submissionKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "maya" | "card" | "">("");
  const [staffId, setStaffId] = useState(initialStaffId);
  const [therapistSelectionMode, setTherapistSelectionMode] = useState<"automatic" | "manual">(
    initialStaffId ? "manual" : "automatic"
  );
  const [customerRequestedTherapist, setCustomerRequestedTherapist] = useState(false);
  const [resourceId, setResourceId] = useState(initialResourceId);
  const [moreOpen, setMoreOpen] = useState(false);
  const [attendanceHint, setAttendanceHint] = useState<{
    staffId: string;
    fullName: string;
    nickname: string | null;
    queuePosition: number;
    checkedInAt: string | null;
  } | null>(null);
  const [, setLoadingAttendanceHint] = useState(false);
  const [availableStaffIds, setAvailableStaffIds] = useState<string[]>([]);
  const [providerAvailability, setProviderAvailability] = useState<CrmProviderAvailability[]>([]);
  const [guestProviderAvailability, setGuestProviderAvailability] = useState<
    Record<string, CrmProviderAvailability[]>
  >({});
  const [guestAvailabilityPending, setGuestAvailabilityPending] = useState(false);
  const [guestSelectedStaffIds, setGuestSelectedStaffIds] = useState<Record<string, string>>({});
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [therapistAvailabilityStatus, setTherapistAvailabilityStatus] =
    useState<TherapistAvailabilityStatus>("idle");
  const [therapistAvailabilityMessage, setTherapistAvailabilityMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loadingNextSlot, setLoadingNextSlot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [slotChecking, setSlotChecking] = useState(false);

  useEffect(() => {
    if (additionalGuests.length === 0) return;
    const guestArea = guestScrollRef.current;
    if (guestArea) guestArea.scrollTop = guestArea.scrollHeight;
  }, [additionalGuests.length]);

  const handleDurationChange = (
    guestId: string,
    service: QuickBookingServiceOption,
    quote: ServiceLineQuote
  ) => {
    setLineQuotes((current) => ({
      ...current,
      [`${guestId}:${service.id}`]: quote,
    }));
    setResourceId("");
    setAvailableStaffIds([]);
    setProviderAvailability([]);
    setTherapistAvailabilityStatus("loading");
    setFormError("");
  };

  const isHomeService = mode === "home_service";
  const initialSelectedServiceIds = useMemo(
    () => (initialServiceId ? [initialServiceId] : []),
    [initialServiceId]
  );
  const eligibleServices = useMemo(
    () => services.filter((service) => serviceAvailableForMode(service, mode)),
    [mode, services]
  );
  const selectedServices = useMemo(
    () =>
      selectedServiceIds
        .map((id) => services.find((service) => service.id === id))
        .filter((service): service is QuickBookingServiceOption => Boolean(service)),
    [selectedServiceIds, services]
  );
  const quotedService = (
    guestId: string,
    service: QuickBookingServiceOption
  ): QuickBookingServiceOption => {
    const quote = lineQuotes[`${guestId}:${service.id}`];
    return quote
      ? {
          ...service,
          durationMinutes: quote.selectedDurationMinutes,
          price: quote.calculatedPrice,
          durationAdjusted: quote.selectedDurationMinutes !== service.durationMinutes,
        }
      : service;
  };
  const selectedQuotedServices = selectedServices.map((service) =>
    quotedService(firstAttendeeId, service)
  );
  const selectedServiceCount = selectedServices.length;
  const totalDurationMinutes = selectedQuotedServices.reduce(
    (sum, service) => sum + service.durationMinutes,
    0
  );
  const totalPrice = selectedQuotedServices.reduce((sum, service) => sum + service.price, 0);
  const groupServices = groupBooking
    ? attendeeDrafts.flatMap((attendee) =>
        attendee.serviceIds
          .map((id) => services.find((service) => service.id === id))
          .filter((service): service is QuickBookingServiceOption => Boolean(service))
          .map((service) => quotedService(attendee.id, service))
      )
    : selectedQuotedServices;
  const groupTotalPrice = groupServices.reduce((sum, service) => sum + service.price, 0);
  const serviceSummaryLabel =
    selectedServiceCount === 0
      ? "Not selected"
      : `${selectedServiceCount} service${selectedServiceCount === 1 ? "" : "s"} · ${formatServiceDuration(totalDurationMinutes)} · ${formatCurrency(totalPrice)}`;
  const selectedStaff = staff.find((member) => member.id === staffId) ?? null;
  const selectedResource = resources.find((resource) => resource.id === resourceId) ?? null;
  const providerCandidates = useMemo(() => staff, [staff]);
  const availableStaffIdSet = useMemo(() => new Set(availableStaffIds), [availableStaffIds]);
  const providerById = useMemo(
    () => new Map(providerAvailability.map((provider) => [provider.staffId, provider])),
    [providerAvailability]
  );
  const selectedProviderAvailability = staffId ? (providerById.get(staffId) ?? null) : null;
  const effectiveProviderAvailability =
    selectedProviderAvailability ??
    providerAvailability.find((provider) => provider.selectable) ??
    null;
  const provisionalGuestStaff = new Map<string, CrmProviderAvailability>();
  const reservedGuestStaffIds = new Set<string>();
  for (const attendee of attendeeDrafts) {
    const providers =
      attendee.id === firstAttendeeId
        ? providerAvailability
        : (guestProviderAvailability[attendee.id] ?? []);
    const exactId = attendee.id === firstAttendeeId ? staffId : guestSelectedStaffIds[attendee.id];
    const provisional = exactId
      ? providers.find((provider) => provider.staffId === exactId && provider.selectable)
      : (providers.find(
          (provider) =>
            provider.selectable &&
            provider.recommended &&
            !reservedGuestStaffIds.has(provider.staffId)
        ) ??
        providers.find(
          (provider) => provider.selectable && !reservedGuestStaffIds.has(provider.staffId)
        ));
    if (provisional) {
      provisionalGuestStaff.set(attendee.id, provisional);
      reservedGuestStaffIds.add(provisional.staffId);
    }
  }
  const therapistPrerequisitesReady =
    selectedServiceIds.length > 0 && Boolean(date) && Boolean(time);
  const eligibleAttendanceHint =
    attendanceHint && availableStaffIdSet.has(attendanceHint.staffId) ? attendanceHint : null;
  const slotIsAllowedByRules = useCallback(
    (slotTime: string, candidateMode: QuickBookingMode): boolean => {
      if (candidateMode === "home_service" && !bookingRules.homeServiceEnabled) return false;

      const slotMinutes = timeToMinutes(slotTime);
      const startMinutes = timeToMinutes(
        candidateMode === "home_service"
          ? bookingRules.homeServiceStartTime
          : bookingRules.inSpaStartTime
      );
      const endMinutes = timeToMinutes(
        candidateMode === "home_service"
          ? bookingRules.homeServiceEndTime
          : bookingRules.inSpaEndTime
      );

      return (
        slotMinutes !== null &&
        startMinutes !== null &&
        endMinutes !== null &&
        slotMinutes >= startMinutes &&
        slotMinutes <= endMinutes
      );
    },
    [bookingRules]
  );

  const savedRescheduleBaseline = useRef({
    date: initialDateValue,
    time: normalizeTime(initialTimeValue),
    notes: initialNotes.trim(),
    homeServiceAddress: initialHomeServiceAddress.trim(),
    homeServiceAccessNote: initialHomeServiceAccessNote.trim(),
    staffId: initialStaffId,
    resourceId: initialResourceId,
  });

  const dirty = useMemo(
    () =>
      mode !== initialMode ||
      selectedCustomer?.id !== initialCustomer?.id ||
      customerQuery !== seededCustomerQuery ||
      fullName !== (initialCustomer?.fullName ?? initialName) ||
      phone !== (initialCustomer?.phone ?? initialPhone) ||
      email !== (initialCustomer?.email ?? "") ||
      selectedServiceIds.length !== initialSelectedServiceIds.length ||
      selectedServiceIds.some((id, index) => id !== initialSelectedServiceIds[index]) ||
      additionalGuests.length > 0 ||
      Object.values(guestSelectedStaffIds).some(Boolean) ||
      Object.keys(lineQuotes).length > 0 ||
      date !== initialDateValue ||
      time !== initialTimeValue ||
      notes !== initialNotes ||
      homeServiceAddress !== initialHomeServiceAddress ||
      homeServicePlace !== null ||
      homeServiceBarangay !== "" ||
      homeServiceCity !== "" ||
      homeServiceAccessNote !== initialHomeServiceAccessNote ||
      paymentReceived ||
      paymentMethod !== "" ||
      staffId !== initialStaffId ||
      customerRequestedTherapist ||
      resourceId !== initialResourceId,
    [
      customerQuery,
      date,
      email,
      fullName,
      homeServiceAddress,
      homeServiceAccessNote,
      homeServiceBarangay,
      homeServiceCity,
      homeServicePlace,
      initialCustomer,
      initialDateValue,
      initialHomeServiceAccessNote,
      initialHomeServiceAddress,
      initialMode,
      initialName,
      initialNotes,
      initialPhone,
      initialResourceId,
      initialSelectedServiceIds,
      initialStaffId,
      initialTimeValue,
      mode,
      notes,
      paymentMethod,
      paymentReceived,
      phone,
      resourceId,
      selectedCustomer,
      selectedServiceIds,
      additionalGuests,
      guestSelectedStaffIds,
      lineQuotes,
      seededCustomerQuery,
      staffId,
      customerRequestedTherapist,
      time,
    ]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onGroupBookingChange?.(groupBooking);
  }, [groupBooking, onGroupBookingChange]);

  useEffect(() => {
    const controller = new AbortController();
    const id = window.setTimeout(() => {
      if (!therapistPrerequisitesReady) {
        setAvailableStaffIds([]);
        setProviderAvailability([]);
        setAvailableTimeSlots([]);
        setTherapistAvailabilityStatus("idle");
        setTherapistAvailabilityMessage("");
        return;
      }

      setAvailableStaffIds([]);
      setProviderAvailability([]);
      setAvailableTimeSlots([]);
      setTherapistAvailabilityStatus("loading");
      setTherapistAvailabilityMessage("");

      requestCrmAvailability({
        branchId,
        serviceIds: selectedServiceIds,
        serviceLines: selectedServiceIds.map((serviceId) => ({
          serviceId,
          requestedDurationMinutes:
            lineQuotes[`${firstAttendeeId}:${serviceId}`]?.selectedDurationMinutes,
          expectedQuoteVersion:
            lineQuotes[`${firstAttendeeId}:${serviceId}`]?.quoteVersion ??
            services.find((service) => service.id === serviceId)?.quoteVersion,
        })),
        date,
        time,
        bookingMode: mode,
        deliveryType: isHomeService ? "home_service" : "in_spa",
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          const nextAvailableStaffIds = Array.from(new Set(result.availableStaffIds ?? []));
          const nextProviders =
            result.providers ??
            providerCandidates.map((member) => ({
              staffId: member.id,
              fullName: member.name,
              nickname: member.nickname ?? null,
              checkedIn: false,
              checkedOut: false,
              scheduledForDay: nextAvailableStaffIds.includes(member.id),
              scheduledAtTime: nextAvailableStaffIds.includes(member.id),
              availableAtTime: nextAvailableStaffIds.includes(member.id),
              selectable: nextAvailableStaffIds.includes(member.id),
              recommended: false,
              scheduleStartTime: null,
              scheduleEndTime: null,
              serviceEndTime: null,
              operationalStartTime: null,
              operationalEndTime: null,
              overtimeMinutes: 0,
              operationalOvertimeMinutes: 0,
              operationalStartsBeforeShift: false,
              nextAvailableAt: null,
              reasonCode: nextAvailableStaffIds.includes(member.id)
                ? "scheduled_available_not_checked_in"
                : "not_scheduled_at_time",
              statusLabel: nextAvailableStaffIds.includes(member.id)
                ? "Scheduled · Available"
                : "Not available at this time",
              warning: null,
            }));
          const selectableProviders = nextProviders.filter((provider) => provider.selectable);
          setAvailableStaffIds(nextAvailableStaffIds);
          setProviderAvailability(nextProviders);
          setAvailableTimeSlots(
            isPhoneFuture
              ? [
                  ...new Set(
                    (result.slots ?? [])
                      .filter(
                        (slot) =>
                          slot.available &&
                          (!staffId || slot.staff_id === staffId) &&
                          slotIsAllowedByRules(slot.slot_time, mode)
                      )
                      .map((slot) => slot.slot_time.slice(0, 5))
                  ),
                ].slice(0, 8)
              : []
          );
          setTherapistAvailabilityStatus(selectableProviders.length > 0 ? "ready" : "empty");
          setTherapistAvailabilityMessage(
            selectableProviders.length > 0 ? "" : (result.message ?? NO_SCHEDULED_THERAPIST_MESSAGE)
          );

          if (nextAvailableStaffIds.length > 0) {
            setFieldErrors((current) => ({ ...current, time: undefined }));
            setFormError("");
          }

          // Keep an explicit selection visible when inputs change. The exact
          // server check must reject it if it is no longer available.
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setAvailableStaffIds([]);
          setProviderAvailability([]);
          setAvailableTimeSlots([]);
          setTherapistAvailabilityStatus("error");
          setTherapistAvailabilityMessage(
            error instanceof Error ? error.message : "Therapist availability could not be checked."
          );
        });
    }, 250);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [
    branchId,
    date,
    isHomeService,
    isPhoneFuture,
    mode,
    selectedServiceIds,
    providerCandidates,
    staff,
    staffId,
    therapistPrerequisitesReady,
    time,
    lineQuotes,
    firstAttendeeId,
    services,
    slotIsAllowedByRules,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    if (!groupBooking || !date || !time) return;
    const guestsToCheck = additionalGuests
      .slice(0, 3)
      .filter((guest) => guest.serviceIds.length > 0);
    if (guestsToCheck.length === 0) return;
    const id = window.setTimeout(() => {
      setGuestAvailabilityPending(true);
      setGuestProviderAvailability({});
      Promise.all(
        guestsToCheck.map(async (guest) => {
          const result = await requestCrmAvailability({
            branchId,
            serviceIds: guest.serviceIds,
            serviceLines: guest.serviceIds.map((serviceId) => ({
              serviceId,
              requestedDurationMinutes:
                lineQuotes[`${guest.id}:${serviceId}`]?.selectedDurationMinutes,
              expectedQuoteVersion:
                lineQuotes[`${guest.id}:${serviceId}`]?.quoteVersion ??
                services.find((service) => service.id === serviceId)?.quoteVersion,
            })),
            date,
            time,
            bookingMode: mode,
            deliveryType: isHomeService ? "home_service" : "in_spa",
            signal: controller.signal,
          });
          return [guest.id, result.providers ?? []] as const;
        })
      )
        .then((results) => {
          if (!controller.signal.aborted) setGuestProviderAvailability(Object.fromEntries(results));
        })
        .catch(() => {
          if (!controller.signal.aborted) setGuestProviderAvailability({});
        })
        .finally(() => {
          if (!controller.signal.aborted) setGuestAvailabilityPending(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [
    additionalGuests,
    branchId,
    date,
    time,
    mode,
    isHomeService,
    lineQuotes,
    services,
    groupBooking,
  ]);

  // Fetch attendance queue hint when date or services change.
  // State updates only happen inside async callbacks to avoid synchronous
  // setState in the effect body.
  useEffect(() => {
    const controller = new AbortController();
    const id = window.setTimeout(() => {
      if (!branchId || !date || controller.signal.aborted) return;
      if (mode !== "walkin" || date !== todayYmd()) {
        setAttendanceHint(null);
        setLoadingAttendanceHint(false);
        return;
      }
      setLoadingAttendanceHint(true);
      getAttendanceQueueSuggestionAction({
        branchId,
        date,
        serviceIds: selectedServiceIds,
        serviceId: selectedServiceIds[0] ?? null,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setAttendanceHint(result.success ? result.suggestion : null);
        })
        .catch(() => setAttendanceHint(null))
        .finally(() => {
          if (!controller.signal.aborted) setLoadingAttendanceHint(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [branchId, date, mode, selectedServiceIds]);

  useEffect(() => {
    const query = customerQuery.trim();
    if (query.length < 2 || customerName(selectedCustomer) === query) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const id = window.setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, {
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Customer search unavailable.");
          return response.json();
        })
        .then((data: { customers?: CustomerSearchRow[] }) => {
          if (!active) return;
          setCustomerResults(
            (data.customers ?? []).map((customer) => ({
              id: customer.id,
              fullName: customer.full_name,
              phoneSuffix: customer.phone_suffix,
            }))
          );
          setCustomerSearchError("");
          setActiveCustomerIndex(-1);
        })
        .catch((error) => {
          if (active && !(error instanceof DOMException && error.name === "AbortError")) {
            setCustomerResults([]);
            setCustomerSearchError("Customer search unavailable. Try again.");
          }
        })
        .finally(() => {
          if (active) setSearchingCustomers(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(id);
      controller.abort();
    };
  }, [customerQuery, selectedCustomer, customerSearchRetry]);

  useEffect(() => {
    if (!isHomeService || !homeServicePlace) return;

    const controller = new AbortController();
    const id = window.setTimeout(() => {
      setHomeServiceDistanceStatus("loading");
      setHomeServiceDistanceError("");

      fetch("/api/home-service/distance", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          bookingType: "home_service",
          destination: {
            lat: homeServicePlace.lat,
            lng: homeServicePlace.lng,
          },
        }),
      })
        .then(async (response) => {
          const data = (await response.json()) as HomeServiceDistanceQuote | { error?: string };
          if (!response.ok) {
            throw new Error(
              "error" in data && data.error
                ? data.error
                : "Could not calculate home-service distance."
            );
          }
          setHomeServiceDistanceQuote(data as HomeServiceDistanceQuote);
          setHomeServiceDistanceStatus("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setHomeServiceDistanceQuote(null);
          setHomeServiceDistanceStatus("error");
          setHomeServiceDistanceError(
            error instanceof Error ? error.message : "Could not calculate home-service distance."
          );
        });
    }, 0);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [branchId, homeServicePlace, isHomeService]);

  function changeMode(nextMode: QuickBookingMode) {
    if (nextMode === mode) return;
    const validServiceIds = selectedServiceIds.filter((id) => {
      const service = services.find((item) => item.id === id);
      return service ? serviceAvailableForMode(service, nextMode) : false;
    });
    const removedCount = selectedServiceIds.length - validServiceIds.length;
    setMode(nextMode);
    setLineQuotes({});
    setFieldErrors({});
    setFormError("");
    setSelectedServiceIds(validServiceIds);
    setAdditionalGuests((current) =>
      current.map((guest) => ({
        ...guest,
        serviceIds: guest.serviceIds.filter((id) => {
          const service = services.find((item) => item.id === id);
          return service ? serviceAvailableForMode(service, nextMode) : false;
        }),
      }))
    );
    if (removedCount > 0) {
      setServiceModeNotice(
        validServiceIds.length === 0
          ? `Services were cleared because they are not available for ${nextMode === "home_service" ? "Home Service" : "in-spa"} bookings.`
          : `${removedCount} service${removedCount === 1 ? "" : "s"} removed because ${removedCount === 1 ? "it is" : "they are"} not available for ${nextMode === "home_service" ? "Home Service" : "in-spa"} bookings.`
      );
    } else {
      setServiceModeNotice("");
    }
    if (nextMode === "walkin") {
      setDate(todayYmd());
      setTime(nextQuarterTime());
    }
    setPaymentReceived(false);
    setPaymentMethod("");
    if (nextMode === "home_service") {
      setResourceId("");
    }
  }

  function handleServiceSelectionChange(nextServiceIds: string[]) {
    setLineQuotes((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) =>
            !key.startsWith(`${firstAttendeeId}:`) ||
            nextServiceIds.includes(key.slice(firstAttendeeId.length + 1))
        )
      )
    );
    setSelectedServiceIds(nextServiceIds);
    setServiceModeNotice("");
    setFieldErrors((current) => ({ ...current, service: undefined }));
  }

  function addGuest() {
    if (additionalGuests.length + 1 >= guestCardCapacity) return;
    const id = crypto.randomUUID();
    setAdditionalGuests((current) => [
      ...current,
      {
        id,
        name: "",
        isOrganizer: false,
        serviceIds: [],
      },
    ]);
    setResourceId("");
    setFieldErrors((current) => ({ ...current, service: undefined }));
  }

  function removeGuest(id: string) {
    setSummaryGuestPage(0);
    setLineQuotes((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${id}:`)))
    );
    setAdditionalGuests((current) => current.filter((guest) => guest.id !== id));
    setGuestSelectedStaffIds((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setFieldErrors((current) => ({ ...current, service: undefined }));
  }

  function copyServicesToNextGuest(sourceId: string) {
    const sourceIndex = attendeeDrafts.findIndex((guest) => guest.id === sourceId);
    const source = attendeeDrafts[sourceIndex];
    const target = attendeeDrafts[sourceIndex + 1];
    if (!source || !target || source.serviceIds.length === 0) return;
    setAdditionalGuests((current) =>
      current.map((guest) =>
        guest.id === target.id ? { ...guest, serviceIds: [...source.serviceIds] } : guest
      )
    );
    setLineQuotes((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${target.id}:`))
      );
      for (const serviceId of source.serviceIds) {
        const quote = current[`${source.id}:${serviceId}`];
        if (quote) next[`${target.id}:${serviceId}`] = quote;
      }
      return next;
    });
  }

  function clearBookingGuests() {
    setSummaryGuestPage(0);
    setSelectedServiceIds([]);
    setAdditionalGuests([]);
    setGuestSelectedStaffIds({});
    setLineQuotes({});
    setDurationEditorServiceByGuest({});
    setStaffId("");
    setTherapistSelectionMode("automatic");
    setCustomerRequestedTherapist(false);
    setResourceId("");
    setFieldErrors((current) => ({ ...current, service: undefined }));
  }

  function setGuestServiceIds(guestId: string, serviceIds: string[]) {
    if (guestId === firstAttendeeId) {
      handleServiceSelectionChange(serviceIds);
      return;
    }
    setLineQuotes((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) =>
            !key.startsWith(`${guestId}:`) || serviceIds.includes(key.slice(guestId.length + 1))
        )
      )
    );
    setAdditionalGuests((current) =>
      current.map((guest) => (guest.id === guestId ? { ...guest, serviceIds } : guest))
    );
    setFieldErrors((current) => ({ ...current, service: undefined }));
  }

  async function selectCustomer(customer: CustomerSuggestion) {
    const generation = ++selectionGeneration.current;
    setSearchingCustomers(false);
    setLoadingCustomerIdentity(true);
    setCustomerSearchOpen(false);
    setActiveCustomerIndex(-1);
    setCustomerSearchError("");
    try {
      const result = await getAdministrativeBookingCustomerPrefillAction({
        customerId: customer.id,
      });
      if (generation !== selectionGeneration.current) return;
      if (!result.ok || !result.customer || result.customer.id !== customer.id) {
        setCustomerSearchError("Customer could not be loaded. Try selecting again.");
        setCustomerSearchOpen(true);
        return;
      }
      const identity = result.customer;
      setSelectedCustomer(identity);
      setCustomerQuery(identity.fullName);
      setFullName(identity.fullName);
      setPhone(identity.phone);
      setEmail(identity.email ?? "");
      setCustomerResults([]);
      setFieldErrors((current) => ({
        ...current,
        customer: undefined,
        fullName: undefined,
        phone: undefined,
      }));
    } catch {
      if (generation === selectionGeneration.current) {
        setCustomerSearchError("Customer could not be loaded. Try selecting again.");
        setCustomerSearchOpen(true);
      }
    } finally {
      if (generation === selectionGeneration.current) setLoadingCustomerIdentity(false);
    }
  }

  function chooseNewCustomerName() {
    ++selectionGeneration.current;
    setSelectedCustomer(null);
    setCustomerSearchOpen(false);
    setActiveCustomerIndex(-1);
    setCustomerSearchError("");
    setLoadingCustomerIdentity(false);
    setSearchingCustomers(false);
  }

  function clearSelectedCustomer() {
    ++selectionGeneration.current;
    setSelectedCustomer(null);
    setPhone("");
    setEmail("");
    setCustomerResults([]);
    setCustomerSearchOpen(true);
    setActiveCustomerIndex(-1);
    setSearchingCustomers(customerQuery.trim().length >= 2);
    setCustomerSearchRetry((current) => current + 1);
  }

  function handleHomeServicePlaceSelect(result: PlaceSelectResult | null) {
    const verified =
      result &&
      result.placeId.trim() &&
      result.formattedAddress.trim() &&
      Number.isFinite(result.lat) &&
      Math.abs(result.lat) <= 90 &&
      Number.isFinite(result.lng) &&
      Math.abs(result.lng) <= 180
        ? result
        : null;
    setHomeServicePlace(verified);
    setHomeServiceDistanceQuote(null);
    setHomeServiceDistanceStatus("idle");
    setHomeServiceDistanceError("");

    if (!verified) {
      setHomeServiceBarangay("");
      setHomeServiceCity("");
      if (result)
        setFieldErrors((current) => ({
          ...current,
          homeServiceAddress: CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
        }));
      return;
    }

    setHomeServiceAddress(verified.formattedAddress);
    setHomeServiceBarangay(getBarangayFromGooglePlace(verified));
    setHomeServiceCity(getCityFromGooglePlace(verified));
    setFieldErrors((current) => ({
      ...current,
      homeServiceAddress: undefined,
    }));
  }

  function validate(): FieldErrors {
    const nextErrors: FieldErrors = {};
    if (!fullName.trim()) nextErrors.fullName = "Enter the customer's name.";
    if (!phone.trim()) nextErrors.phone = "Enter the customer's phone number.";
    if (phone.trim() && phone.trim().length < 7) {
      nextErrors.phone = "Enter the customer's phone number.";
    }
    if (selectedServiceIds.length === 0) {
      nextErrors.service = "Select at least one service.";
    } else if (selectedServiceIds.length > 5) {
      nextErrors.service = "You can select up to 5 services per booking.";
    } else if (
      rescheduleBookingId &&
      initialServiceId &&
      (selectedServiceIds.length !== 1 ||
        selectedServiceIds[0] !== initialServiceId ||
        additionalGuests.length > 0 ||
        Object.keys(lineQuotes).length > 0)
    ) {
      nextErrors.service =
        "Service or duration changes require financial adjustment and cannot be applied during a schedule update.";
    }
    if (
      additionalGuests.some(
        (guest) =>
          !guest.name?.trim() || guest.name.trim().length < 2 || guest.serviceIds.length === 0
      )
    ) {
      nextErrors.service =
        "Enter each guest's name and select at least one service for each guest.";
    }
    if (!date) nextErrors.date = "Choose a valid date and time.";
    if (!time) nextErrors.time = "Choose a valid date and time.";
    if (!groupBooking && therapistSelectionMode === "manual" && !staffId) {
      nextErrors.staffId = "Choose an available therapist or select Automatic.";
    }
    if (isHomeService) {
      const addressUnchangedDuringReschedule =
        Boolean(rescheduleBookingId) &&
        Boolean(initialHomeServiceAddress.trim()) &&
        homeServiceAddress.trim() === initialHomeServiceAddress.trim();
      if (!homeServiceAddress.trim()) {
        nextErrors.homeServiceAddress = "Enter the complete home-service address.";
      } else if (!homeServicePlace && !addressUnchangedDuringReschedule) {
        nextErrors.homeServiceAddress = CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE;
      }
    }
    if (paymentReceived && !paymentMethod) {
      nextErrors.paymentMethod = "Please select a payment method.";
    }
    return nextErrors;
  }

  async function chooseNextAvailable() {
    if (selectedServiceIds.length === 0) {
      setFieldErrors((current) => ({ ...current, service: "Select at least one service." }));
      return;
    }
    if (!date) {
      setFieldErrors((current) => ({ ...current, date: "Choose a valid date and time." }));
      return;
    }

    setLoadingNextSlot(true);
    setFormError("");
    try {
      const maxDaysToSearch = Math.min(14, Math.max(1, bookingRules.maxAdvanceBookingDays + 1));
      for (let offset = 0; offset < maxDaysToSearch; offset += 1) {
        const candidateDate = addDaysYmd(date, offset);
        const data = await fetchCrmAvailability(candidateDate, time || "00:00", staffId || null);
        const nextSlot = (data.slots ?? []).find(
          (slot) =>
            slot.available &&
            (!staffId || slot.staff_id === staffId) &&
            slotIsAllowedByRules(slot.slot_time, mode)
        );
        if (nextSlot) {
          setDate(candidateDate);
          setTime(nextSlot.slot_time.slice(0, 5));
          setFieldErrors((current) => ({ ...current, date: undefined, time: undefined }));
          return;
        }
      }

      setFieldErrors((current) => ({
        ...current,
        time: NO_SCHEDULED_THERAPIST_MESSAGE,
      }));
    } catch {
      setFormError("Unable to find the next available time. Choose a valid date and time.");
    } finally {
      setLoadingNextSlot(false);
    }
  }

  async function fetchCrmAvailability(
    availabilityDate: string,
    availabilityTime: string,
    candidateStaffId: string | null
  ): Promise<CrmAvailabilityResponse> {
    if (selectedServiceIds.length === 0 || !availabilityDate || !availabilityTime) {
      return { available: false, message: NO_SCHEDULED_THERAPIST_MESSAGE, slots: [] };
    }

    return requestCrmAvailability({
      branchId,
      serviceIds: selectedServiceIds,
      serviceLines: selectedServiceIds.map((serviceId) => ({
        serviceId,
        requestedDurationMinutes:
          lineQuotes[`${firstAttendeeId}:${serviceId}`]?.selectedDurationMinutes,
        expectedQuoteVersion:
          lineQuotes[`${firstAttendeeId}:${serviceId}`]?.quoteVersion ??
          services.find((service) => service.id === serviceId)?.quoteVersion,
      })),
      date: availabilityDate,
      time: availabilityTime,
      staffId: candidateStaffId || undefined,
      bookingMode: mode,
      deliveryType: isHomeService ? "home_service" : "in_spa",
    });
  }

  async function submit() {
    if (isSaving || slotChecking || loadingCustomerIdentity) return;
    if (attendeeDrafts.length > 4) {
      setFormError(
        "Current CRM booking contract supports up to 4 guests. This larger group is a layout preview only."
      );
      return;
    }

    const nextErrors = validate();
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.values(nextErrors).some(Boolean)) {
      const incompleteGuest = additionalGuests.find(
        (guest) =>
          !guest.name?.trim() || guest.name.trim().length < 2 || guest.serviceIds.length === 0
      );
      if (incompleteGuest && guestScrollRef.current) {
        guestScrollRef.current.scrollTop = guestScrollRef.current.scrollHeight;
      } else if (nextErrors.service && guestScrollRef.current) {
        guestScrollRef.current.scrollTop = 0;
      }
      return;
    }
    if (groupBooking && (staffId || Object.values(guestSelectedStaffIds).some(Boolean))) {
      setFormError(
        "Exact per-guest therapist selection is not supported by the current CRM server contract. Restore Automatic for every guest before saving."
      );
      return;
    }

    if (!groupBooking) {
      setSlotChecking(true);
      let availability: CrmAvailabilityResponse;
      try {
        availability = await fetchCrmAvailability(date, time, staffId || null);
      } catch {
        setSlotChecking(false);
        const message = "Unable to check CRM availability. Choose another time or try again.";
        setFieldErrors((current) => ({ ...current, time: message }));
        setFormError(message);
        return;
      }
      setSlotChecking(false);
      if (!availability.available) {
        const message = availability.message ?? NO_SCHEDULED_THERAPIST_MESSAGE;
        setFieldErrors((current) => ({ ...current, time: message }));
        setFormError(message);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (rescheduleBookingId) {
        const baseline = savedRescheduleBaseline.current;
        const normalizedTime = normalizeTime(time);
        const trimmedNotes = notes.trim();
        const trimmedAddress = homeServiceAddress.trim();
        const trimmedAccessNote = homeServiceAccessNote.trim();

        const scheduleOrDetailsChanged =
          date !== baseline.date ||
          normalizedTime !== baseline.time ||
          trimmedNotes !== baseline.notes ||
          (isHomeService &&
            (trimmedAddress !== baseline.homeServiceAddress ||
              trimmedAccessNote !== baseline.homeServiceAccessNote ||
              Boolean(homeServicePlace)));
        const therapistChanged = Boolean(staffId) && staffId !== baseline.staffId;
        const roomChanged = !isHomeService && Boolean(resourceId) && resourceId !== baseline.resourceId;
        const shouldRunReschedule = scheduleOrDetailsChanged || (!therapistChanged && !roomChanged);

        const completedSteps: string[] = [];

        if (shouldRunReschedule) {
          const rescheduleResult = await rescheduleBookingAction({
            bookingId: rescheduleBookingId,
            date,
            startTime: normalizedTime,
            note: trimmedNotes || undefined,
            homeServiceAddress: isHomeService ? trimmedAddress : undefined,
            homeServiceAccessNote: isHomeService ? trimmedAccessNote || undefined : undefined,
            homeServicePlaceId: homeServicePlace?.placeId,
            homeServiceFormattedAddress: homeServicePlace?.formattedAddress,
            homeServiceLat: homeServicePlace?.lat,
            homeServiceLng: homeServicePlace?.lng,
            homeServiceMapUrl: homeServicePlace?.mapUrl,
            homeServiceAddressComponents: homeServicePlace?.addressComponents,
          });

          if (!rescheduleResult.success) {
            const message =
              rescheduleResult.error || "Could not reschedule booking. Please try again.";
            setFormError(message);
            toast.error("Reschedule failed", { description: message });
            return;
          }

          baseline.date = date;
          baseline.time = normalizedTime;
          baseline.notes = trimmedNotes;
          baseline.homeServiceAddress = trimmedAddress;
          baseline.homeServiceAccessNote = trimmedAccessNote;
          completedSteps.push("schedule");
        }

        if (therapistChanged) {
          const staffResult = await assignBookingTherapistAction({
            bookingId: rescheduleBookingId,
            staffId,
            overrideReason: "other",
          });
          if (!staffResult.success) {
            const errorMsg = staffResult.error || "Failed to assign therapist.";
            if (completedSteps.length > 0) {
              notifyBookingsChanged();
              const partialMsg = `Partial update (${completedSteps.join(", ")} saved): ${errorMsg}`;
              setFormError(partialMsg);
              toast.error("Booking partially updated", { description: partialMsg });
            } else {
              setFormError(errorMsg);
              toast.error("Therapist assignment failed", { description: errorMsg });
            }
            return;
          }
          baseline.staffId = staffId;
          completedSteps.push("therapist");
        }

        if (roomChanged) {
          const roomResult = await assignBookingRoomAction({
            bookingId: rescheduleBookingId,
            resourceId,
            overrideReason: "other",
          });
          if (!roomResult.success) {
            const errorMsg = roomResult.error || "Failed to assign room.";
            if (completedSteps.length > 0) {
              notifyBookingsChanged();
              const partialMsg = `Partial update (${completedSteps.join(", ")} saved): ${errorMsg}`;
              setFormError(partialMsg);
              toast.error("Booking partially updated", { description: partialMsg });
            } else {
              setFormError(errorMsg);
              toast.error("Room assignment failed", { description: errorMsg });
            }
            return;
          }
          baseline.resourceId = resourceId;
          completedSteps.push("room");
        }

        toast.success("Booking updated successfully", {
          description: "The booking schedule has been updated.",
        });
        notifyBookingsChanged();
        if (onSuccess) {
          onSuccess({
            bookingId: rescheduleBookingId,
            date,
            mode,
            customerId: selectedCustomer?.id,
            isHomeService,
          });
        } else if (onCancel) {
          onCancel();
        } else if (successBehavior === "redirect") {
          const params = new URLSearchParams({
            date,
            bookingId: rescheduleBookingId,
          });
          router.push(`/crm/bookings?${params.toString()}`);
        }
        return;
      }

      const bookingInput = {
        branchId,
        customerId: selectedCustomer?.id,
        serviceIds: groupBooking ? allSelectedServiceIds : selectedServiceIds,
        ...(!groupBooking && {
          serviceLines: selectedServiceIds.map((serviceId) => ({
            serviceId,
            requestedDurationMinutes:
              lineQuotes[`${firstAttendeeId}:${serviceId}`]?.selectedDurationMinutes,
            expectedQuoteVersion:
              lineQuotes[`${firstAttendeeId}:${serviceId}`]?.quoteVersion ??
              services.find((service) => service.id === serviceId)?.quoteVersion,
          })),
        }),
        ...(groupBooking && {
          bookingFor: "me_and_others" as const,
          attendees: attendeeDrafts.map((attendee) => ({
            id: attendee.id,
            name: attendee.name?.trim() ?? "",
            isOrganizer: attendee.isOrganizer ?? false,
            serviceIds: attendee.serviceIds,
            serviceLines: attendee.serviceIds.map((serviceId) => ({
              serviceId,
              requestedDurationMinutes:
                lineQuotes[`${attendee.id}:${serviceId}`]?.selectedDurationMinutes,
              expectedQuoteVersion:
                lineQuotes[`${attendee.id}:${serviceId}`]?.quoteVersion ??
                services.find((service) => service.id === serviceId)?.quoteVersion,
            })),
          })),
        }),
        staffId: staffId || undefined,
        customerRequestedTherapist: Boolean(staffId && customerRequestedTherapist),
        resourceId: isHomeService || groupBooking ? undefined : resourceId || undefined,
        date,
        startTime: normalizeTime(time),
        type: isHomeService ? "home_service" : "walkin",
        deliveryType: isHomeService ? "home_service" : "in_spa",
        crmBookingMode: mode,
        markArrived: mode === "walkin",
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentReceived,
        paymentMethod: paymentReceived && paymentMethod ? paymentMethod : undefined,
        homeServiceAddress: isHomeService ? homeServiceAddress.trim() : undefined,
        homeServiceBarangay: isHomeService ? homeServiceBarangay.trim() || undefined : undefined,
        homeServiceCity: isHomeService ? homeServiceCity.trim() : undefined,
        homeServiceAccessNote: isHomeService
          ? homeServiceAccessNote.trim() || undefined
          : undefined,
        homeServiceLat: isHomeService ? homeServicePlace?.lat : undefined,
        homeServiceLng: isHomeService ? homeServicePlace?.lng : undefined,
        homeServicePlaceId: isHomeService ? homeServicePlace?.placeId : undefined,
        homeServiceFormattedAddress: isHomeService ? homeServicePlace?.formattedAddress : undefined,
        homeServiceAddressComponents: isHomeService
          ? homeServicePlace?.addressComponents
          : undefined,
        homeServiceMapUrl: isHomeService ? homeServicePlace?.mapUrl : undefined,
      };
      const fingerprint = JSON.stringify(bookingInput);
      if (submissionKey.current?.fingerprint !== fingerprint) {
        submissionKey.current = { fingerprint, key: crypto.randomUUID() };
      }
      const result = await createInhouseBookingMultiAction({
        ...bookingInput,
        idempotencyKey: submissionKey.current.key,
      });

      if (!result.ok) {
        const message = result.message || "Could not save booking. Please try again.";
        setFieldErrors(mapServerErrorToFields(message));
        setFormError(message);
        toast.error("Booking not saved", { description: message });
        return;
      }

      toast.success("Booking saved", {
        description: result.warning ?? "The booking is now in the CRM workspace.",
      });
      submissionKey.current = null;
      onSuccess?.({
        bookingId: result.bookingId,
        date,
        mode,
        customerId: selectedCustomer?.id,
        isHomeService,
      });
      notifyBookingsChanged();
      if (successBehavior === "redirect") {
        const params = new URLSearchParams({
          date,
          bookingId: result.bookingId,
        });
        router.push(`/crm/bookings?${params.toString()}`);
      }
    } catch {
      const message = "Could not save booking. Please try again.";
      setFormError(message);
      toast.error("Booking not saved", { description: message });
    } finally {
      setIsSaving(false);
    }
  }

  function renderBookingGuest(attendee: BookingOrderAttendeeInput, index: number) {
    const guestServices = attendee.serviceIds
      .map((id) => services.find((service) => service.id === id))
      .filter((service): service is QuickBookingServiceOption => Boolean(service))
      .map((service) => quotedService(attendee.id, service));
    const guestMinutes = guestServices.reduce((sum, service) => sum + service.durationMinutes, 0);
    const guestPrice = guestServices.reduce((sum, service) => sum + service.price, 0);
    const editingService =
      guestServices.find((service) => service.id === durationEditorServiceByGuest[attendee.id]) ??
      guestServices[0];
    const startMinutes = timeToMinutes(time);
    const endMinutes = startMinutes === null ? null : startMinutes + guestMinutes;
    const finishTime =
      endMinutes === null
        ? ""
        : `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    const isOrganizer = index === 0;

    return (
      <section
        key={attendee.id}
        aria-label={`Guest ${index + 1} booking details`}
        className={cn(
          "min-w-0 rounded-xl border p-2",
          isOrganizer ? "border-[#c9e7d9] bg-[#f5fbf7]" : "border-[#eddac8] bg-[#fffaf4]"
        )}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white",
              isOrganizer ? "bg-[#006044]" : "bg-[#a75b27]"
            )}
          >
            {index + 1}
          </span>
          <strong className="text-sm">Guest {index + 1}</strong>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              isOrganizer ? "bg-[#e0f3e9] text-[#006044]" : "bg-[#faead9] text-[#8a491e]"
            )}
          >
            {isOrganizer ? "Main client" : "Guest of main client"}
          </span>
          {!isOrganizer ? (
            <input
              aria-label={`Guest ${index + 1} name`}
              value={attendee.name ?? ""}
              onChange={(event) =>
                setAdditionalGuests((current) =>
                  current.map((guest) =>
                    guest.id === attendee.id ? { ...guest, name: event.target.value } : guest
                  )
                )
              }
              disabled={isSaving}
              placeholder="Guest name (optional)"
              maxLength={100}
              className="h-7 min-w-0 max-w-44 rounded-md border border-[var(--cs-border)] bg-white px-2 text-xs"
            />
          ) : null}
          {attendeeDrafts.length > 2 && index < attendeeDrafts.length - 1 ? (
            <button
              type="button"
              onClick={() => copyServicesToNextGuest(attendee.id)}
              disabled={isSaving || attendee.serviceIds.length === 0}
              className="ml-auto h-7 rounded-md border border-[var(--cs-border)] bg-white px-2 text-[11px] disabled:opacity-50"
            >
              Copy to Guest {index + 2}
            </button>
          ) : null}
          {!isOrganizer ? (
            <button
              type="button"
              onClick={() => removeGuest(attendee.id)}
              disabled={isSaving}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700"
            >
              <Trash2 size={12} /> Remove
            </button>
          ) : null}
        </div>
        <QuickBookingServiceSelector
          services={eligibleServices.map((service) => quotedService(attendee.id, service))}
          selectedServiceIds={attendee.serviceIds}
          branchId={branchId}
          durationPresentation="guest-buttons"
          onSelectQuote={(service, quote) => handleDurationChange(attendee.id, service, quote)}
          onChange={(ids) => setGuestServiceIds(attendee.id, ids)}
          isHomeService={isHomeService}
          disabled={isSaving}
          error={
            fieldErrors.service && attendee.serviceIds.length === 0
              ? fieldErrors.service
              : undefined
          }
        />
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-[minmax(220px,1.15fr)_minmax(165px,1fr)_minmax(190px,1.35fr)]">
          <div className="min-w-0">
            <FieldLabel icon={<Clock size={13} />} label="Duration" />
            {editingService ? (
              <div className="min-w-0">
                {guestServices.length > 1 ? (
                  <select
                    aria-label={`Service to adjust for Guest ${index + 1}`}
                    value={editingService.id}
                    onChange={(event) =>
                      setDurationEditorServiceByGuest((current) => ({
                        ...current,
                        [attendee.id]: event.target.value,
                      }))
                    }
                    className="mb-1 h-7 w-full rounded-md border border-[var(--cs-border)] bg-white px-1 text-[11px]"
                  >
                    {guestServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {formatCurrency(service.price)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p
                    className="mb-1 truncate text-[11px] font-semibold text-[var(--cs-text-muted)]"
                    title={editingService.name}
                  >
                    {editingService.name}
                  </p>
                )}
                <InlineServiceDurationButtons
                  key={`${attendee.id}:${editingService.id}`}
                  branchId={branchId}
                  service={editingService}
                  deliveryMode={isHomeService ? "home_service" : "in_spa"}
                  disabled={isSaving}
                  onSelectQuote={(quote) =>
                    handleDurationChange(attendee.id, editingService, quote)
                  }
                />
                {guestServices.length > 1 ? (
                  <span className="text-[10px] text-[var(--cs-text-muted)]">
                    {formatServiceDuration(guestMinutes)} across {guestServices.length} services
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex h-8 items-center rounded-lg border border-[var(--cs-border)] bg-white px-2 text-xs">
                Select service
              </div>
            )}
          </div>
          <div className="min-w-0">
            <FieldLabel icon={<User size={13} />} label="Therapist" />
            {(() => {
              const providers = isOrganizer
                ? providerAvailability
                : (guestProviderAvailability[attendee.id] ?? []);
              const selectedId = isOrganizer ? staffId : (guestSelectedStaffIds[attendee.id] ?? "");
              const suggested = provisionalGuestStaff.get(attendee.id);
              const waiting = isOrganizer
                ? therapistAvailabilityStatus === "loading"
                : guestAvailabilityPending;
              return (
                <>
                  <select
                    value={selectedId}
                    onChange={(event) => {
                      if (isOrganizer) {
                        setStaffId(event.target.value);
                        setTherapistSelectionMode(event.target.value ? "manual" : "automatic");
                        setCustomerRequestedTherapist(false);
                      } else {
                        setGuestSelectedStaffIds((current) => ({
                          ...current,
                          [attendee.id]: event.target.value,
                        }));
                      }
                      setFieldErrors((current) => ({ ...current, staffId: undefined }));
                    }}
                    disabled={
                      isSaving ||
                      waiting ||
                      index >= 4 ||
                      attendee.serviceIds.length === 0 ||
                      !date ||
                      !time
                    }
                    aria-label={`Guest ${index + 1} therapist`}
                    className={cn(selectClassName(false), "h-8 text-xs")}
                  >
                    <option value="">
                      {index >= 4
                        ? "Layout preview · availability not checked"
                        : waiting
                          ? "Checking therapists…"
                          : suggested
                            ? `${suggested.nickname || suggested.fullName} · Suggested · ${suggested.statusLabel}`
                            : attendee.serviceIds.length === 0
                              ? "Select service first"
                              : "No available recommendation · Automatic"}
                    </option>
                    {selectedId &&
                    !providers.some((provider) => provider.staffId === selectedId) ? (
                      <option value={selectedId} disabled>
                        {staff.find((member) => member.id === selectedId)?.name ||
                          "Selected therapist"}{" "}
                        · Unavailable
                      </option>
                    ) : null}
                    {providers.map((provider) => {
                      const conflict =
                        groupBooking &&
                        [...provisionalGuestStaff].some(
                          ([guestId, assigned]) =>
                            guestId !== attendee.id && assigned.staffId === provider.staffId
                        );
                      return (
                        <option
                          key={provider.staffId}
                          value={provider.staffId}
                          disabled={!provider.selectable || conflict}
                        >
                          {provider.nickname || provider.fullName} ·{" "}
                          {conflict
                            ? "Provisionally assigned to another guest"
                            : provider.statusLabel}
                        </option>
                      );
                    })}
                  </select>
                  {selectedId &&
                  !providers.some(
                    (provider) => provider.staffId === selectedId && provider.selectable
                  ) &&
                  !waiting ? (
                    <p role="alert" className="mt-1 text-[10px] text-[var(--cs-danger-text)]">
                      Selected therapist is unavailable for these services and time.
                    </p>
                  ) : null}
                  {selectedId &&
                  groupBooking &&
                  [...provisionalGuestStaff].some(
                    ([guestId, assigned]) =>
                      guestId !== attendee.id && assigned.staffId === selectedId
                  ) ? (
                    <p role="alert" className="mt-1 text-[10px] text-[var(--cs-danger-text)]">
                      Therapist is provisionally assigned to another guest at this shared start
                      time.
                    </p>
                  ) : null}
                  {groupBooking && selectedId ? (
                    <p role="status" className="mt-1 text-[10px] text-[var(--cs-warning-text)]">
                      Exact group selection cannot be saved until the per-guest server contract is
                      approved.
                    </p>
                  ) : null}
                </>
              );
            })()}
            {!groupBooking ? <FieldError message={fieldErrors.staffId} /> : null}
            {!groupBooking && therapistSelectionMode === "manual" && staffId ? (
              <label className="mt-1 flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={customerRequestedTherapist}
                  onChange={(event) => setCustomerRequestedTherapist(event.target.checked)}
                  disabled={isSaving}
                />
                Customer requested this therapist
              </label>
            ) : null}
          </div>
          <div className="min-w-0">
            <FieldLabel icon={<CalendarDays size={13} />} label="Shared date & time" />
            <div className="flex gap-1">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={isSaving}
                aria-label={`Guest ${index + 1} shared date`}
                className={cn(
                  inputClassName(Boolean(fieldErrors.date)),
                  "h-8 min-w-0 flex-1 px-1 text-xs"
                )}
              />
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={isSaving}
                aria-label={`Guest ${index + 1} shared start time`}
                className={cn(
                  inputClassName(Boolean(fieldErrors.time)),
                  "h-8 min-w-0 flex-1 px-1 text-xs"
                )}
              />
            </div>
            {isPhoneFuture ? (
              <>
                <button
                  type="button"
                  onClick={chooseNextAvailable}
                  disabled={isSaving || loadingNextSlot}
                  aria-label="Choose next available time"
                  className="mt-1 text-[11px] font-semibold text-[#006044] underline disabled:opacity-50"
                >
                  {loadingNextSlot ? "Finding next available time…" : "Choose next available time"}
                </button>
                {availableTimeSlots.length > 0 ? (
                  <div
                    role="group"
                    aria-label={`Available booking slots for Guest ${index + 1}`}
                    className="mt-1 flex flex-wrap gap-1"
                  >
                    {availableTimeSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        disabled={isSaving}
                        aria-pressed={time === slot}
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px]",
                          time === slot
                            ? "border-[#006044] bg-[#006044] text-white"
                            : "border-[var(--cs-border)] bg-white text-[var(--cs-text)]"
                        )}
                      >
                        {formatBookingClock(slot)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-[minmax(120px,1fr)_minmax(165px,1.35fr)_minmax(190px,1.6fr)]">
          {!isHomeService ? (
            <div className="min-w-0">
              <FieldLabel icon={<MapPin size={13} />} label="Room" />
              {!groupBooking ? (
                <select
                  value={resourceId}
                  onChange={(event) => setResourceId(event.target.value)}
                  disabled={isSaving}
                  className={cn(selectClassName(false), "h-8 text-xs")}
                >
                  <option value="">First available</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex h-8 items-center rounded-lg border border-[var(--cs-border)] bg-white px-2 text-xs">
                  Assigned automatically · review after Save
                </div>
              )}
            </div>
          ) : null}
          <div className="min-w-0">
            <FieldLabel label="Price" />
            <div className="flex h-8 items-center rounded-lg border border-[var(--cs-border)] bg-white px-2 text-xs font-semibold">
              {guestServices.length
                ? `${formatCurrency(guestPrice)} · provisional`
                : "Choose service"}
            </div>
          </div>
          <div className="min-w-0">
            <FieldLabel label="Expected finish" />
            <div className="flex h-8 items-center rounded-lg border border-[var(--cs-border)] bg-white px-2 text-xs">
              {guestServices.length && finishTime
                ? formatBookingClock(finishTime)
                : "After service selection"}
            </div>
          </div>
        </div>
        {isOrganizer && eligibleAttendanceHint ? (
          <p className="mt-1 text-[11px] text-[var(--cs-sand-dark)]">
            Checked-in suggestion:{" "}
            {eligibleAttendanceHint.nickname || eligibleAttendanceHint.fullName}
            {eligibleAttendanceHint.checkedInAt
              ? ` · ${formatAttendanceTime(eligibleAttendanceHint.checkedInAt)}`
              : ""}
            . Final assignment is checked on Save.
          </p>
        ) : null}
      </section>
    );
  }

  function guestFinishClock(attendee: BookingOrderAttendeeInput): string {
    const start = timeToMinutes(time);
    if (start === null || attendee.serviceIds.length === 0) return "Choose service";
    const duration = attendee.serviceIds.reduce(
      (sum, id) =>
        sum +
        (lineQuotes[`${attendee.id}:${id}`]?.selectedDurationMinutes ??
          services.find((service) => service.id === id)?.durationMinutes ??
          0),
      0
    );
    const end = start + duration;
    const endValue = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    return `${formatBookingClock(time)}–${formatBookingClock(endValue)}`;
  }

  return (
    <div className="crm-fade-up h-full min-h-0 bg-[var(--cs-bg)]">
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--cs-surface)]">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--cs-border-soft)] px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* The approved mark is already part of the public brand assets. */}
            <Image
              src="/images/brand/cradle-logo-mark.svg"
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0"
            />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight text-[var(--cs-text)]">
                {rescheduleBookingId ? "Reschedule Booking – " : "New Booking – "}
                {isHomeService ? "Home Service" : isPhoneFuture ? "Phone / Future" : "Walk-in"}
              </h1>
              <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
                Cradle Wellness Living · {branchName}
              </p>
            </div>
          </div>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="grid size-8 place-items-center rounded-lg text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          <div
            className={cn(
              "min-w-0 space-y-1.5 px-4 py-0.5 sm:px-5 lg:min-h-0 lg:overflow-y-auto",
              "lg:flex lg:flex-col"
            )}
          >
            <div className="lg:shrink-0">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {MODES.map((item) => {
                  const ModeIcon =
                    item.value === "walkin" ? User : item.value === "phone" ? Phone : Home;
                  const isSelected = item.value === "phone" ? isPhoneFuture : mode === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        changeMode(item.value === "phone" && initialMode === "standard_future" ? "standard_future" : item.value)
                      }
                      disabled={isSaving}
                      className={cn(
                        "flex min-h-[46px] items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition",
                        isSelected
                          ? "border-[#006044] bg-[#006044] text-white shadow-xs"
                          : "border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:border-[var(--cs-sand-dark)] hover:bg-[var(--cs-surface-warm)]"
                      )}
                      aria-pressed={isSelected}
                    >
                      <ModeIcon
                        size={17}
                        className={cn(
                          "shrink-0",
                          isSelected ? "text-white" : "text-[var(--cs-sand-dark)]"
                        )}
                      />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-xs sm:text-sm font-bold",
                            isSelected ? "text-white" : "text-[var(--cs-text)]"
                          )}
                        >
                          {item.label}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            isSelected ? "text-white/80" : "text-[var(--cs-text-muted)]"
                          )}
                        >
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer Details and Guest Sessions — Shared Two-Column Row */}
            <div
              className={cn(
                "grid items-start gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-white p-2.5",
                "lg:shrink-0"
              )}
            >
              {/* LEFT COLUMN — CUSTOMER DETAILS (~54%) */}
              <div
                className={cn(
                  "grid min-w-0 gap-2",
                  "sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)]"
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--cs-text)] sm:col-span-3">
                  <User size={14} className="text-[#7A583E]" />
                  <span>Customer Information</span>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((current) => !current)}
                    aria-expanded={moreOpen}
                    className="ml-auto rounded-md px-2 py-0.5 text-[11px] font-medium text-[#006044] hover:underline"
                  >
                    {moreOpen ? "Hide email" : "Add email"}
                  </button>
                </div>

                <div className="relative min-w-0">
                  <FieldLabel icon={<User size={14} />} label="Customer" />
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
                    <input
                      id={`${formId}-customer`}
                      type="text"
                      role="combobox"
                      aria-label="Customer name"
                      aria-autocomplete="list"
                      aria-expanded={
                        customerSearchOpen && customerQuery.trim().length >= 2 && !selectedCustomer
                      }
                      aria-controls={`${formId}-customer-options`}
                      aria-activedescendant={
                        activeCustomerIndex >= 0
                          ? `${formId}-customer-option-${activeCustomerIndex}`
                          : undefined
                      }
                      value={customerQuery}
                      onChange={(event) => {
                        const nextQuery = event.target.value;
                        ++selectionGeneration.current;
                        setCustomerQuery(nextQuery);
                        setFullName(nextQuery);
                        setCustomerSearchOpen(nextQuery.trim().length >= 2);
                        setActiveCustomerIndex(-1);
                        setCustomerSearchError("");
                        if (selectedCustomer) {
                          setSelectedCustomer(null);
                          setPhone("");
                          setEmail("");
                        }
                        if (nextQuery.trim().length < 2) {
                          setCustomerResults([]);
                          setSearchingCustomers(false);
                        } else {
                          setCustomerResults([]);
                          setSearchingCustomers(true);
                        }
                      }}
                      onFocus={() => {
                        if (!selectedCustomer && customerQuery.trim().length >= 2)
                          setCustomerSearchOpen(true);
                      }}
                      onBlur={() => {
                        setCustomerSearchOpen(false);
                        setActiveCustomerIndex(-1);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setCustomerSearchOpen(false);
                          setActiveCustomerIndex(-1);
                        } else if (
                          customerSearchOpen &&
                          (event.key === "ArrowDown" || event.key === "ArrowUp")
                        ) {
                          event.preventDefault();
                          const count = customerResults.length + 1;
                          setActiveCustomerIndex((current) =>
                            event.key === "ArrowDown"
                              ? (current + 1) % count
                              : (current - 1 + count) % count
                          );
                        } else if (
                          customerSearchOpen &&
                          event.key === "Enter" &&
                          activeCustomerIndex >= 0
                        ) {
                          event.preventDefault();
                          if (activeCustomerIndex < customerResults.length) {
                            const highlighted = customerResults[activeCustomerIndex];
                            if (highlighted) void selectCustomer(highlighted);
                          } else {
                            chooseNewCustomerName();
                          }
                        }
                      }}
                      disabled={isSaving || loadingCustomerIdentity}
                      placeholder="Enter name or find an existing customer"
                      className={cn(inputClassName(Boolean(fieldErrors.fullName)), "pl-9")}
                    />
                    {searchingCustomers || loadingCustomerIdentity ? (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--cs-text-muted)]" />
                    ) : null}
                  </div>
                  <FieldError message={fieldErrors.fullName ?? fieldErrors.customer} />

                  {selectedCustomer ? (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--cs-sand-mist)] text-xs font-semibold text-[var(--cs-sand-dark)]">
                        {selectedCustomer.fullName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--cs-text)]">
                          {selectedCustomer.fullName}
                        </span>
                        <span className="block truncate text-xs text-[var(--cs-text-muted)]">
                          Existing customer selected
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={clearSelectedCustomer}
                        disabled={isSaving}
                        className="cs-btn cs-btn-secondary h-8 rounded-lg px-3 text-xs"
                      >
                        Change
                      </button>
                    </div>
                  ) : customerSearchOpen && customerQuery.trim().length >= 2 ? (
                    <div
                      id={`${formId}-customer-options`}
                      role="listbox"
                      aria-label="Possible customers"
                      onMouseDown={(event) => event.preventDefault()}
                      className="absolute left-0 right-0 z-40 mt-2 max-h-48 overflow-y-auto rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-1 shadow-xl"
                    >
                      <p className="px-3 py-1 text-xs font-semibold text-[var(--cs-text-muted)]">
                        Possible customers
                      </p>
                      {searchingCustomers ? (
                        <p className="px-3 py-2 text-xs text-[var(--cs-text-muted)]">
                          Searching customers…
                        </p>
                      ) : null}
                      {customerSearchError ? (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--cs-error-text)]">
                          <span role="alert">{customerSearchError}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerSearchError("");
                              setSearchingCustomers(true);
                              setCustomerSearchRetry((current) => current + 1);
                            }}
                            className="font-semibold underline"
                          >
                            Retry
                          </button>
                        </div>
                      ) : null}
                      {!searchingCustomers &&
                      !customerSearchError &&
                      customerResults.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-[var(--cs-text-muted)]">
                          No matching customer found.
                        </p>
                      ) : null}
                      {customerResults.map((customer, index) => (
                        <button
                          key={customer.id}
                          id={`${formId}-customer-option-${index}`}
                          role="option"
                          aria-selected={activeCustomerIndex === index}
                          type="button"
                          onClick={() => void selectCustomer(customer)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--cs-surface-warm)]",
                            activeCustomerIndex === index && "bg-[var(--cs-surface-warm)]"
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-[var(--cs-text)]">
                              {customer.fullName}
                            </span>
                            <span className="block truncate text-xs text-[var(--cs-text-muted)]">
                              {customer.phoneSuffix
                                ? `•••• ${customer.phoneSuffix}`
                                : "Phone unavailable"}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-[var(--cs-sand-dark)]">
                            Select
                          </span>
                        </button>
                      ))}
                      <button
                        id={`${formId}-customer-option-${customerResults.length}`}
                        role="option"
                        aria-selected={activeCustomerIndex === customerResults.length}
                        type="button"
                        onClick={chooseNewCustomerName}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--cs-sand-dark)] hover:bg-[var(--cs-surface-warm)]",
                          activeCustomerIndex === customerResults.length &&
                            "bg-[var(--cs-surface-warm)]"
                        )}
                      >
                        + Use new customer “{customerQuery.trim()}”
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Phone */}
                <div className="min-w-0">
                  <FieldLabel icon={<Phone size={14} />} label="Phone" />
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
                    <input
                      id={`${formId}-phone`}
                      type="tel"
                      aria-label="Phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      disabled={isSaving || Boolean(selectedCustomer)}
                      placeholder="Phone number"
                      className={cn(
                        inputClassName(Boolean(fieldErrors.phone)),
                        "pl-9",
                        selectedCustomer && "cursor-not-allowed bg-[var(--cs-surface-warm)]"
                      )}
                    />
                  </div>
                  <FieldError message={fieldErrors.phone} />
                </div>
                <div className="min-w-0">
                  <FieldLabel label="Notes" optional />
                  <input
                    type="text"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={isSaving}
                    placeholder="Special requests or booking notes"
                    className={cn(inputClassName(false), "h-9 text-xs")}
                  />
                </div>
                {moreOpen ? (
                  <div className="min-w-0 sm:col-span-3">
                    <FieldLabel label="Email" optional />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isSaving}
                      placeholder="customer@email.com"
                      className={cn(inputClassName(false), "h-8 text-xs")}
                    />
                  </div>
                ) : null}
              </div>

              {/* Destination coordinates remain tied to a verified Places result. */}
              {isHomeService ? (
                <div className="min-w-0 space-y-1.5">
                  <FieldLabel icon={<MapPin size={14} />} label="Service Location" />
                  <PlacesAutocomplete
                    value={homeServiceAddress}
                    onChange={setHomeServiceAddress}
                    onPlaceSelect={handleHomeServicePlaceSelect}
                    onStatusChange={setPlacesStatus}
                    placeholder="Search or paste customer address/location"
                    theme="default"
                  />
                  <input
                    type="text"
                    value={homeServiceAccessNote}
                    onChange={(event) => setHomeServiceAccessNote(event.target.value)}
                    disabled={isSaving}
                    aria-label="Home Service access instructions"
                    placeholder="Access instructions (optional: gate, floor, landmark)"
                    maxLength={300}
                    className={cn(inputClassName(false), "h-8 text-xs")}
                  />
                  <FieldError message={fieldErrors.homeServiceAddress} />
                  {homeServicePlace ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <MapPin size={15} className="shrink-0 text-[#006044]" />
                      <span className="min-w-0 flex-1 truncate">
                        ✓ Location confirmed · {homeServicePlace.formattedAddress}
                      </span>
                      <a
                        href={homeServicePlace.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#006044] underline"
                      >
                        Review map
                      </a>
                    </div>
                  ) : null}
                  {placesStatus === "missing_key" ? (
                    <p className="text-xs font-medium text-[var(--cs-error-text)]">
                      Google address search is not configured.
                    </p>
                  ) : placesStatus === "failed" || placesStatus === "place_missing_coordinates" ? (
                    <p className="text-xs font-medium text-[var(--cs-error-text)]">
                      Address coordinates could not be loaded. Select another result.
                    </p>
                  ) : homeServiceAddress && !homeServicePlace ? (
                    <p className="text-xs text-[var(--cs-text-muted)]">
                      {CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {
              <div className="min-w-0 rounded-xl border border-[var(--cs-border-soft)] bg-white p-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={21} className="text-[#006044]" />
                    <div>
                      <h2 className="text-sm font-bold">Guests &amp; Services</h2>
                      <p className="text-[11px] text-[var(--cs-text-muted)]">
                        Add guests, select services, assign therapists and set date &amp; time.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={addGuest}
                      disabled={isSaving || attendeeDrafts.length >= guestCardCapacity}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#006044] bg-white px-2 text-xs font-semibold text-[#006044] disabled:opacity-50"
                    >
                      <Plus size={13} /> Add Guest
                    </button>
                    <button
                      type="button"
                      onClick={() => copyServicesToNextGuest(firstAttendeeId)}
                      disabled={
                        isSaving || additionalGuests.length === 0 || selectedServiceIds.length === 0
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-white px-2 text-xs disabled:opacity-50"
                    >
                      Copy to Guest 2
                    </button>
                    <button
                      type="button"
                      onClick={clearBookingGuests}
                      disabled={
                        isSaving ||
                        (selectedServiceIds.length === 0 && additionalGuests.length === 0)
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-white px-2 text-xs text-[#8C2828] disabled:opacity-50"
                    >
                      <Trash2 size={13} /> Clear All
                    </button>
                  </div>
                </div>
                <div
                  ref={guestScrollRef}
                  className="grid min-w-0 content-start gap-1.5 overflow-x-hidden lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
                  aria-label="Expanded guest booking cards"
                >
                  {serviceModeNotice ? (
                    <p
                      role="status"
                      className="rounded-lg bg-[var(--cs-warning-bg)] px-2 py-1 text-xs text-[var(--cs-warning-text)]"
                    >
                      {serviceModeNotice}
                    </p>
                  ) : null}
                  {(therapistAvailabilityStatus === "empty" ||
                    therapistAvailabilityStatus === "error") &&
                  therapistAvailabilityMessage ? (
                    <p
                      role="status"
                      className="rounded-lg bg-[var(--cs-warning-bg)] px-2 py-1 text-xs text-[var(--cs-warning-text)]"
                    >
                      {therapistAvailabilityMessage}
                    </p>
                  ) : null}
                  {attendeeDrafts.map((attendee, index) => (
                    <div key={attendee.id} className="min-w-0 w-full">
                      {renderBookingGuest(attendee, index)}
                    </div>
                  ))}
                </div>
                {attendeeDrafts.length >= 4 ? (
                  <p className="mt-1 text-xs text-[var(--cs-warning-text)]">
                    Current CRM booking contract supports up to 4 guests.
                    {attendeeDrafts.length > 4
                      ? " This larger group is a layout preview only and cannot be saved."
                      : ""}
                  </p>
                ) : null}
                {groupBooking ? (
                  <p className="mt-1 text-[11px] text-[var(--cs-text-muted)]">
                    Group therapist suggestions are provisional; the server assigns them on Save.{" "}
                    {isHomeService
                      ? "Home Service does not require rooms."
                      : "Rooms are assigned automatically for CSR review."}{" "}
                    Shared start time applies to every guest.
                  </p>
                ) : null}
                {groupBooking && (staffId || Object.values(guestSelectedStaffIds).some(Boolean)) ? (
                  <p
                    role="alert"
                    className="mt-1 text-xs font-semibold text-[var(--cs-danger-text)]"
                  >
                    Exact group therapist selections cannot be saved yet. Restore Automatic for
                    every guest.
                  </p>
                ) : null}
                {formError ? <WorkspaceNotice tone="error">{formError}</WorkspaceNotice> : null}
              </div>
            }
          </div>

          <aside className="flex min-w-0 flex-col border-t border-[var(--cs-border-soft)] bg-[#fbfaf7] p-2.5 lg:min-h-0 lg:border-l lg:border-t-0 lg:overflow-y-auto">
            <div className="flex shrink-0 items-center gap-2 text-base font-bold text-[var(--cs-text)]">
              <Image
                src="/images/brand/cradle-logo-mark.svg"
                alt=""
                width={24}
                height={24}
                className="size-6"
              />{" "}
              Booking Summary
            </div>
            <div className="mt-2 flex shrink-0 items-center gap-2">
              {isHomeService ? <Home size={18} /> : <CalendarDays size={18} />}
              <div>
                <p className="text-base font-semibold text-[var(--cs-text)]">
                  {MODES.find((item) => item.value === mode)?.label} booking{" "}
                  <span className="ml-1 rounded-full bg-[#f8eadc] px-2 py-0.5 text-xs font-normal text-[#8a491e]">
                    {branchName}
                  </span>
                </p>
                <p className="text-xs text-[var(--cs-text-muted)]">
                  {date || "Choose date"} · {time || "Choose time"} · {attendeeDrafts.length} guest
                  {attendeeDrafts.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
              <div className="mt-2 space-y-1.5">
                <SummaryRow label="Customer" value={fullName || "Not selected"} />
                {groupBooking ? (
                  <>
                    <div className="border-t border-[var(--cs-border-soft)] pt-1.5">
                      <div className="text-xs font-semibold uppercase text-[var(--cs-text-muted)]">
                        Guests & services ({attendeeDrafts.length})
                      </div>
                      {attendeeDrafts.length > 2 ? (
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span>
                            Guests {visibleSummaryPage * 2 + 1}–
                            {Math.min(attendeeDrafts.length, visibleSummaryPage * 2 + 2)} of{" "}
                            {attendeeDrafts.length}
                          </span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSummaryGuestPage((page) => Math.max(0, page - 1))}
                              disabled={visibleSummaryPage === 0}
                              aria-label="Previous summary guests"
                              className="font-semibold text-[#006044] disabled:opacity-40"
                            >
                              Previous
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSummaryGuestPage((page) =>
                                  Math.min(Math.ceil(attendeeDrafts.length / 2) - 1, page + 1)
                                )
                              }
                              disabled={
                                visibleSummaryPage >= Math.ceil(attendeeDrafts.length / 2) - 1
                              }
                              aria-label="Next summary guests"
                              className="font-semibold text-[#006044] disabled:opacity-40"
                            >
                              Next
                            </button>
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-1 space-y-1">
                        {attendeeDrafts
                          .slice(visibleSummaryPage * 2, visibleSummaryPage * 2 + 2)
                          .map((attendee, localIndex) => {
                            const index = visibleSummaryPage * 2 + localIndex;
                            return (
                              <div
                                key={attendee.id}
                                className="flex min-w-0 items-start gap-2 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-2 py-1 text-xs"
                              >
                                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#e0f3e9] font-bold text-[#006044]">
                                  {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 text-[var(--cs-text-muted)]">
                                  <strong className="block text-[var(--cs-text)]">
                                    {attendee.name?.trim() || `Guest ${index + 1}`}
                                  </strong>
                                  {attendee.serviceIds.length
                                    ? attendee.serviceIds
                                        .map(
                                          (id) =>
                                            services.find((item) => item.id === id)?.name ||
                                            "Service"
                                        )
                                        .join(", ")
                                    : "Choose service"}
                                  <span className="block">
                                    {formatServiceDuration(
                                      attendee.serviceIds.reduce(
                                        (sum, id) =>
                                          sum +
                                          (lineQuotes[`${attendee.id}:${id}`]
                                            ?.selectedDurationMinutes ??
                                            services.find((service) => service.id === id)
                                              ?.durationMinutes ??
                                            0),
                                        0
                                      )
                                    )}{" "}
                                    ·{" "}
                                    {(attendee.id === firstAttendeeId && staffId) ||
                                    guestSelectedStaffIds[attendee.id]
                                      ? staff.find(
                                          (member) =>
                                            member.id ===
                                            (attendee.id === firstAttendeeId
                                              ? staffId
                                              : guestSelectedStaffIds[attendee.id])
                                        )?.name || "Selected therapist"
                                      : provisionalGuestStaff.get(attendee.id)?.fullName ||
                                        "Automatic assignment on Save"}
                                  </span>
                                  <span className="block">{guestFinishClock(attendee)}</span>
                                </span>
                                <strong className="shrink-0">
                                  {formatCurrency(
                                    attendee.serviceIds.reduce(
                                      (sum, id) =>
                                        sum +
                                        (lineQuotes[`${attendee.id}:${id}`]?.calculatedPrice ??
                                          services.find((service) => service.id === id)?.price ??
                                          0),
                                      0
                                    )
                                  )}
                                </strong>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    <SummaryRow label="Service total" value={formatCurrency(groupTotalPrice)} />
                  </>
                ) : (
                  <>
                    <SummaryServices services={selectedQuotedServices} />
                    <SummaryRow label="Service total" value={serviceSummaryLabel} />
                  </>
                )}
                {!groupBooking && effectiveProviderAvailability?.serviceEndTime ? (
                  <SummaryRow
                    label="Appointment"
                    value={`${formatBookingClock(time)}–${formatBookingClock(
                      effectiveProviderAvailability.serviceEndTime
                    )}`}
                  />
                ) : null}
                <SummaryRow
                  label="Therapist"
                  value={
                    groupBooking
                      ? "Automatic per guest · provisional suggestions"
                      : selectedStaff
                        ? selectedStaff.nickname || selectedStaff.name
                        : effectiveProviderAvailability
                          ? `First available · ${
                              effectiveProviderAvailability.nickname ||
                              effectiveProviderAvailability.fullName
                            }`
                          : "First available"
                  }
                />
                {!groupBooking &&
                effectiveProviderAvailability?.scheduleStartTime &&
                effectiveProviderAvailability.scheduleEndTime ? (
                  <SummaryRow
                    label="Therapist schedule"
                    value={`${formatBookingClock(
                      effectiveProviderAvailability.scheduleStartTime
                    )}–${formatBookingClock(effectiveProviderAvailability.scheduleEndTime)}`}
                  />
                ) : null}
                {!groupBooking && (effectiveProviderAvailability?.overtimeMinutes ?? 0) > 0 ? (
                  <SummaryNote
                    text={`Ends ${formatServiceDuration(
                      effectiveProviderAvailability?.overtimeMinutes ?? 0
                    )} after shift — allowed because the booking starts during scheduled time.`}
                    tone="warning"
                  />
                ) : null}
                {!groupBooking &&
                isHomeService &&
                effectiveProviderAvailability?.operationalStartTime &&
                effectiveProviderAvailability.operationalEndTime ? (
                  <SummaryRow
                    label="Operational block"
                    value={`${formatBookingClock(
                      effectiveProviderAvailability.operationalStartTime
                    )}–${formatBookingClock(effectiveProviderAvailability.operationalEndTime)}`}
                  />
                ) : null}
                {!isHomeService ? (
                  <SummaryRow
                    label="Room"
                    value={
                      groupBooking
                        ? "Assigned per guest"
                        : selectedResource
                          ? selectedResource.name
                          : "First available"
                    }
                  />
                ) : (
                  <>
                    <SummaryRow
                      label="Destination"
                      value={homeServicePlace?.formattedAddress || homeServiceAddress || "Required"}
                    />
                    {homeServicePlace &&
                    (homeServiceDistanceStatus === "loading" ||
                      homeServiceDistanceStatus === "idle") ? (
                      <SummaryRow label="Transportation fee" value="Updating travel fee…" />
                    ) : homeServiceDistanceStatus === "error" ? (
                      <SummaryRow
                        label="Transportation fee"
                        value={homeServiceDistanceError || "Unavailable"}
                      />
                    ) : homeServiceDistanceQuote ? (
                      <>
                        <SummaryRow
                          label="Travel time / distance"
                          value={formatDistanceKm(homeServiceDistanceQuote.distanceKm)}
                        />
                        <SummaryRow
                          label="Transportation fee"
                          value={formatCurrency(homeServiceDistanceQuote.travelFee)}
                        />
                      </>
                    ) : null}
                  </>
                )}
                {rescheduleOrderId ? (
                  <SummaryRow label="Original Order" value={rescheduleOrderId} />
                ) : null}
                {notes ? <SummaryRow label="Notes" value={notes} /> : null}
              </div>
            </div>
            <div className="mt-2 shrink-0 border-t border-[var(--cs-border)] pt-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  Total amount{" "}
                  <small className="block text-[10px] font-normal text-[var(--cs-text-muted)]">
                    Provisional until Save
                  </small>
                </span>
                <strong className="text-xl">
                  {formatCurrency(
                    (groupBooking ? groupTotalPrice : totalPrice) +
                      (isHomeService ? (homeServiceDistanceQuote?.travelFee ?? 0) : 0)
                  )}
                </strong>
              </div>
              {rescheduleBookingId ? (
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CreditCard size={15} /> Payment{" "}
                  <span className="ml-auto rounded-full bg-[var(--cs-surface)] px-2 py-0.5 text-[var(--cs-text-muted)]">
                    Preserved from original order
                  </span>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <CreditCard size={15} /> Payment{" "}
                    <span className="ml-auto rounded-full bg-[#faead9] px-2 py-0.5 text-[#8a491e]">
                      {paymentReceived ? "Payment to record" : "Unpaid"}
                    </span>
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={paymentReceived}
                      onChange={(event) => {
                        setPaymentReceived(event.target.checked);
                        setPaymentMethod("");
                      }}
                      disabled={isSaving}
                    />{" "}
                    Full advance payment received
                  </label>
                  {paymentReceived ? (
                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as typeof paymentMethod)
                      }
                      disabled={isSaving}
                      aria-label="Payment method"
                      className={cn(
                        selectClassName(Boolean(fieldErrors.paymentMethod)),
                        "mt-1 h-8 text-xs"
                      )}
                    >
                      <option value="">Select payment method</option>
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="maya">Maya</option>
                      <option value="card">Card</option>
                    </select>
                  ) : null}
                  <FieldError message={fieldErrors.paymentMethod} />
                </>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => (onCancel ? onCancel() : router.push("/crm/bookings"))}
                  disabled={isSaving}
                  className="cs-btn cs-btn-secondary h-9 flex-1 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    isSaving || slotChecking || loadingCustomerIdentity || attendeeDrafts.length > 4
                  }
                  className="cs-btn h-9 flex-1 rounded-lg bg-[#006044] text-xs text-white disabled:opacity-60"
                >
                  {isSaving ? "Saving…" : slotChecking ? "Checking…" : rescheduleBookingId ? "Save Changes" : "Save Booking"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function FieldLabel({
  label,
  icon,
  optional = false,
}: {
  label: string;
  icon?: ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--cs-text)]">
      {icon ? <span className="text-[var(--cs-sand-dark)]">{icon}</span> : null}
      {label}
      {optional ? (
        <span className="text-xs font-medium text-[var(--cs-text-muted)]">(optional)</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-[var(--cs-error-text)]">{message}</p>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--cs-border-soft)] pt-2">
      <div className="text-xs font-semibold uppercase text-[var(--cs-text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[var(--cs-text)]">{value}</div>
    </div>
  );
}

function SummaryServices({ services }: { services: QuickBookingServiceOption[] }) {
  return (
    <div className="border-t border-[var(--cs-border-soft)] pt-1.5">
      <div className="text-xs font-semibold uppercase text-[var(--cs-text-muted)]">Services</div>
      {services.length > 0 ? (
        <ol className="mt-1 space-y-1">
          {services.slice(0, 2).map((service, index) => (
            <li key={service.id} className="flex min-w-0 items-center gap-1.5 text-xs">
              <span className="font-semibold text-[var(--cs-sand-dark)]">{index + 1}.</span>
              <span
                className="min-w-0 flex-1 truncate font-medium text-[var(--cs-text)]"
                title={service.name}
              >
                {service.name}
              </span>
              <span className="shrink-0 text-[var(--cs-text-muted)]">
                {formatServiceDuration(service.durationMinutes)} · {formatCurrency(service.price)}
              </span>
            </li>
          ))}
          {services.length > 2 ? (
            <li className="text-xs text-[var(--cs-text-muted)]">
              +{services.length - 2} more in service catalogue
            </li>
          ) : null}
        </ol>
      ) : (
        <div className="mt-1 text-sm font-medium text-[var(--cs-text)]">Not selected</div>
      )}
    </div>
  );
}

function SummaryNote({ text, tone = "muted" }: { text: string; tone?: "muted" | "warning" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs leading-5",
        tone === "warning"
          ? "border-[var(--cs-warning-bg)] bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]"
          : "border-[var(--cs-border-soft)] bg-[var(--cs-surface)] text-[var(--cs-text-muted)]"
      )}
    >
      {text}
    </div>
  );
}

function inputClassName(hasError: boolean): string {
  return cn(
    "h-10 w-full rounded-xl border bg-[var(--cs-surface-warm)] px-3 text-sm text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-70",
    hasError ? "border-[var(--cs-error-text)]" : "border-[var(--cs-border)]"
  );
}

function selectClassName(hasError: boolean): string {
  return cn(inputClassName(hasError), "appearance-auto");
}
