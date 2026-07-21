"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  CreditCard,
  Home,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { createInhouseBookingMultiAction } from "@/lib/actions/inhouse-booking";
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
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import type { BranchBookingRules } from "@/lib/validations/booking-rules";

export type QuickBookingMode = "walkin" | "phone" | "standard_future" | "home_service";

export type QuickBookingServiceOption = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  availableInSpa: boolean;
  availableHomeService: boolean;
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
  initialDate?: string;
  initialTime?: string;
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
};

type CustomerSearchRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
};

type SlotRow = {
  staff_id: string;
  slot_time: string;
  available: boolean;
};

type CrmAvailabilityResponse = {
  available: boolean;
  message?: string | null;
  warning?: string | null;
  reasonCode?: string | null;
  slots?: SlotRow[];
  availableStaffIds?: string[];
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
  { value: "walkin", label: "Walk-in", description: "Customer is already at the branch." },
  { value: "phone", label: "Phone", description: "Booked by call or message." },
  { value: "standard_future", label: "Future", description: "Scheduled in-spa booking." },
  { value: "home_service", label: "Home Service", description: "Therapist goes to the customer." },
];

const CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE =
  "Please select a valid address from the search results so distance can be calculated.";

const NO_SCHEDULED_THERAPIST_MESSAGE =
  "No scheduled therapist is available at this time. Try another time or check staff schedules.";

function todayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function nextQuarterTime(): string {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.min(23 * 60 + 45, Math.ceil(minutes / 15) * 15);
  const hh = Math.floor(rounded / 60);
  const mm = rounded % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function normalizeTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
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

function staffCanPerformServices(member: QuickBookingStaffOption, serviceIds: string[]): boolean {
  if (serviceIds.length === 0) return true;
  return serviceIds.every((id) => member.serviceIds.includes(id));
}

function formatAttendanceTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  initialDate,
  initialTime,
  services,
  staff,
  resources,
  successBehavior = "redirect",
  onCancel,
  onSuccess,
  onDirtyChange,
}: QuickBookingFormProps) {
  const router = useRouter();
  const formId = useId();
  const [initialDateValue] = useState(() => initialDate ?? todayYmd());
  const [initialTimeValue] = useState(() =>
    initialTime ? initialTime.slice(0, 5) : nextQuarterTime()
  );
  const seededCustomerQuery = initialCustomer?.fullName || initialName || initialPhone || "";
  const [mode, setMode] = useState<QuickBookingMode>(initialMode);
  const [selectedCustomer, setSelectedCustomer] = useState<QuickBookingCustomerOption | null>(
    initialCustomer
  );
  const [customerQuery, setCustomerQuery] = useState(seededCustomerQuery);
  const [customerResults, setCustomerResults] = useState<QuickBookingCustomerOption[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [fullName, setFullName] = useState(initialCustomer?.fullName ?? initialName);
  const [phone, setPhone] = useState(initialCustomer?.phone ?? initialPhone);
  const [email, setEmail] = useState(initialCustomer?.email ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    initialServiceId ? [initialServiceId] : []
  );
  const [serviceModeNotice, setServiceModeNotice] = useState("");
  const [date, setDate] = useState(initialDateValue);
  const [time, setTime] = useState(initialTimeValue);
  const [notes, setNotes] = useState("");
  const [homeServiceAddress, setHomeServiceAddress] = useState("");
  const [homeServicePlace, setHomeServicePlace] = useState<PlaceSelectResult | null>(null);
  const [homeServiceBarangay, setHomeServiceBarangay] = useState("");
  const [homeServiceCity, setHomeServiceCity] = useState("");
  const [homeServiceAccessNote, setHomeServiceAccessNote] = useState("");
  const [placesStatus, setPlacesStatus] = useState<PlacesAutocompleteStatus>("idle");
  const [homeServiceDistanceStatus, setHomeServiceDistanceStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [homeServiceDistanceError, setHomeServiceDistanceError] = useState("");
  const [homeServiceDistanceQuote, setHomeServiceDistanceQuote] =
    useState<HomeServiceDistanceQuote | null>(null);
  const [paymentReceived, setPaymentReceived] = useState(initialMode === "walkin");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "gcash" | "maya" | "card" | "other" | ""
  >(initialMode === "walkin" ? "cash" : "");
  const [staffId, setStaffId] = useState(initialStaffId);
  const [resourceId, setResourceId] = useState("");
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
  const [therapistAvailabilityStatus, setTherapistAvailabilityStatus] =
    useState<TherapistAvailabilityStatus>("idle");
  const [therapistAvailabilityMessage, setTherapistAvailabilityMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loadingNextSlot, setLoadingNextSlot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [slotChecking, setSlotChecking] = useState(false);
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
  const selectedServiceCount = selectedServices.length;
  const totalDurationMinutes = selectedServices.reduce(
    (sum, service) => sum + service.durationMinutes,
    0
  );
  const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const serviceSummaryLabel =
    selectedServiceCount === 0
      ? "Not selected"
      : `${selectedServiceCount} service${selectedServiceCount === 1 ? "" : "s"} · ${formatServiceDuration(totalDurationMinutes)} · ${formatCurrency(totalPrice)}`;
  const selectedStaff = staff.find((member) => member.id === staffId) ?? null;
  const selectedResource = resources.find((resource) => resource.id === resourceId) ?? null;
  const serviceCapableStaff = useMemo(
    () => staff.filter((member) => staffCanPerformServices(member, selectedServiceIds)),
    [selectedServiceIds, staff]
  );
  const availableStaffIdSet = useMemo(() => new Set(availableStaffIds), [availableStaffIds]);
  const availableTherapists = useMemo(
    () => serviceCapableStaff.filter((member) => availableStaffIdSet.has(member.id)),
    [availableStaffIdSet, serviceCapableStaff]
  );
  const therapistPrerequisitesReady =
    selectedServiceIds.length > 0 && Boolean(date) && Boolean(time);
  const eligibleAttendanceHint =
    attendanceHint && availableStaffIdSet.has(attendanceHint.staffId) ? attendanceHint : null;
  const slotIsAllowedByRules = (slotTime: string, candidateMode: QuickBookingMode): boolean => {
    if (candidateMode === "home_service" && !bookingRules.homeServiceEnabled) return false;

    const slotMinutes = timeToMinutes(slotTime);
    const startMinutes = timeToMinutes(
      candidateMode === "home_service"
        ? bookingRules.homeServiceStartTime
        : bookingRules.inSpaStartTime
    );
    const endMinutes = timeToMinutes(
      candidateMode === "home_service" ? bookingRules.homeServiceEndTime : bookingRules.inSpaEndTime
    );

    return (
      slotMinutes !== null &&
      startMinutes !== null &&
      endMinutes !== null &&
      slotMinutes >= startMinutes &&
      slotMinutes <= endMinutes
    );
  };

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
      date !== initialDateValue ||
      time !== initialTimeValue ||
      notes !== "" ||
      homeServiceAddress !== "" ||
      homeServicePlace !== null ||
      homeServiceBarangay !== "" ||
      homeServiceCity !== "" ||
      homeServiceAccessNote !== "" ||
      paymentReceived !== (initialMode === "walkin") ||
      paymentMethod !== (initialMode === "walkin" ? "cash" : "") ||
      staffId !== initialStaffId ||
      resourceId !== "",
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
      initialMode,
      initialName,
      initialPhone,
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
      seededCustomerQuery,
      staffId,
      time,
    ]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    const controller = new AbortController();
    const id = window.setTimeout(() => {
      if (!therapistPrerequisitesReady) {
        setAvailableStaffIds([]);
        setTherapistAvailabilityStatus("idle");
        setTherapistAvailabilityMessage("");
        return;
      }

      setAvailableStaffIds([]);
      setTherapistAvailabilityStatus("loading");
      setTherapistAvailabilityMessage("");

      requestCrmAvailability({
        branchId,
        serviceIds: selectedServiceIds,
        date,
        time,
        bookingMode: mode,
        deliveryType: isHomeService ? "home_service" : "in_spa",
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          const nextAvailableStaffIds = Array.from(new Set(result.availableStaffIds ?? []));
          setAvailableStaffIds(nextAvailableStaffIds);
          setTherapistAvailabilityStatus(nextAvailableStaffIds.length > 0 ? "ready" : "empty");
          setTherapistAvailabilityMessage(
            nextAvailableStaffIds.length > 0
              ? ""
              : (result.message ?? NO_SCHEDULED_THERAPIST_MESSAGE)
          );

          if (nextAvailableStaffIds.length > 0) {
            setFieldErrors((current) => ({ ...current, time: undefined }));
            setFormError("");
          }

          if (staffId && !nextAvailableStaffIds.includes(staffId)) {
            const unavailableStaff = staff.find((member) => member.id === staffId);
            setStaffId("");
            if (unavailableStaff) {
              toast.info("Therapist selection cleared", {
                description: `${unavailableStaff.nickname || unavailableStaff.name} is not available for the selected services, date, and time.`,
              });
            }
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setAvailableStaffIds([]);
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
    mode,
    selectedServiceIds,
    staff,
    staffId,
    therapistPrerequisitesReady,
    time,
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
    const id = window.setTimeout(() => {
      setSearchingCustomers(true);
      fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, {
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { customers: [] }))
        .then((data: { customers?: CustomerSearchRow[] }) => {
          setCustomerResults(
            (data.customers ?? []).map((customer) => ({
              id: customer.id,
              fullName: customer.full_name,
              phone: customer.phone,
              email: customer.email,
            }))
          );
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setCustomerResults([]);
          }
        })
        .finally(() => setSearchingCustomers(false));
    }, 200);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [customerQuery, selectedCustomer]);

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
    const validServiceIds = selectedServiceIds.filter((id) => {
      const service = services.find((item) => item.id === id);
      return service ? serviceAvailableForMode(service, nextMode) : false;
    });
    const removedCount = selectedServiceIds.length - validServiceIds.length;
    setMode(nextMode);
    setFieldErrors({});
    setFormError("");
    setSelectedServiceIds(validServiceIds);
    if (removedCount > 0) {
      setServiceModeNotice(
        validServiceIds.length === 0
          ? `Services were cleared because they are not available for ${nextMode === "home_service" ? "Home Service" : "in-spa"} bookings.`
          : `${removedCount} service${removedCount === 1 ? "" : "s"} removed because ${removedCount === 1 ? "it is" : "they are"} not available for ${nextMode === "home_service" ? "Home Service" : "in-spa"} bookings.`
      );
    } else {
      setServiceModeNotice("");
    }
    if (
      staffId &&
      !staff.some(
        (member) => member.id === staffId && staffCanPerformServices(member, validServiceIds)
      )
    ) {
      setStaffId("");
    }
    if (nextMode === "walkin") {
      setDate(todayYmd());
      setTime(nextQuarterTime());
      setPaymentReceived(true);
      setPaymentMethod((current) => current || "cash");
    } else {
      setPaymentReceived(false);
      setPaymentMethod("");
    }
    if (nextMode === "home_service") {
      setResourceId("");
    }
  }

  function handleServiceSelectionChange(nextServiceIds: string[]) {
    setSelectedServiceIds(nextServiceIds);
    setServiceModeNotice("");
    setFieldErrors((current) => ({ ...current, service: undefined }));
    if (
      staffId &&
      !staff.some(
        (member) => member.id === staffId && staffCanPerformServices(member, nextServiceIds)
      )
    ) {
      setStaffId("");
    }
  }

  function selectCustomer(customer: QuickBookingCustomerOption) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.fullName);
    setFullName(customer.fullName);
    setPhone(customer.phone);
    setEmail(customer.email ?? "");
    setCustomerResults([]);
    setFieldErrors((current) => ({
      ...current,
      customer: undefined,
      fullName: undefined,
      phone: undefined,
    }));
  }

  function clearSelectedCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setFullName("");
    setPhone("");
    setEmail("");
    setCustomerResults([]);
  }

  function handleHomeServicePlaceSelect(result: PlaceSelectResult | null) {
    setHomeServicePlace(result);
    setHomeServiceDistanceQuote(null);
    setHomeServiceDistanceStatus("idle");
    setHomeServiceDistanceError("");

    if (!result) {
      setHomeServiceBarangay("");
      setHomeServiceCity("");
      return;
    }

    setHomeServiceAddress(result.formattedAddress);
    setHomeServiceBarangay(getBarangayFromGooglePlace(result));
    setHomeServiceCity(getCityFromGooglePlace(result));
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
    }
    if (!date) nextErrors.date = "Choose a valid date and time.";
    if (!time) nextErrors.time = "Choose a valid date and time.";
    if (isHomeService) {
      if (!homeServiceAddress.trim()) {
        nextErrors.homeServiceAddress = "Enter the complete home-service address.";
      } else if (!homeServicePlace) {
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
      date: availabilityDate,
      time: availabilityTime,
      staffId: candidateStaffId || undefined,
      bookingMode: mode,
      deliveryType: isHomeService ? "home_service" : "in_spa",
    });
  }

  async function submit() {
    if (isSaving || slotChecking) return;

    const nextErrors = validate();
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.values(nextErrors).some(Boolean)) return;

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

    setIsSaving(true);
    try {
      const result = await createInhouseBookingMultiAction({
        branchId,
        customerId: selectedCustomer?.id,
        serviceIds: selectedServiceIds,
        staffId: staffId || undefined,
        resourceId: isHomeService ? undefined : resourceId || undefined,
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

  return (
    <div className="crm-fade-up h-full min-h-0 bg-[var(--cs-bg)]">
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--cs-surface)]">
        <header className="shrink-0 border-b border-[var(--cs-border-soft)] px-4 py-3 sm:px-5">
          <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--cs-text)]">
            Quick Booking
          </h1>
          <p className="mt-0.5 text-sm text-[var(--cs-text-secondary)]">{branchName}</p>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          <div className="min-h-0 px-4 py-3 sm:px-5 lg:overflow-y-auto">
            <div className="grid gap-3">
              <div>
                <FieldLabel icon={<Sparkles size={15} />} label="Booking mode" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODES.map((item) => {
                    const ModeIcon =
                      item.value === "walkin"
                        ? User
                        : item.value === "phone"
                          ? CreditCard
                          : item.value === "home_service"
                            ? Home
                            : CalendarDays;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => changeMode(item.value)}
                        disabled={isSaving}
                        className={cn(
                          "flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                          mode === item.value
                            ? "border-[var(--cs-sand-dark)] bg-[var(--cs-sand-mist)] text-[var(--cs-text)] shadow-[var(--cs-shadow-xs)]"
                            : "border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:border-[var(--cs-border-strong)]"
                        )}
                        aria-pressed={mode === item.value}
                      >
                        <ModeIcon size={17} className="shrink-0 text-[var(--cs-sand-dark)]" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--cs-text)]">
                            {item.label}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--cs-text-muted)]">
                            {item.value === "walkin"
                              ? "Now · In branch"
                              : item.value === "phone"
                                ? "Call or message"
                                : item.value === "home_service"
                                  ? "We go to customer"
                                  : "Scheduled in-spa"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel icon={<User size={15} />} label="Customer" />
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
                    <input
                      id={`${formId}-customer`}
                      type="search"
                      value={customerQuery}
                      onChange={(event) => {
                        const nextQuery = event.target.value;
                        setCustomerQuery(nextQuery);
                        if (selectedCustomer) setSelectedCustomer(null);
                        if (nextQuery.trim().length < 2) {
                          setCustomerResults([]);
                          setSearchingCustomers(false);
                        }
                      }}
                      disabled={isSaving}
                      placeholder="Search name or phone number"
                      className={cn(inputClassName(Boolean(fieldErrors.customer)), "pl-9")}
                    />
                    {searchingCustomers ? (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--cs-text-muted)]" />
                    ) : null}
                  </div>
                  <FieldError message={fieldErrors.customer} />

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
                          {selectedCustomer.phone}
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
                  ) : customerResults.length > 0 ? (
                    <div className="absolute z-40 mt-2 max-h-40 w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-1 shadow-xl sm:w-[calc(100%-2.5rem)]">
                      {customerResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--cs-surface-warm)]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-[var(--cs-text)]">
                              {customer.fullName}
                            </span>
                            <span className="block truncate text-xs text-[var(--cs-text-muted)]">
                              {customer.phone}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-[var(--cs-sand-dark)]">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {!selectedCustomer ? (
                  <>
                    <div>
                      <FieldLabel label="Customer name" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        disabled={isSaving}
                        placeholder="Customer name"
                        className={inputClassName(Boolean(fieldErrors.fullName))}
                      />
                      <FieldError message={fieldErrors.fullName} />
                    </div>
                    <div>
                      <FieldLabel label="Phone" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        disabled={isSaving}
                        placeholder="Phone number"
                        className={inputClassName(Boolean(fieldErrors.phone))}
                      />
                      <FieldError message={fieldErrors.phone} />
                    </div>
                  </>
                ) : null}

                <div className="md:col-span-2">
                  <QuickBookingServiceSelector
                    services={eligibleServices}
                    selectedServiceIds={selectedServiceIds}
                    onChange={handleServiceSelectionChange}
                    isHomeService={isHomeService}
                    disabled={isSaving}
                    error={fieldErrors.service}
                  />
                  {serviceModeNotice ? (
                    <p className="mt-1.5 rounded-lg bg-[var(--cs-warning-bg)] px-3 py-1.5 text-xs font-medium text-[var(--cs-warning-text)]">
                      {serviceModeNotice}
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                className={cn("grid gap-3", isHomeService ? "md:grid-cols-3" : "md:grid-cols-4")}
              >
                <div>
                  <FieldLabel icon={<CalendarDays size={15} />} label="Date" />
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    disabled={isSaving}
                    className={inputClassName(Boolean(fieldErrors.date))}
                  />
                  <FieldError message={fieldErrors.date} />
                </div>

                <div>
                  <FieldLabel icon={<Clock size={15} />} label="Time" />
                  <div className="flex gap-1.5">
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      disabled={isSaving}
                      className={cn(inputClassName(Boolean(fieldErrors.time)), "min-w-0 flex-1")}
                    />
                    <button
                      type="button"
                      onClick={chooseNextAvailable}
                      disabled={isSaving || loadingNextSlot}
                      className="cs-btn cs-btn-secondary h-10 shrink-0 rounded-xl px-2.5 text-xs"
                      aria-label="Choose next available time"
                    >
                      {loadingNextSlot ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Clock size={14} />
                      )}
                    </button>
                  </div>
                  <FieldError message={fieldErrors.time} />
                </div>

                <div>
                  <FieldLabel icon={<User size={15} />} label="Therapist" optional />
                  <select
                    value={staffId}
                    onChange={(event) => setStaffId(event.target.value)}
                    disabled={
                      isSaving ||
                      !therapistPrerequisitesReady ||
                      therapistAvailabilityStatus === "loading" ||
                      therapistAvailabilityStatus === "empty" ||
                      therapistAvailabilityStatus === "error"
                    }
                    className={selectClassName(false)}
                  >
                    <option value="">
                      {!therapistPrerequisitesReady
                        ? "Select services and time"
                        : therapistAvailabilityStatus === "loading"
                          ? "Checking schedules…"
                          : therapistAvailabilityStatus === "empty"
                            ? "No therapist available"
                            : therapistAvailabilityStatus === "error"
                              ? "Availability failed"
                              : "First available"}
                    </option>
                    {availableTherapists.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nickname ? `${member.nickname} — ${member.name}` : member.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!isHomeService ? (
                  <div>
                    <FieldLabel icon={<MapPin size={15} />} label="Room" optional />
                    <select
                      value={resourceId}
                      onChange={(event) => setResourceId(event.target.value)}
                      disabled={isSaving}
                      className={selectClassName(false)}
                    >
                      <option value="">First available</option>
                      {resources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {therapistAvailabilityStatus === "loading" ? (
                <p className="-mt-1 flex items-center gap-1.5 text-xs text-[var(--cs-text-muted)]">
                  <Loader2 size={12} className="animate-spin" /> Checking therapist schedules…
                </p>
              ) : therapistAvailabilityStatus === "empty" ||
                therapistAvailabilityStatus === "error" ? (
                <p className="-mt-1 text-xs font-medium text-[var(--cs-danger-text)]">
                  {therapistAvailabilityMessage || NO_SCHEDULED_THERAPIST_MESSAGE}
                </p>
              ) : mode === "walkin" && eligibleAttendanceHint ? (
                <p className="-mt-1 text-xs text-[var(--cs-sand-dark)]">
                  Attendance suggestion:{" "}
                  {eligibleAttendanceHint.nickname || eligibleAttendanceHint.fullName}
                  {eligibleAttendanceHint.checkedInAt
                    ? ` · Clocked in ${formatAttendanceTime(eligibleAttendanceHint.checkedInAt)}`
                    : ""}
                </p>
              ) : null}

              {isHomeService ? (
                <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <FieldLabel icon={<Home size={15} />} label="Home-service logistics" />
                    {homeServiceDistanceQuote ? (
                      <span className="text-xs font-semibold text-[var(--cs-sand-dark)]">
                        {formatDistanceKm(homeServiceDistanceQuote.distanceKm)} ·{" "}
                        {formatCurrency(homeServiceDistanceQuote.travelFee)} travel
                      </span>
                    ) : null}
                  </div>
                  <PlacesAutocomplete
                    value={homeServiceAddress}
                    onChange={setHomeServiceAddress}
                    onPlaceSelect={handleHomeServicePlaceSelect}
                    onStatusChange={setPlacesStatus}
                    placeholder="Search complete customer address"
                    theme="default"
                  />
                  <FieldError message={fieldErrors.homeServiceAddress} />
                  {placesStatus === "loading" || homeServiceDistanceStatus === "loading" ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--cs-text-muted)]">
                      <Loader2 size={12} className="animate-spin" /> Calculating location and travel
                      fee…
                    </p>
                  ) : placesStatus === "missing_key" ? (
                    <p className="mt-1.5 text-xs font-medium text-[var(--cs-error-text)]">
                      Google address search is not configured.
                    </p>
                  ) : placesStatus === "failed" || placesStatus === "place_missing_coordinates" ? (
                    <p className="mt-1.5 text-xs font-medium text-[var(--cs-error-text)]">
                      Address coordinates could not be loaded. Select another result.
                    </p>
                  ) : homeServiceDistanceStatus === "error" ? (
                    <p className="mt-1.5 text-xs font-medium text-[var(--cs-warning-text)]">
                      {homeServiceDistanceError || "Distance could not be calculated."}
                    </p>
                  ) : homeServiceAddress && !homeServicePlace ? (
                    <p className="mt-1.5 text-xs text-[var(--cs-text-muted)]">
                      {CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)]">
                    <input
                      type="checkbox"
                      checked={paymentReceived}
                      onChange={(event) => {
                        setPaymentReceived(event.target.checked);
                        if (!event.target.checked) setPaymentMethod("");
                        if (event.target.checked) setPaymentMethod((current) => current || "cash");
                      }}
                      disabled={isSaving}
                      className="size-4 accent-[var(--cs-sand-dark)]"
                    />
                    Payment received now
                  </label>

                  {paymentReceived ? (
                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as typeof paymentMethod)
                      }
                      disabled={isSaving}
                      className={selectClassName(Boolean(fieldErrors.paymentMethod))}
                      aria-label="Payment method"
                    >
                      <option value="">Payment method</option>
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="maya">Maya</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <div className="flex h-10 items-center rounded-xl border border-dashed border-[var(--cs-border)] px-3 text-xs text-[var(--cs-text-muted)]">
                      Payment pending
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setMoreOpen((current) => !current)}
                  className="cs-btn cs-btn-secondary h-10 rounded-xl px-3 text-xs"
                  aria-expanded={moreOpen}
                >
                  Optional details
                  <ChevronDown
                    size={14}
                    className={cn("transition-transform", moreOpen ? "rotate-180" : "")}
                  />
                </button>
              </div>
              <FieldError message={fieldErrors.paymentMethod} />

              {moreOpen ? (
                <div className="grid gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3 md:grid-cols-2">
                  <div>
                    <FieldLabel label="Email" optional />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isSaving}
                      placeholder="customer@email.com"
                      className={inputClassName(false)}
                    />
                  </div>
                  <div>
                    <FieldLabel
                      label={isHomeService ? "Access note / direction" : "Booking notes"}
                      optional
                    />
                    <input
                      type="text"
                      value={isHomeService ? homeServiceAccessNote : notes}
                      onChange={(event) =>
                        isHomeService
                          ? setHomeServiceAccessNote(event.target.value)
                          : setNotes(event.target.value)
                      }
                      disabled={isSaving}
                      placeholder={
                        isHomeService
                          ? "Gate, floor, landmark or access details"
                          : "Optional booking note"
                      }
                      className={inputClassName(false)}
                    />
                  </div>
                  {isHomeService ? (
                    <div className="md:col-span-2">
                      <FieldLabel label="Internal booking note" optional />
                      <input
                        type="text"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        disabled={isSaving}
                        placeholder="Optional internal note"
                        className={inputClassName(false)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {formError ? <WorkspaceNotice tone="error">{formError}</WorkspaceNotice> : null}
            </div>
          </div>

          <aside className="min-h-0 border-t border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4 lg:border-l lg:border-t-0 lg:overflow-y-auto">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Summary
            </div>
            <div className="mt-2 flex items-center gap-2">
              {isHomeService ? <Home size={18} /> : <CalendarDays size={18} />}
              <div>
                <p className="text-base font-semibold text-[var(--cs-text)]">
                  {MODES.find((item) => item.value === mode)?.label} booking
                </p>
                <p className="text-xs text-[var(--cs-text-muted)]">
                  {date || "Choose date"} · {time || "Choose time"}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <SummaryRow label="Customer" value={fullName || "Not selected"} />
              <SummaryServices services={selectedServices} />
              <SummaryRow label="Service total" value={serviceSummaryLabel} />
              <SummaryRow
                label="Therapist"
                value={
                  selectedStaff ? selectedStaff.nickname || selectedStaff.name : "First available"
                }
              />
              {!isHomeService ? (
                <SummaryRow
                  label="Room"
                  value={selectedResource ? selectedResource.name : "First available"}
                />
              ) : (
                <>
                  <SummaryRow
                    label="Destination"
                    value={homeServicePlace?.formattedAddress || homeServiceAddress || "Required"}
                  />
                  {homeServiceDistanceQuote ? (
                    <>
                      <SummaryRow
                        label="Travel time / distance"
                        value={formatDistanceKm(homeServiceDistanceQuote.distanceKm)}
                      />
                      <SummaryRow
                        label="Travel fee"
                        value={formatCurrency(homeServiceDistanceQuote.travelFee)}
                      />
                      <SummaryRow
                        label="Total"
                        value={formatCurrency(totalPrice + homeServiceDistanceQuote.travelFee)}
                      />
                    </>
                  ) : (
                    <SummaryNote text="Select the destination to calculate the travel fee." />
                  )}
                  <SummaryRow label="Driver" value="Assigned during dispatch preparation" />
                </>
              )}
              <SummaryRow
                label="Payment"
                value={paymentReceived ? `Paid by ${paymentMethod || "method pending"}` : "Pending"}
              />
              {notes ? <SummaryRow label="Notes" value={notes} /> : null}
            </div>
          </aside>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--cs-text-secondary)]">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--cs-success-bg)] font-bold text-[var(--cs-success-text)]">
              ✓
            </span>
            <span className="truncate">
              {slotChecking
                ? "Checking availability…"
                : isHomeService
                  ? "Home-service details will feed Dispatch after saving."
                  : "Availability and room conflicts are checked before saving."}
            </span>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
                else router.push("/crm/bookings");
              }}
              disabled={isSaving}
              className="cs-btn cs-btn-secondary h-10 rounded-xl px-4"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isSaving || slotChecking}
              className="cs-btn h-10 rounded-xl bg-[var(--cs-crm-text)] px-5 text-[var(--cs-text-inverse)] shadow-[var(--cs-shadow-sm)] hover:bg-[var(--cs-success-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving || slotChecking ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {isSaving
                ? "Saving…"
                : slotChecking
                  ? "Checking…"
                  : isHomeService
                    ? "Create Home Service"
                    : mode === "walkin"
                      ? "Save Walk-in"
                      : "Schedule Booking"}
            </button>
          </div>
        </footer>
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
    <div className="border-t border-[var(--cs-border-soft)] pt-2">
      <div className="text-xs font-semibold uppercase text-[var(--cs-text-muted)]">Services</div>
      {services.length > 0 ? (
        <ol className="mt-1.5 space-y-1.5">
          {services.map((service, index) => (
            <li key={service.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-sm">
              <span className="font-semibold text-[var(--cs-sand-dark)]">{index + 1}.</span>
              <span className="min-w-0">
                <span className="block font-medium text-[var(--cs-text)]">{service.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--cs-text-muted)]">
                  {formatServiceDuration(service.durationMinutes)} · {formatCurrency(service.price)}
                </span>
              </span>
            </li>
          ))}
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
