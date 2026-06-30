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
import { cn, formatCurrency } from "@/lib/utils";
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
  services: QuickBookingServiceOption[];
  staff: QuickBookingStaffOption[];
  resources: QuickBookingResourceOption[];
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

type FieldErrors = Partial<
  Record<
    | "customer"
    | "fullName"
    | "phone"
    | "service"
    | "date"
    | "time"
    | "homeServiceAddress"
    | "homeServiceCity"
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
  services,
  staff,
  resources,
}: QuickBookingFormProps) {
  const router = useRouter();
  const formId = useId();
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
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [time, setTime] = useState(nextQuarterTime());
  const [notes, setNotes] = useState("");
  const [homeServiceAddress, setHomeServiceAddress] = useState("");
  const [homeServiceCity, setHomeServiceCity] = useState("");
  const [homeServiceLandmark, setHomeServiceLandmark] = useState("");
  const [homeServiceNotes, setHomeServiceNotes] = useState("");
  const [paymentReceived, setPaymentReceived] = useState(initialMode === "walkin");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "maya" | "card" | "other" | "">(
    initialMode === "walkin" ? "cash" : ""
  );
  const [staffId, setStaffId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loadingNextSlot, setLoadingNextSlot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
      if (homeServiceAddress.trim().length < 5) {
        nextErrors.homeServiceAddress = "Enter the complete home-service address.";
      }
      if (homeServiceCity.trim().length < 2) {
        nextErrors.homeServiceCity = "Enter the complete home-service address.";
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
        const params = new URLSearchParams({
          branchId,
          serviceIds: serviceId,
          date: candidateDate,
        });
        const response = await fetch(`/api/booking/available-slots?${params.toString()}`, {
          credentials: "same-origin",
        });
        const data = (await response.json()) as { slots?: SlotRow[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to find the next available time.");
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
        time: "No therapist is available at the selected time.",
      }));
    } catch {
      setFormError("Unable to find the next available time. Choose a valid date and time.");
    } finally {
      setLoadingNextSlot(false);
    }
  }

  async function submit() {
    if (isSaving) return;

    const nextErrors = validate();
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.values(nextErrors).some(Boolean)) return;

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
        homeServiceCity: isHomeService ? homeServiceCity.trim() : undefined,
        homeServiceLandmark: isHomeService ? homeServiceLandmark.trim() || undefined : undefined,
        homeServiceParkingNotes: isHomeService ? homeServiceNotes.trim() || undefined : undefined,
        homeServiceCustomerNotes: isHomeService ? homeServiceNotes.trim() || undefined : undefined,
      });

      if (!result.ok) {
        const message = result.message || "Could not save booking. Please try again.";
        setFieldErrors(mapServerErrorToFields(message));
        setFormError(message);
        toast.error("Booking not saved", { description: message });
        return;
      }

      toast.success("Booking saved", { description: "The booking is now in the CRM workspace." });
      const params = new URLSearchParams({
        date,
        bookingId: result.bookingId,
      });
      router.push(`/crm/bookings?${params.toString()}`);
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
                    <FieldLabel icon={<Home size={15} />} label="Address" />
                    <input
                      type="text"
                      value={homeServiceAddress}
                      onChange={(event) => setHomeServiceAddress(event.target.value)}
                      disabled={isSaving}
                      placeholder="Complete address"
                      className={inputClassName(Boolean(fieldErrors.homeServiceAddress))}
                    />
                    <FieldError message={fieldErrors.homeServiceAddress} />
                  </div>
                  <div>
                    <FieldLabel icon={<MapPin size={15} />} label="City / barangay" />
                    <input
                      type="text"
                      value={homeServiceCity}
                      onChange={(event) => setHomeServiceCity(event.target.value)}
                      disabled={isSaving}
                      placeholder="City or barangay"
                      className={inputClassName(Boolean(fieldErrors.homeServiceCity))}
                    />
                    <FieldError message={fieldErrors.homeServiceCity} />
                  </div>
                  <div>
                    <FieldLabel label="Landmark" optional />
                    <input
                      type="text"
                      value={homeServiceLandmark}
                      onChange={(event) => setHomeServiceLandmark(event.target.value)}
                      disabled={isSaving}
                      placeholder="Nearby landmark"
                      className={inputClassName(false)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel label="Location notes" optional />
                    <textarea
                      value={homeServiceNotes}
                      onChange={(event) => setHomeServiceNotes(event.target.value)}
                      disabled={isSaving}
                      rows={2}
                      placeholder="Gate, unit, parking, or access notes"
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
                onClick={() => router.push("/crm/bookings")}
                disabled={isSaving}
                className="cs-btn cs-btn-secondary h-11 rounded-xl px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isSaving}
                className="cs-btn h-11 rounded-xl bg-[var(--cs-crm-text)] px-5 text-[var(--cs-text-inverse)] shadow-[var(--cs-shadow-sm)] hover:bg-[var(--cs-success-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isSaving ? "Saving..." : "Save Booking"}
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
            <SummaryRow
              label="Payment"
              value={paymentReceived ? `Paid by ${paymentMethod || "method pending"}` : "Pending"}
            />
            {isHomeService ? <SummaryRow label="Address" value={homeServiceAddress || "Required"} /> : null}
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

function inputClassName(hasError: boolean): string {
  return cn(
    "h-10 w-full rounded-xl border bg-[var(--cs-surface-warm)] px-3 text-sm text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-70",
    hasError ? "border-[var(--cs-error-text)]" : "border-[var(--cs-border)]"
  );
}

function selectClassName(hasError: boolean): string {
  return cn(inputClassName(hasError), "appearance-auto");
}
