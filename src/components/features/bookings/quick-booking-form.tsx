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
  slots?: SlotRow[];
};

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
  const [serviceId, setServiceId] = useState(initialServiceId);
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "maya" | "card" | "other" | "">(
    initialMode === "walkin" ? "cash" : ""
  );
  const [staffId, setStaffId] = useState(initialStaffId);
  const [resourceId, setResourceId] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [attendanceHint, setAttendanceHint] = useState<
    | { staffId: string; fullName: string; nickname: string | null; queuePosition: number; checkedInAt: string | null }
    | null
  >(null);
  const [loadingAttendanceHint, setLoadingAttendanceHint] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loadingNextSlot, setLoadingNextSlot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [slotChecking, setSlotChecking] = useState(false);
  const isHomeService = mode === "home_service";
  const selectedService = services.find((service) => service.id === serviceId) ?? null;
  const eligibleServices = useMemo(
    () =>
      services.filter((service) =>
        isHomeService ? service.availableHomeService : service.availableInSpa
      ),
    [isHomeService, services]
  );
  const eligibleStaff = useMemo(
    () =>
      staff.filter((member) => {
        if (!serviceId) return true;
        return member.serviceIds.length === 0 || member.serviceIds.includes(serviceId);
      }),
    [serviceId, staff]
  );
  const slotIsAllowedByRules = (slotTime: string, candidateMode: QuickBookingMode): boolean => {
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
  };

  const dirty = useMemo(
    () =>
      mode !== initialMode ||
      selectedCustomer?.id !== initialCustomer?.id ||
      customerQuery !== seededCustomerQuery ||
      fullName !== (initialCustomer?.fullName ?? initialName) ||
      phone !== (initialCustomer?.phone ?? initialPhone) ||
      email !== (initialCustomer?.email ?? "") ||
      serviceId !== initialServiceId ||
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
      initialServiceId,
      initialStaffId,
      initialTimeValue,
      mode,
      notes,
      paymentMethod,
      paymentReceived,
      phone,
      resourceId,
      selectedCustomer,
      serviceId,
      seededCustomerQuery,
      staffId,
      time,
    ]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Fetch attendance queue hint when date or service changes.
  // State updates only happen inside async callbacks to avoid synchronous
  // setState in the effect body.
  useEffect(() => {
    const controller = new AbortController();
    const id = window.setTimeout(() => {
      if (!branchId || !date || controller.signal.aborted) return;
      setLoadingAttendanceHint(true);
      getAttendanceQueueSuggestionAction({ branchId, date, serviceId: serviceId || null })
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
  }, [branchId, date, serviceId]);

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
          const data = (await response.json()) as
            | HomeServiceDistanceQuote
            | { error?: string };
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
            error instanceof Error
              ? error.message
              : "Could not calculate home-service distance."
          );
        });
    }, 0);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [branchId, homeServicePlace, isHomeService]);

  function changeMode(nextMode: QuickBookingMode) {
    const currentService = services.find((service) => service.id === serviceId);
    setMode(nextMode);
    setFieldErrors({});
    setFormError("");
    if (
      currentService &&
      (nextMode === "home_service"
        ? !currentService.availableHomeService
        : !currentService.availableInSpa)
    ) {
      setServiceId("");
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

  function selectCustomer(customer: QuickBookingCustomerOption) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.fullName);
    setFullName(customer.fullName);
    setPhone(customer.phone);
    setEmail(customer.email ?? "");
    setCustomerResults([]);
    setFieldErrors((current) => ({ ...current, customer: undefined, fullName: undefined, phone: undefined }));
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
    if (!serviceId) nextErrors.service = "Select a service.";
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
    if (!serviceId) {
      setFieldErrors((current) => ({ ...current, service: "Select a service." }));
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
        const data = await fetchCrmAvailability(candidateDate, time || "00:00");
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
    availabilityTime: string
  ): Promise<CrmAvailabilityResponse> {
    if (!serviceId || !availabilityDate || !availabilityTime) {
      return { available: false, message: NO_SCHEDULED_THERAPIST_MESSAGE, slots: [] };
    }

    const response = await fetch("/api/booking/crm-availability", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        serviceIds: [serviceId],
        date: availabilityDate,
        time: normalizeTime(availabilityTime),
        staffId: staffId || undefined,
        bookingMode: mode,
        deliveryType: isHomeService ? "home_service" : "in_spa",
      }),
    });
    const data = (await response.json()) as CrmAvailabilityResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to check CRM availability.");
    }

    return data;
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
      availability = await fetchCrmAvailability(date, time);
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
        serviceIds: [serviceId],
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
        homeServiceFormattedAddress: isHomeService
          ? homeServicePlace?.formattedAddress
          : undefined,
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
      if (successBehavior === "redirect") {
        const params = new URLSearchParams({
          date,
          bookingId: result.bookingId,
        });
        router.push(`/crm/bookings?${params.toString()}`);
      }
      router.refresh();
    } catch {
      const message = "Could not save booking. Please try again.";
      setFormError(message);
      toast.error("Booking not saved", { description: message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="crm-fade-up -m-2 bg-[var(--cs-bg)] p-2 sm:-m-4 sm:p-4">
      <section className="space-y-5 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--cs-text)] sm:text-3xl">
              Quick Booking
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--cs-text-secondary)]">
              {branchName}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div>
              <FieldLabel icon={<Sparkles size={15} />} label="Booking mode" />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {MODES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => changeMode(item.value)}
                    disabled={isSaving}
                    className={cn(
                      "min-h-20 rounded-xl border p-3 text-left transition-colors",
                      mode === item.value
                        ? "border-[var(--cs-sand)] bg-[var(--cs-sand-mist)] text-[var(--cs-text)]"
                        : "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:border-[var(--cs-border-strong)]"
                    )}
                    aria-pressed={mode === item.value}
                  >
                    <span className="block text-sm font-semibold text-[var(--cs-text)]">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-4 text-[var(--cs-text-muted)]">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                    placeholder="Search name or phone"
                    className={inputClassName(Boolean(fieldErrors.customer))}
                  />
                  {searchingCustomers ? (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--cs-text-muted)]" />
                  ) : null}
                </div>
                <FieldError message={fieldErrors.customer} />

                {selectedCustomer ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-2 text-sm">
                    <span className="font-medium text-[var(--cs-text)]">{selectedCustomer.fullName}</span>
                    <span className="text-[var(--cs-text-muted)]">{selectedCustomer.phone}</span>
                    <button
                      type="button"
                      onClick={clearSelectedCustomer}
                      disabled={isSaving}
                      className="ml-auto text-xs font-semibold text-[var(--cs-sand-dark)]"
                    >
                      Change
                    </button>
                  </div>
                ) : customerResults.length > 0 ? (
                  <div className="mt-2 overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
                    {customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="flex w-full items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--cs-surface-warm)]"
                      >
                        <span>
                          <span className="block text-sm font-medium text-[var(--cs-text)]">
                            {customer.fullName}
                          </span>
                          <span className="block text-xs text-[var(--cs-text-muted)]">
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

              <div className="md:col-span-2">
                <FieldLabel icon={<Sparkles size={15} />} label="Service" />
                <select
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  disabled={isSaving}
                  className={selectClassName(Boolean(fieldErrors.service))}
                >
                  <option value="">Select a service</option>
                  {eligibleServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {formatCurrency(service.price)}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors.service} />
              </div>

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
                <div className="flex gap-2">
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
                    className="cs-btn cs-btn-secondary h-10 shrink-0 rounded-xl px-3 text-xs"
                  >
                    {loadingNextSlot ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                    Next
                  </button>
                </div>
                <FieldError message={fieldErrors.time} />
              </div>

              {isHomeService ? (
                <>
                  <div className="md:col-span-2">
                    <FieldLabel icon={<Home size={15} />} label="Service address" />
                    <PlacesAutocomplete
                      value={homeServiceAddress}
                      onChange={setHomeServiceAddress}
                      onPlaceSelect={handleHomeServicePlaceSelect}
                      onStatusChange={setPlacesStatus}
                      placeholder="Search customer address"
                      theme="default"
                    />
                    <FieldError message={fieldErrors.homeServiceAddress} />
                    {placesStatus === "loading" ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--cs-text-muted)]">
                        <Loader2 size={12} className="animate-spin" />
                        Loading address search…
                      </p>
                    ) : null}
                    {placesStatus === "missing_key" ? (
                      <p className="mt-1.5 text-xs font-medium text-[var(--cs-error-text)]">
                        Google address search is not configured. Configure the browser Maps key to
                        select a service address.
                      </p>
                    ) : null}
                    {placesStatus === "failed" || placesStatus === "place_missing_coordinates" ? (
                      <p className="mt-1.5 text-xs font-medium text-[var(--cs-error-text)]">
                        Address search could not get coordinates. Please select another result.
                      </p>
                    ) : null}
                    {homeServiceAddress && !homeServicePlace ? (
                      <p className="mt-1.5 text-xs text-[var(--cs-text-muted)]">
                        {CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel label="Access note / special direction" optional />
                    <textarea
                      value={homeServiceAccessNote}
                      onChange={(event) => setHomeServiceAccessNote(event.target.value)}
                      disabled={isSaving}
                      rows={2}
                      placeholder="Example: blue gate, 2nd floor, near Puregold"
                      className={cn(inputClassName(false), "h-auto resize-none py-2")}
                    />
                  </div>
                </>
              ) : null}

              <div className="md:col-span-2">
                <FieldLabel label="Notes" optional />
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={isSaving}
                  rows={3}
                  placeholder="Booking notes"
                  className={cn(inputClassName(false), "h-auto resize-none py-2")}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
              <button
                type="button"
                onClick={() => setMoreOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[var(--cs-text)]"
                aria-expanded={moreOpen}
              >
                <span>More Options</span>
                <ChevronDown
                  size={16}
                  className={cn("transition-transform", moreOpen ? "rotate-180" : "")}
                />
              </button>

              {moreOpen ? (
                <div className="grid gap-4 border-t border-[var(--cs-border-soft)] p-4 md:grid-cols-2">
                  <div>
                    <FieldLabel icon={<User size={15} />} label="Therapist" optional />
                    <select
                      value={staffId}
                      onChange={(event) => setStaffId(event.target.value)}
                      disabled={isSaving}
                      className={selectClassName(false)}
                    >
                      <option value="">First available therapist</option>
                      {eligibleStaff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.nickname || member.name}
                        </option>
                      ))}
                    </select>
                    {loadingAttendanceHint ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--cs-text-muted)]">
                        <Loader2 size={12} className="animate-spin" />
                        Checking attendance queue…
                      </p>
                    ) : attendanceHint ? (
                      <p className="mt-1.5 text-xs text-[var(--cs-sand-dark)]">
                        Suggested from attendance queue:{" "}
                        <span className="font-semibold">{attendanceHint.nickname || attendanceHint.fullName}</span>
                        {" · Queue #"}{attendanceHint.queuePosition}
                        {attendanceHint.checkedInAt
                          ? ` · Clocked in ${formatAttendanceTime(attendanceHint.checkedInAt)}`
                          : null}
                        {staffId && staffId !== attendanceHint.staffId ? (
                          <span className="ml-1 text-[var(--cs-text-muted)]">(override)</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-[var(--cs-text-muted)]">
                        No checked-in staff for this date yet.
                      </p>
                    )}
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
                        <option value="">First available room</option>
                        {resources.map((resource) => (
                          <option key={resource.id} value={resource.id}>
                            {resource.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

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
                    <FieldLabel icon={<CreditCard size={15} />} label="Payment" optional />
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
                  </div>

                  {paymentReceived ? (
                    <div>
                      <FieldLabel label="Payment method" />
                      <select
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(event.target.value as typeof paymentMethod)
                        }
                        disabled={isSaving}
                        className={selectClassName(Boolean(fieldErrors.paymentMethod))}
                      >
                        <option value="">Select payment method</option>
                        <option value="cash">Cash</option>
                        <option value="gcash">GCash</option>
                        <option value="maya">Maya</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                      </select>
                      <FieldError message={fieldErrors.paymentMethod} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {formError ? (
              <div className="rounded-xl border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] px-4 py-3 text-sm font-medium text-[var(--cs-error-text)]">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (onCancel) onCancel();
                  else router.push("/crm/bookings");
                }}
                disabled={isSaving}
                className="cs-btn cs-btn-secondary h-11 rounded-xl px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isSaving || slotChecking}
                className="cs-btn h-11 rounded-xl bg-[var(--cs-crm-text)] px-5 text-[var(--cs-text-inverse)] shadow-[var(--cs-shadow-sm)] hover:bg-[var(--cs-success-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving || slotChecking ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isSaving ? "Saving..." : slotChecking ? "Checking..." : "Save Booking"}
              </button>
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
            <div>
              <div className="text-xs font-semibold uppercase text-[var(--cs-text-muted)]">
                Summary
              </div>
              <div className="mt-2 text-lg font-semibold text-[var(--cs-text)]">
                {MODES.find((item) => item.value === mode)?.label}
              </div>
            </div>
            <SummaryRow label="Customer" value={fullName || "Not selected"} />
            <SummaryRow label="Service" value={selectedService?.name ?? "Not selected"} />
            <SummaryRow label="When" value={`${date || "No date"} ${time || ""}`.trim()} />
            {isHomeService ? (
              <>
                <SummaryRow
                  label="Service address"
                  value={homeServicePlace?.formattedAddress || homeServiceAddress || "Required"}
                />
                <SummaryRow
                  label="Service subtotal"
                  value={selectedService ? formatCurrency(selectedService.price) : "Select service"}
                />
                {homeServiceDistanceStatus === "loading" ? (
                  <SummaryRow label="Distance from branch" value="Calculating…" />
                ) : homeServiceDistanceQuote ? (
                  <>
                    <SummaryRow
                      label="Distance from branch"
                      value={formatDistanceKm(homeServiceDistanceQuote.distanceKm)}
                    />
                    <SummaryRow
                      label="Free distance allowance"
                      value={formatDistanceKm(homeServiceDistanceQuote.freeKm)}
                    />
                    <SummaryRow
                      label="Additional charged km"
                      value={`${homeServiceDistanceQuote.extraKm} km`}
                    />
                    <SummaryRow
                      label="Travel fee"
                      value={formatCurrency(homeServiceDistanceQuote.travelFee)}
                    />
                    <SummaryRow
                      label="Total"
                      value={formatCurrency(
                        (selectedService?.price ?? 0) + homeServiceDistanceQuote.travelFee
                      )}
                    />
                    {homeServiceDistanceQuote.warning ? (
                      <SummaryNote tone="warning" text={homeServiceDistanceQuote.warning} />
                    ) : null}
                  </>
                ) : homeServiceAddress && !homeServicePlace ? (
                  <SummaryNote text={CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE} />
                ) : homeServiceDistanceStatus === "error" ? (
                  <SummaryNote
                    tone="warning"
                    text={homeServiceDistanceError || "Distance could not be calculated."}
                  />
                ) : (
                  <SummaryNote text="Select customer location to calculate home service fee." />
                )}
              </>
            ) : null}
            <SummaryRow
              label="Payment"
              value={paymentReceived ? `Paid by ${paymentMethod || "method pending"}` : "Pending"}
            />
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
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--cs-text)]">
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
    <div className="border-t border-[var(--cs-border-soft)] pt-3">
      <div className="text-xs font-semibold uppercase text-[var(--cs-text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[var(--cs-text)]">{value}</div>
    </div>
  );
}

function SummaryNote({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: "muted" | "warning";
}) {
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
