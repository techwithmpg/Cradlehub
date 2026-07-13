"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  DoorOpen,
  Edit3,
  FileText,
  Home,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Phone,
  ReceiptText,
  RotateCcw,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentStatusBadge } from "@/components/features/dashboard/payment-status-badge";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import {
  ContextChip,
  EmptyState,
  WorkspaceSection,
} from "@/components/features/attendance/attendance-ui";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { cn, formatTime, formatCurrency } from "@/lib/utils";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { getAssignmentRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import { editBookingAction, updateBookingStatusAction } from "@/app/(dashboard)/manager/bookings/actions";
import {
  crmStartServiceAction,
  crmCompleteServiceAction,
  assignBookingTherapistAction,
  resolveStaffScheduleExceptionAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { autoCompleteDueSessionAction } from "@/app/(dashboard)/staff-portal/actions";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import {
  getSelectedBookingActionPlan,
  getSelectedBookingRecommendationState,
  shouldShowSelectedBookingFullDetail,
  type SelectedBookingAction,
  type SelectedBookingActionId,
} from "@/lib/bookings/selected-booking-panel";
import { canUpdateBooking } from "@/lib/permissions";
import { BookingFollowupModal, type BookingFollowupResult } from "./booking-followup-modal";
import { CustomerArrivedModal } from "./customer-arrived-modal";
import { RoomAssignmentModal } from "./room-assignment-modal";
import { RescheduleBookingModal } from "./reschedule-booking-modal";
import { HybridSelectedBookingCard } from "./hybrid-selected-booking-card";
import type { WorkspaceBookingRow } from "./bookings-workspace";
import {
  getOpenStaffScheduleException,
  getStaffScheduleExceptionMessage,
  type StaffScheduleException,
} from "@/lib/bookings/staff-schedule-exception";

type OneOrMany<T> = T | T[] | null;

const DEFAULT_ROWS_PER_PAGE = 8;
const ROWS_PER_PAGE_OPTIONS = [8, 10, 20] as const;
const NO_SELECTION = "__no_booking_selected__";

function readFirst<T>(rel: OneOrMany<T>): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function readPricePaid(metadata: Record<string, unknown> | null | undefined): number {
  if (!metadata) return 0;
  const n = Number(metadata["price_paid"] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isHomeServiceBooking(booking: WorkspaceBookingRow): boolean {
  return (
    booking.delivery_type === "home_service" ||
    booking.type === "home_service" ||
    booking.metadata?.delivery_type === "home_service" ||
    booking.metadata?.type === "home_service"
  );
}

function isClosedOperationalBooking(booking: WorkspaceBookingRow): boolean {
  return (
    booking.status === "completed" ||
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    booking.booking_progress_status === "completed" ||
    booking.booking_progress_status === "no_show"
  );
}

function canUseRoomAssignment(booking: WorkspaceBookingRow): boolean {
  return !isHomeServiceBooking(booking) && !isClosedOperationalBooking(booking);
}

function isNotStartedProgress(status: string | null | undefined): boolean {
  return !status || status === "not_started";
}

function formatBookingDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function sourceLabel(booking: WorkspaceBookingRow): string {
  const crmMode = booking.metadata?.crm_booking_mode;
  if (crmMode === "phone") return "Phone Booking";
  if (crmMode === "standard_future") return "Future Booking";
  if (crmMode === "walkin") return "Walk-in";
  if (isHomeServiceBooking(booking)) return "Home Service";
  if (booking.type === "online") return "Online";
  if (booking.type === "walkin") return "Walk-in";
  return booking.type || "Booking";
}

function customerInitials(name: string | null | undefined): string {
  if (!name) return "CH";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CH";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${second}`.toUpperCase() || "CH";
}

function getOperationalStatus(booking: WorkspaceBookingRow): { label: string; tone: "pending" | "confirmed" | "waiting" | "service" | "completed" | "neutral" | "danger" } {
  const progress = booking.booking_progress_status ?? null;
  if (isCrmPendingBookingStatus(booking.status)) return { label: "Pending Call", tone: "pending" };
  if (booking.status === "cancelled") return { label: "Cancelled", tone: "danger" };
  if (booking.status === "no_show" || progress === "no_show") return { label: "No Show", tone: "danger" };
  if (booking.status === "completed" || progress === "completed") return { label: "Completed", tone: "completed" };
  if (booking.status === "in_progress" || progress === "session_started") return { label: "In Service", tone: "service" };
  if (progress === "travel_started") return { label: "Travel Started", tone: "service" };
  if (progress === "arrived") return { label: "Arrived", tone: "waiting" };
  if (progress === "checked_in") return { label: "Checked In", tone: "waiting" };
  if (booking.status === "confirmed") return { label: "Confirmed", tone: "confirmed" };
  return { label: booking.status.replaceAll("_", " "), tone: "neutral" };
}

function getNextActionLabel(booking: WorkspaceBookingRow): string {
  const progress = booking.booking_progress_status ?? null;
  const isHomeService = isHomeServiceBooking(booking);
  if (isClosedOperationalBooking(booking)) return "Review summary";
  if (isCrmPendingBookingStatus(booking.status)) return "Call to confirm";
  if (isHomeService) {
    if (booking.status === "confirmed" && isNotStartedProgress(progress)) return "Coordinate dispatch";
    if (progress === "travel_started") return "Track travel";
    if (progress === "arrived") return "Start service";
  }
  if (booking.status === "confirmed" && isNotStartedProgress(progress)) return "Awaiting arrival";
  if (progress === "checked_in" && !booking.resource_id) return "Assign room";
  if (progress === "checked_in") return "Start service";
  if (booking.status === "in_progress" || progress === "session_started") return "Complete service";
  return "Follow up";
}

function statusToneClass(tone: ReturnType<typeof getOperationalStatus>["tone"]): string {
  switch (tone) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "confirmed":
      return "border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]";
    case "waiting":
      return "border-[var(--cs-sand-mist)] bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]";
    case "service":
      return "border-[var(--cs-info-bg)] bg-[var(--cs-info-bg)] text-[var(--cs-info-text)]";
    case "completed":
      return "border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]";
    case "danger":
      return "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]";
    case "neutral":
      return "border-[var(--cs-neutral-bg)] bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral-text)]";
  }
}

function OperationalStatusPill({ booking }: { booking: WorkspaceBookingRow }) {
  const status = getOperationalStatus(booking);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize", statusToneClass(status.tone))}>
      {status.label}
    </span>
  );
}

function StaffReviewPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
      <AlertTriangle size={12} />
      Staff review
    </span>
  );
}

function SourcePill({ booking }: { booking: WorkspaceBookingRow }) {
  const isHomeService = isHomeServiceBooking(booking);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cs-text-secondary)]">
      {isHomeService ? <Home size={12} /> : <MapPin size={12} />}
      {sourceLabel(booking)}
    </span>
  );
}

function readAddOns(metadata: Record<string, unknown> | null | undefined): string | null {
  const raw = metadata?.addons ?? metadata?.add_ons;
  if (!Array.isArray(raw)) return null;
  const labels = raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" ? name : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
  return labels.length > 0 ? labels.join(", ") : null;
}

function getPageIndexes(totalPages: number, currentPage: number): number[] {
  const maxButtons = 5;
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  let start = Math.max(0, currentPage - 2);
  let end = Math.min(totalPages - 1, start + maxButtons - 1);
  start = Math.max(0, end - maxButtons + 1);
  end = Math.min(totalPages - 1, start + maxButtons - 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type BookingsTableProps = {
  bookings: WorkspaceBookingRow[];
  /** Full unfiltered list from BookingsWorkspace — used to find a booking
   *  that has moved to a different workflow tab after a status change. */
  allBookings?: WorkspaceBookingRow[];
  viewerRole: string;
  dispatchHref?: string;
  search?: string;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  initialSelectedId?: string;
  confirmPaymentAction?: ActionFn;
  onBookingsChanged?: () => void;
};

type BookingModalState =
  | { type: "followup"; booking: WorkspaceBookingRow; initialResult: BookingFollowupResult }
  | { type: "arrival"; booking: WorkspaceBookingRow }
  | { type: "room"; booking: WorkspaceBookingRow }
  | { type: "reschedule"; booking: WorkspaceBookingRow }
  | null;

function hasOutstandingPayment(booking: WorkspaceBookingRow): boolean {
  const paymentStatus = booking.payment_status ?? "unpaid";
  if (!["unpaid", "pending", "pending_payment"].includes(paymentStatus)) return false;
  const price = readPricePaid(booking.metadata);
  return price <= 0 || booking.amount_paid < price;
}

function PrimaryRowAction({
  booking,
  paymentAction,
  onSelect,
  onOpenFollowup,
  onOpenArrival,
  onOpenRoomAssignment,
  onBookingsChanged,
}: {
  booking: WorkspaceBookingRow;
  paymentAction?: ActionFn;
  onSelect: () => void;
  onOpenFollowup: (initialResult: BookingFollowupResult) => void;
  onOpenArrival: () => void;
  onOpenRoomAssignment: () => void;
  onBookingsChanged?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const progress = booking.booking_progress_status ?? null;
  const isHomeService = isHomeServiceBooking(booking);
  const isClosed = isClosedOperationalBooking(booking);
  const isPendingConfirmation = isCrmPendingBookingStatus(booking.status);
  const isActive = booking.status === "in_progress" || progress === "session_started";

  function runServiceStart() {
    startTransition(async () => {
      const result = await crmStartServiceAction({ bookingId: booking.id });
      if (!result.success) {
        toast.error(result.error ?? "Could not start service.");
        return;
      }
      toast.success("Service started.");
      onBookingsChanged?.();
      router.refresh();
    });
  }

  if (isPendingConfirmation) {
    return (
      <PrimaryTableButton onClick={() => onOpenFollowup("confirmed")}>
        Call & Confirm
      </PrimaryTableButton>
    );
  }

  if (hasOutstandingPayment(booking) && paymentAction) {
    return (
      <PaymentActionMenu
        bookingId={booking.id}
        paymentStatus={booking.payment_status ?? "unpaid"}
        paymentMethod={booking.payment_method ?? "pay_on_site"}
        amountPaid={booking.amount_paid ?? 0}
        pricePaid={readPricePaid(booking.metadata)}
        paymentAction={paymentAction}
        onUpdate={onBookingsChanged}
        triggerLabel="Review Payment"
        triggerVariant="panelSecondary"
        fullWidth
      />
    );
  }

  if (isClosed) {
    return <PrimaryTableButton onClick={onSelect}>View Record</PrimaryTableButton>;
  }

  if (!isHomeService && booking.status === "confirmed" && isNotStartedProgress(progress)) {
    return <PrimaryTableButton onClick={onOpenArrival}>Mark Arrived</PrimaryTableButton>;
  }

  if (!isHomeService && progress === "checked_in" && !booking.resource_id) {
    return <PrimaryTableButton onClick={onOpenRoomAssignment}>Resolve Room</PrimaryTableButton>;
  }

  if (!isHomeService && progress === "checked_in" && booking.resource_id) {
    return (
      <PrimaryTableButton onClick={runServiceStart} disabled={isPending}>
        {isPending ? "Starting..." : "Start Service"}
      </PrimaryTableButton>
    );
  }

  if (isHomeService && booking.status === "confirmed" && isNotStartedProgress(progress)) {
    return <PrimaryTableButton onClick={() => router.push("/crm/dispatch")}>Open Dispatch</PrimaryTableButton>;
  }

  if (isActive) {
    return <PrimaryTableButton onClick={onSelect}>View Progress</PrimaryTableButton>;
  }

  return <PrimaryTableButton onClick={onSelect}>Open</PrimaryTableButton>;
}

function PrimaryTableButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 text-xs font-semibold text-[var(--cs-text)] transition-colors hover:border-[var(--cs-border-strong)] hover:bg-[var(--cs-sand-tint)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function BookingsTable({
  bookings,
  allBookings,
  viewerRole,
  dispatchHref,
  search,
  statusAction,
  paymentAction,
  initialSelectedId,
  confirmPaymentAction,
  onBookingsChanged,
}: BookingsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtered = search
    ? bookings.filter((booking) => {
        const customer = readFirst(booking.customers);
        const staff = readFirst(booking.staff);
        const staffName = staff ? getStaffAdminName(staff) : "";
        const term = search.toLowerCase();
        return (
          booking.id.toLowerCase().includes(term) ||
          (customer?.full_name ?? "").toLowerCase().includes(term) ||
          (customer?.phone ?? "").includes(term) ||
          staffName.toLowerCase().includes(term)
        );
      })
    : bookings;

  const requestedBookingId =
    searchParams.get("bookingId") ?? searchParams.get("highlight") ?? initialSelectedId ?? null;
  const shouldOpenRoomAssignment = searchParams.get("openRoomAssignment") === "1";
  const initialRoomBooking =
    shouldOpenRoomAssignment && requestedBookingId
      ? filtered.find((booking) => booking.id === requestedBookingId && canUseRoomAssignment(booking) && !booking.resource_id) ?? null
      : null;

  const [selectedId, setSelectedId] = useState<string | null>(() => initialSelectedId ?? null);
  const [pageIndex, setPageIndex] = useState(() => {
    if (!initialSelectedId) return 0;
    const idx = filtered.findIndex((b) => b.id === initialSelectedId);
    return idx >= 0 ? Math.floor(idx / DEFAULT_ROWS_PER_PAGE) : 0;
  });
  const [rowsPerPage, setRowsPerPage] = useState<number>(DEFAULT_ROWS_PER_PAGE);
  const [modalState, setModalState] = useState<BookingModalState>(() =>
    initialRoomBooking ? { type: "room", booking: initialRoomBooking } : null
  );

  useEffect(() => {
    if (!shouldOpenRoomAssignment) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("openRoomAssignment");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [shouldOpenRoomAssignment]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const startIndex = safePageIndex * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filtered.length);
  const pageBookings = filtered.slice(startIndex, endIndex);
  // When a booking moves to a different workflow tab after a status change
  // (e.g. confirmed → in-service after Start Service), it is no longer in
  // `pageBookings`. Fall back to the full unfiltered `allBookings` list so
  // the right panel stays populated and shows the updated booking data.
  const selected = (() => {
    if (selectedId === NO_SELECTION) return null;
    const inPage = pageBookings.find((b) => b.id === selectedId);
    if (inPage) return inPage;
    const inAll = allBookings?.find((b) => b.id === selectedId);
    if (inAll) return inAll;
    return pageBookings[0] ?? null;
  })();
  const pageIndexes = getPageIndexes(totalPages, safePageIndex);

  function goToPage(nextPage: number) {
    setPageIndex(Math.min(Math.max(nextPage, 0), totalPages - 1));
  }

  function handleRowsPerPageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextRowsPerPage = Number(event.target.value);
    if (!Number.isFinite(nextRowsPerPage)) return;
    setRowsPerPage(nextRowsPerPage);
    setPageIndex(0);
  }

  function handleBookingsChanged() {
    onBookingsChanged?.();
    router.refresh();
  }

  function handleArrivedSuccess() {
    if (modalState?.type !== "arrival") return;
    const arrivedBooking = {
      ...modalState.booking,
      booking_progress_status: "checked_in",
    };
    handleBookingsChanged();
    if (canUseRoomAssignment(arrivedBooking) && !arrivedBooking.resource_id) {
      setModalState({ type: "room", booking: arrivedBooking });
      return;
    }
    setModalState(null);
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No bookings"
        detail={
          search
            ? "No bookings match your search."
            : "No bookings match the selected filters."
        }
        icon={<CalendarClock className="size-4" />}
      />
    );
  }

  return (
    <>
      <style>{`
        .bw-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
        .bw-th { padding: 0.75rem 0.875rem; text-align: left; font-size: 0.66rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em; color: var(--cs-text-muted);
          background: var(--cs-surface-warm); border-bottom: 1px solid var(--cs-border-soft); white-space: nowrap; }
        .bw-td { padding: 0.8rem 0.875rem; vertical-align: middle; border-bottom: 1px solid var(--cs-border-soft);
          background: var(--cs-surface); }
        .bw-row { cursor: pointer; transition: transform 0.16s ease, box-shadow 0.16s ease; }
        .bw-row:hover .bw-td { background: var(--cs-sand-tint); }
        .bw-row:focus-visible { outline: none; }
        .bw-row:focus-visible .bw-td { background: var(--cs-sand-tint); box-shadow: inset 0 0 0 2px var(--ring); }
        .bw-row-selected .bw-td { background: var(--cs-sand-tint); }
        .bw-row-selected .bw-td:first-child { box-shadow: inset 4px 0 0 var(--cs-sand); }
        .bw-row:last-child .bw-td { border-bottom: none; }
        .bw-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bw-col-time { width: 112px; }
        .bw-col-customer { width: 190px; }
        .bw-col-service { width: 230px; }
        .bw-col-assignment { width: 190px; }
        .bw-col-status { width: 132px; }
        .bw-col-primary { width: 156px; }
        .bw-col-actions { width: 54px; white-space: nowrap; text-align: right; }
        .bw-pagination { border-top: 1px solid var(--cs-border-soft); background: var(--cs-surface-warm);
          display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
          flex-wrap: wrap; padding: 0.875rem; }
        .bw-page-controls { display: flex; align-items: center; justify-content: center; gap: 0.25rem; flex-wrap: wrap; }
        .bw-page-button { height: 31px; min-width: 31px; border-radius: 999px; border: 1px solid var(--cs-border);
          background: var(--cs-surface); color: var(--cs-text); font-size: 0.75rem; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; padding: 0 0.65rem; }
        .bw-page-button:disabled { opacity: 0.45; cursor: not-allowed; }
        .bw-page-button-active { background: var(--cs-crm-text); border-color: var(--cs-crm-text); color: var(--cs-text-inverse); font-weight: 700; }
        .bw-mobile-list { display: none; }
        @media (max-width: 1180px) {
          .bw-shell { grid-template-columns: 1fr !important; }
          .bw-panel { display: block; }
        }
        @media (max-width: 980px) {
          .bw-col-assignment { display: none; }
        }
        @media (max-width: 760px) {
          .bw-table-wrap { display: none; }
          .bw-mobile-list { display: grid; }
          .bw-pagination { align-items: stretch; }
          .bw-page-controls { width: 100%; justify-content: flex-start; }
        }
      `}</style>

      <div className="bw-shell grid grid-cols-[minmax(0,1fr)_360px] items-start gap-4">
        <WorkspaceSection
          title="Booking List"
          description="Select a row to guide the next front-desk action."
          context={
            <ContextChip ariaLabel={`Visible bookings: ${filtered.length}`}>
              {filtered.length} total
            </ContextChip>
          }
          className="min-w-0"
        >

          <div className="bw-table-wrap overflow-x-auto">
          <table className="bw-table">
            <thead>
              <tr>
                <th className="bw-th bw-col-time">Time</th>
                <th className="bw-th bw-col-customer">Customer</th>
                <th className="bw-th bw-col-service">Service</th>
                <th className="bw-th bw-col-assignment">Assignment</th>
                <th className="bw-th bw-col-status">Status</th>
                <th className="bw-th bw-col-primary">Primary Action</th>
                <th className="bw-th bw-col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {pageBookings.map((booking) => {
                const customer = readFirst(booking.customers);
                const service = readFirst(booking.services);
                const resource = readFirst(booking.branch_resources);
                const staff = readFirst(booking.staff);
                const staffName = staff ? getStaffAdminName(staff) : "Unassigned";
                const isSelected = booking.id === selected?.id;
                const shortId = booking.id.slice(0, 8).toUpperCase();
                const assignmentLabel = [
                  staffName,
                  resource?.name ?? (isHomeServiceBooking(booking) ? "Home service" : "Room TBD"),
                ].filter(Boolean).join(" · ");

                return (
                  <tr
                    key={booking.id}
                    className={`bw-row${isSelected ? " bw-row-selected" : ""}`}
                    onClick={() => setSelectedId(booking.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedId(booking.id);
                    }}
                    tabIndex={0}
                    aria-label={`Select booking ${shortId}`}
                    aria-selected={isSelected}
                  >
                    <td className="bw-td bw-col-time">
                      <div className="text-sm font-semibold text-[var(--cs-text)]">
                        {formatTime(booking.start_time)}
                      </div>
                      <div className="text-[11px] text-[var(--cs-text-muted)]">
                        {formatBookingDate(booking.booking_date)}
                      </div>
                    </td>

                    <td className="bw-td bw-col-customer">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-xs font-bold text-[var(--cs-sand-dark)]">
                          {customerInitials(customer?.full_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="bw-truncate text-sm font-semibold text-[var(--cs-text)]" title={customer?.full_name ?? undefined}>
                            {customer?.full_name ?? "Customer"}
                          </div>
                          <div className="bw-truncate text-[11px] text-[var(--cs-text-muted)]" title={customer?.phone ?? shortId}>
                            {customer?.phone ?? `#${shortId}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="bw-td bw-col-service">
                      <div className="bw-truncate text-sm font-medium text-[var(--cs-text)]" title={service?.name ?? undefined}>
                        {service?.name ?? "Service"}
                      </div>
                      <div className="mt-1">
                        <SourcePill booking={booking} />
                      </div>
                    </td>

                    <td className="bw-td bw-col-assignment">
                      <div className="bw-truncate text-sm font-medium text-[var(--cs-text)]" title={assignmentLabel}>
                        {staffName}
                      </div>
                      <div className="bw-truncate text-[11px] text-[var(--cs-text-muted)]">
                        {resource?.name ?? (isHomeServiceBooking(booking) ? "Home service" : "Room TBD")}
                      </div>
                    </td>

                    <td className="bw-td bw-col-status">
                      <div className="flex flex-col items-start gap-1.5">
                        <OperationalStatusPill booking={booking} />
                        {getOpenStaffScheduleException(booking.metadata) ? (
                          <StaffReviewPill />
                        ) : null}
                      </div>
                    </td>

                    <td className="bw-td bw-col-primary" onClick={(event) => event.stopPropagation()}>
                      <PrimaryRowAction
                        booking={booking}
                        paymentAction={paymentAction}
                        onSelect={() => setSelectedId(booking.id)}
                        onOpenFollowup={(initialResult) => setModalState({ type: "followup", booking, initialResult })}
                        onOpenArrival={() => setModalState({ type: "arrival", booking })}
                        onOpenRoomAssignment={() => setModalState({ type: "room", booking })}
                        onBookingsChanged={handleBookingsChanged}
                      />
                    </td>

                    <td className="bw-td bw-col-actions" onClick={(event) => event.stopPropagation()}>
                      <BookingActionMenu
                        bookingId={booking.id}
                        currentStatus={booking.status}
                        userRole={viewerRole}
                        statusAction={statusAction}
                        triggerVariant="icon"
                        triggerAriaLabel={`Open more actions for booking ${shortId}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="bw-mobile-list gap-2 p-3">
            {pageBookings.map((booking) => {
              const customer = readFirst(booking.customers);
              const service = readFirst(booking.services);
              const price = readPricePaid(booking.metadata);
              const isSelected = booking.id === selected?.id;

              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedId(booking.id)}
                  className={cn(
                    "rounded-lg border bg-[var(--cs-surface)] p-3 text-left shadow-[var(--cs-shadow-xs)]",
                    isSelected ? "border-[var(--cs-sand)] bg-[var(--cs-sand-tint)]" : "border-[var(--cs-border-soft)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--cs-text)]">
                        {customer?.full_name ?? "Customer"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--cs-text-muted)]">
                        {service?.name ?? "Service"} / {formatTime(booking.start_time)}
                      </div>
                    </div>
                    <OperationalStatusPill booking={booking} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SourcePill booking={booking} />
                    <PaymentStatusBadge status={booking.payment_status} />
                    {getOpenStaffScheduleException(booking.metadata) ? (
                      <StaffReviewPill />
                    ) : null}
                    {price > 0 ? (
                      <span className="rounded-full bg-[var(--cs-surface-warm)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cs-text-secondary)]">
                        {formatCurrency(price)}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-[var(--cs-sand-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cs-sand-dark)]">
                      {getNextActionLabel(booking)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bw-pagination">
            <div className="text-xs text-[var(--cs-text-muted)]">
              Showing {startIndex + 1} to {endIndex} of {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
            </div>

            <div className="bw-page-controls" aria-label="Booking pagination">
              <button type="button" className="bw-page-button" onClick={() => goToPage(safePageIndex - 1)} disabled={safePageIndex === 0}>
                Previous
              </button>
              {pageIndexes.map((index) => (
                <button
                  key={index}
                  type="button"
                  className={`bw-page-button${index === safePageIndex ? " bw-page-button-active" : ""}`}
                  onClick={() => goToPage(index)}
                  aria-current={index === safePageIndex ? "page" : undefined}
                >
                  {index + 1}
                </button>
              ))}
              <button type="button" className="bw-page-button" onClick={() => goToPage(safePageIndex + 1)} disabled={safePageIndex >= totalPages - 1}>
                Next
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
              Rows per page
              <select
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                aria-label="Rows per page"
                className="h-[30px] rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-[var(--cs-text)] outline-none"
              >
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </WorkspaceSection>

        <div className="bw-panel">
          {selected ? (
            <BookingDetailsPanel
              key={`${selected.id}-${readFirst(selected.staff)?.id ?? "none"}-${selected.session_started_at ?? "none"}-${selected.booking_progress_status ?? "none"}`}
              booking={selected}
              viewerRole={viewerRole}
              dispatchHref={dispatchHref}
              onClose={() => setSelectedId(NO_SELECTION)}
              statusAction={statusAction}
              paymentAction={paymentAction}
              confirmPaymentAction={confirmPaymentAction}
              onOpenFollowup={(booking, initialResult) =>
                setModalState({ type: "followup", booking, initialResult })
              }
              onOpenReschedule={(booking) => setModalState({ type: "reschedule", booking })}
              onOpenArrival={(booking) => setModalState({ type: "arrival", booking })}
              onOpenRoomAssignment={(booking) => setModalState({ type: "room", booking })}
              onBookingsChanged={handleBookingsChanged}
            />
          ) : (
            <EmptyState
              title="No booking selected"
              detail="Select a booking to view details."
            />
          )}
        </div>
      </div>

      <BookingFollowupModal
        key={modalState?.type === "followup" ? `${modalState.booking.id}-${modalState.initialResult}` : "followup-closed"}
        open={modalState?.type === "followup"}
        booking={modalState?.type === "followup" ? modalState.booking : null}
        initialResult={modalState?.type === "followup" ? modalState.initialResult : "confirmed"}
        onOpenChange={(open) => {
          if (!open) setModalState(null);
        }}
        onSuccess={handleBookingsChanged}
        onRescheduleRequested={(booking) => setModalState({ type: "reschedule", booking })}
      />
      <CustomerArrivedModal
        key={modalState?.type === "arrival" ? modalState.booking.id : "arrival-closed"}
        open={modalState?.type === "arrival"}
        booking={modalState?.type === "arrival" ? modalState.booking : null}
        onOpenChange={(open) => {
          if (!open) setModalState(null);
        }}
        onMarkedArrived={handleArrivedSuccess}
      />
      <RoomAssignmentModal
        key={modalState?.type === "room" ? modalState.booking.id : "room-closed"}
        open={modalState?.type === "room"}
        booking={modalState?.type === "room" ? modalState.booking : null}
        onOpenChange={(open) => {
          if (!open) setModalState(null);
        }}
        onAssigned={handleBookingsChanged}
      />
      <RescheduleBookingModal
        key={modalState?.type === "reschedule" ? modalState.booking.id : "reschedule-closed"}
        open={modalState?.type === "reschedule"}
        booking={modalState?.type === "reschedule" ? modalState.booking : null}
        onOpenChange={(open) => {
          if (!open) setModalState(null);
        }}
        onRescheduled={handleBookingsChanged}
      />
    </>
  );
}

function BookingDetailsPanel({
  booking,
  viewerRole,
  dispatchHref,
  onClose,
  statusAction,
  paymentAction,
  confirmPaymentAction,
  onOpenFollowup,
  onOpenReschedule,
  onOpenArrival,
  onOpenRoomAssignment,
  onBookingsChanged,
}: {
  booking: WorkspaceBookingRow;
  viewerRole: string;
  dispatchHref?: string;
  onClose: () => void;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  confirmPaymentAction?: ActionFn;
  onOpenFollowup: (booking: WorkspaceBookingRow, initialResult: BookingFollowupResult) => void;
  onOpenReschedule: (booking: WorkspaceBookingRow) => void;
  onOpenArrival: (booking: WorkspaceBookingRow) => void;
  onOpenRoomAssignment: (booking: WorkspaceBookingRow) => void;
  onBookingsChanged?: () => void;
}) {
  const router = useRouter();
  const [isCompleting, startCompleteTransition] = useTransition();

  // Optimistic override — set immediately after Start Service success so the
  // countdown appears before router.refresh() completes and the updated server
  // data flows back into the panel.  When the parent's key changes (because
  // `selected.session_started_at` is now set from the server), this component
  // remounts and the override resets to null automatically.
  type SessionOverride = {
    status: string;
    booking_progress_status: string;
    session_started_at: string;
  };
  const [sessionOverride, setSessionOverride] = useState<SessionOverride | null>(null);
  const [noteOverride, setNoteOverride] = useState<string | null>(null);
  const [showPaymentReview, setShowPaymentReview] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const scheduleException = getOpenStaffScheduleException(booking.metadata);

  // Effective fields: optimistic values take precedence until server data arrives.
  const effectiveStatus           = sessionOverride?.status                   ?? booking.status;
  const effectiveProgressStatus   = sessionOverride?.booking_progress_status  ?? booking.booking_progress_status;
  const effectiveSessionStartedAt = sessionOverride?.session_started_at       ?? booking.session_started_at;

  const customer = readFirst(booking.customers);
  const service  = readFirst(booking.services);
  const staff    = readFirst(booking.staff);
  const staffName = staff ? getStaffAdminName(staff) : "Unassigned";
  const branch   = readFirst(booking.branches);
  const resource = readFirst(booking.branch_resources);
  const price    = readPricePaid(booking.metadata);
  const balance  = price > 0 ? Math.max(0, price - booking.amount_paid) : 0;
  const notes    = (booking.metadata as Record<string, unknown> | null)?.["customer_notes"];
  const displayNote = noteOverride ?? (typeof notes === "string" ? notes : "");
  const durationMinutes = service?.duration_minutes;
  const addOns   = readAddOns(booking.metadata);
  const isHomeService = isHomeServiceBooking(booking);
  const roomLabel = resource?.name ?? (isHomeService ? "Home service" : "Room TBD");
  const recommendationState = getSelectedBookingRecommendationState({
    status: booking.status,
    bookingProgressStatus: booking.booking_progress_status,
    type: booking.type,
    deliveryType: booking.delivery_type,
    resourceId: booking.resource_id,
    hasStaff: Boolean(staff),
    hasDriver: false,
  });
  const canEditNote = canUpdateBooking(viewerRole) && !isClosedOperationalBooking(booking);

  // ── Service state guards (use effective values so optimistic state applies) ─

  const progress = effectiveProgressStatus ?? null;

  // Active service requires BOTH a status flag AND session_started_at.
  const isServiceActive = (
    effectiveStatus === "in_progress" || progress === "session_started"
  ) && Boolean(effectiveSessionStartedAt);

  // ── Mutation helpers ──────────────────────────────────────────────────────

  function afterServiceMutation() {
    onBookingsChanged?.();
    router.refresh();
  }

  function handleCompleteService() {
    startCompleteTransition(async () => {
      const result = await crmCompleteServiceAction({ bookingId: booking.id });
      if (!result.success) {
        toast.error(result.error ?? "Could not complete service.");
        return;
      }
      toast.success("Service completed.");
      afterServiceMutation();
    });
  }

  // Called by HybridSelectedBookingCard when the countdown expires.
  function handleAutoComplete() {
    startCompleteTransition(async () => {
      const result = await autoCompleteDueSessionAction(booking.id);
      if (result.ok) {
        toast.success("Service auto-completed.");
      } else if (result.code !== "ALREADY_COMPLETED") {
        toast.error(result.message ?? "Auto-complete failed.");
      }
      afterServiceMutation();
    });
  }

  // Intercepts 'in_progress' from CrmNextActionsPanel so its Start Service
  // button also sets all three session fields (not just status).
  async function wrappedStatusAction(input: unknown) {
    const typed = input as { bookingId?: string; status?: string } | undefined;
    if (typed?.status === "in_progress" && typed?.bookingId) {
      const result = await crmStartServiceAction({ bookingId: typed.bookingId });
      if (result.success) {
        setSessionOverride({
          status:                  "in_progress",
          booking_progress_status: "session_started",
          session_started_at:      new Date().toISOString(),
        });
      }
      return result;
    }
    const callAction = statusAction ?? updateBookingStatusAction;
    return callAction(input);
  }

  return (
    <aside className="sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-sm)]">
      <SelectedPanelHeader booking={booking} onClose={onClose} />

      <HybridSelectedBookingCard
        booking={{
          id:                      booking.id,
          booking_code:            `#${booking.id.slice(0, 8).toUpperCase()}`,
          customer_name:           customer?.full_name,
          service_name:            service?.name,
          staff_name:              staffName,
          resource_name:           roomLabel,
          booking_date:            booking.booking_date,
          start_time:              booking.start_time,
          end_time:                booking.end_time,
          status:                  effectiveStatus,
          booking_progress_status: effectiveProgressStatus,
          session_started_at:      effectiveSessionStartedAt,
          session_completed_at:    booking.session_completed_at,
          service_duration:        durationMinutes,
          type:                    booking.type,
        }}
        onAutoComplete={isServiceActive ? handleAutoComplete : undefined}
      />

      <div className="mt-4 space-y-3">
        {scheduleException ? (
          <StaffScheduleExceptionPanel
            booking={booking}
            exception={scheduleException}
            onKeepOrResolve={onBookingsChanged}
            onReassign={() => setShowRecommendations(true)}
            onReschedule={() => onOpenReschedule(booking)}
            onContact={() => onOpenFollowup(booking, "confirmed")}
          />
        ) : null}

        {isServiceActive ? (
          <ActiveServiceActionPanel
            onCompleteService={handleCompleteService}
            isCompleting={isCompleting}
          />
        ) : (
          <CrmNextActionsPanel
            booking={booking}
            statusAction={wrappedStatusAction}
            dispatchHref={dispatchHref}
            onOpenFollowup={onOpenFollowup}
            onOpenReschedule={onOpenReschedule}
            onOpenArrival={onOpenArrival}
            onOpenRoomAssignment={onOpenRoomAssignment}
            onBookingsChanged={onBookingsChanged}
          />
        )}

        {!isClosedOperationalBooking(booking) ? (
          <RecommendationSummaryPanel
            booking={booking}
            state={recommendationState}
            expanded={showRecommendations}
            onExpandedChange={setShowRecommendations}
          />
        ) : null}

        <PaymentSummaryPanel
          booking={booking}
          price={price}
          balance={balance}
          paymentAction={paymentAction}
          onBookingsChanged={onBookingsChanged}
          showReview={showPaymentReview}
          onShowReviewChange={setShowPaymentReview}
        />

        {showPaymentReview && isCrmPendingBookingStatus(booking.status) ? (
          <div className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
            <PaymentConfirmationPanel booking={booking} confirmPaymentAction={confirmPaymentAction} />
          </div>
        ) : null}

        <NoteSummaryPanel
          booking={booking}
          note={displayNote}
          canEdit={canEditNote}
          onSaved={(nextNote) => {
            setNoteOverride(nextNote);
            onBookingsChanged?.();
            router.refresh();
          }}
        />

        <FullDetailsDisclosure
          booking={booking}
          branchName={branch?.name ?? null}
          bookingType={isHomeService ? "Home Service" : "In-Spa"}
          source={sourceLabel(booking)}
          addOns={addOns}
        />

        <SelectedMoreActionsPanel
          booking={booking}
          viewerRole={viewerRole}
          statusAction={statusAction}
          paymentAction={paymentAction}
          price={price}
          onOpenCancel={() => onOpenFollowup(booking, "cancel")}
          onOpenReschedule={() => onOpenReschedule(booking)}
          onShowPaymentReview={() => setShowPaymentReview(true)}
          onShowRecommendations={() => setShowRecommendations(true)}
          onBookingsChanged={onBookingsChanged}
        />
      </div>
    </aside>
  );
}

function SelectedPanelHeader({
  booking,
  onClose,
}: {
  booking: WorkspaceBookingRow;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold leading-tight text-[var(--cs-text)]">
          Selected Booking
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-[var(--cs-text-muted)]">
            #{booking.id.slice(0, 8).toUpperCase()}
          </span>
          <OperationalStatusPill booking={booking} />
          <SourcePill booking={booking} />
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close selected booking"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text)] transition-colors hover:bg-[var(--cs-surface-warm)]"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function StaffScheduleExceptionPanel({
  booking,
  exception,
  onKeepOrResolve,
  onReassign,
  onReschedule,
  onContact,
}: {
  booking: WorkspaceBookingRow;
  exception: StaffScheduleException;
  onKeepOrResolve?: () => void;
  onReassign: () => void;
  onReschedule: () => void;
  onContact: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function resolve(
    resolution: "kept_selected_staff" | "marked_resolved"
  ) {
    startTransition(async () => {
      const result = await resolveStaffScheduleExceptionAction({
        bookingId: booking.id,
        resolution,
      });
      if (!result.success) {
        toast.error(result.error ?? "Could not resolve staff review.");
        return;
      }
      toast.success(
        resolution === "kept_selected_staff"
          ? "Selected staff kept."
          : "Staff review resolved."
      );
      onKeepOrResolve?.();
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={17} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-950">
            Staff schedule exception
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-800">
            {exception.reasonLabel}
          </p>
          <p className="mt-2 text-sm leading-5 text-amber-950/80">
            {getStaffScheduleExceptionMessage(
              exception.reasonCode,
              exception.selectedStaffName
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("kept_selected_staff")}
          className="h-9 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          Keep selected staff
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("marked_resolved")}
          className="h-9 rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-900 disabled:opacity-60"
        >
          Mark resolved
        </button>
        <button
          type="button"
          onClick={onReassign}
          className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900"
        >
          Reassign staff
        </button>
        <button
          type="button"
          onClick={onReschedule}
          className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900"
        >
          Adjust booking time
        </button>
        <button
          type="button"
          onClick={onContact}
          className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900"
        >
          Contact customer
        </button>
        <Link
          href={`/crm/schedule?staffId=${encodeURIComponent(exception.selectedStaffId)}&date=${encodeURIComponent(exception.bookingDate)}`}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900"
        >
          Open staff schedule
        </Link>
      </div>
    </section>
  );
}

function ActiveServiceActionPanel({
  onCompleteService,
  isCompleting,
}: {
  onCompleteService: () => void;
  isCompleting: boolean;
}) {
  return (
    <CompactPanel label="Next Best Action">
      <button
        type="button"
        onClick={onCompleteService}
        disabled={isCompleting}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--cs-success)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--cs-success-text)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 size={17} />
        {isCompleting ? "Completing..." : "Complete Service"}
      </button>
    </CompactPanel>
  );
}

function RecommendationSummaryPanel({
  booking,
  state,
  expanded,
  onExpandedChange,
}: {
  booking: WorkspaceBookingRow;
  state: ReturnType<typeof getSelectedBookingRecommendationState>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const label = [
    state.needsTherapist ? "therapist" : null,
    state.needsDriver ? "driver" : null,
  ].filter(Boolean).join(" and ");

  return (
    <CompactPanel label="Staff Assignment">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-[var(--cs-text-secondary)]">
          {state.shouldShow
            ? `Missing ${label || "assignment"} recommendation.`
            : "Change staff while keeping the appointment time."}
        </div>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm font-semibold text-[var(--cs-text)] transition-colors hover:border-[var(--cs-border-strong)]"
          aria-expanded={expanded}
        >
          <ListChecks size={14} />
          {expanded ? "Hide" : state.shouldShow ? "Review" : "Change Staff"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-3 border-t border-[var(--cs-border-soft)] pt-3">
          <BookingRecommendationSection booking={booking} />
        </div>
      ) : null}
    </CompactPanel>
  );
}

function PaymentSummaryPanel({
  booking,
  price,
  balance,
  paymentAction,
  onBookingsChanged,
  showReview,
  onShowReviewChange,
}: {
  booking: WorkspaceBookingRow;
  price: number;
  balance: number;
  paymentAction?: ActionFn;
  onBookingsChanged?: () => void;
  showReview: boolean;
  onShowReviewChange: (show: boolean) => void;
}) {
  const canReviewPending = isCrmPendingBookingStatus(booking.status);

  return (
    <CompactPanel label="Payment">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={booking.payment_status} />
            <PaymentMethodBadge method={booking.payment_method} />
          </div>
          <div className="mt-3 text-sm text-[var(--cs-text-secondary)]">
            Paid {formatCurrency(booking.amount_paid)} <span className="px-1">·</span>
            Balance {formatCurrency(balance)}
          </div>
        </div>
        <div className="text-right">
          {price > 0 ? (
            <div className="text-2xl font-semibold tabular-nums text-[var(--cs-text)]">
              {formatCurrency(price)}
            </div>
          ) : null}
          <div className="mt-2 flex justify-end gap-2">
            {canReviewPending ? (
              <button
                type="button"
                onClick={() => onShowReviewChange(!showReview)}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text)]"
              >
                {showReview ? "Hide" : "Review"}
              </button>
            ) : null}
            <PaymentActionMenu
              bookingId={booking.id}
              paymentStatus={booking.payment_status}
              paymentMethod={booking.payment_method}
              amountPaid={booking.amount_paid}
              pricePaid={price}
              paymentAction={paymentAction}
              onUpdate={onBookingsChanged}
              triggerLabel="Manage"
              triggerVariant="panelSecondary"
            />
          </div>
        </div>
      </div>
    </CompactPanel>
  );
}

function NoteSummaryPanel({
  booking,
  note,
  canEdit,
  onSaved,
}: {
  booking: WorkspaceBookingRow;
  note: string;
  canEdit: boolean;
  onSaved: (note: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasNote = note.trim().length > 0;

  function handleEditStart() {
    setDraft(note);
    setFeedback(null);
    setIsEditing(true);
  }

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const nextNote = draft.trim();
      const result = await editBookingAction({
        bookingId: booking.id,
        notes: nextNote,
      });
      if (!result.success) {
        setFeedback(result.error ?? "Could not save note.");
        return;
      }
      toast.success(nextNote ? "Booking note saved." : "Booking note cleared.");
      onSaved(nextNote);
      setIsEditing(false);
    });
  }

  return (
    <CompactPanel label="Note">
      {isEditing ? (
        <div className="grid gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            disabled={isPending}
            maxLength={500}
            className="min-h-[84px] w-full resize-y rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Booking note"
          />
          {feedback ? (
            <div className="rounded-lg border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] px-3 py-2 text-xs font-semibold text-[var(--cs-error-text)]">
              {feedback}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm font-semibold text-[var(--cs-text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-lg bg-[var(--cs-crm-text)] px-3 text-sm font-semibold text-[var(--cs-text-inverse)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save note"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] text-[var(--cs-text-muted)]">
              <FileText size={16} />
            </span>
            <p className={cn(
              "min-w-0 truncate text-sm",
              hasNote ? "text-[var(--cs-text)]" : "text-[var(--cs-text-muted)]"
            )}>
              {hasNote ? note : "No note added."}
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={handleEditStart}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--cs-success-text)] hover:bg-[var(--cs-success-bg)]"
            >
              <Edit3 size={15} />
              {hasNote ? "Edit note" : "Add note"}
            </button>
          ) : null}
        </div>
      )}
    </CompactPanel>
  );
}

function FullDetailsDisclosure({
  booking,
  branchName,
  bookingType,
  source,
  addOns,
}: {
  booking: WorkspaceBookingRow;
  branchName: string | null;
  bookingType: string;
  source: string;
  addOns: string | null;
}) {
  const rows = [
    { key: "branch", label: "Branch", value: branchName ?? "Branch TBD" },
    { key: "booking_type", label: "Booking Type", value: bookingType },
    { key: "source", label: "Source", value: source },
    { key: "payment_reference", label: "Payment Reference", value: booking.payment_reference ?? "None" },
    { key: "created_at", label: "Created", value: formatDateTimeLabel(booking.created_at) ?? "Not recorded" },
    { key: "updated_at", label: "Updated", value: formatDateTimeLabel(booking.updated_at) ?? "Not recorded" },
    booking.travel_buffer_mins != null && booking.travel_buffer_mins > 0
      ? { key: "travel_buffer", label: "Travel Buffer", value: `+${booking.travel_buffer_mins} min` }
      : null,
    addOns ? { key: "addons", label: "Add-ons", value: addOns } : null,
  ].filter((row): row is { key: string; label: string; value: string } => Boolean(row));

  const visibleRows = rows.filter((row) => shouldShowSelectedBookingFullDetail(row.key));

  return (
    <details className="group rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)] marker:hidden">
        Full Details
        <ChevronDown className="transition-transform group-open:rotate-180" size={16} />
      </summary>
      <div className="grid gap-x-4 gap-y-3 border-t border-[var(--cs-border-soft)] px-3 py-3 sm:grid-cols-2">
        {visibleRows.map((row) => (
          <div key={row.key} className="min-w-0">
            <div className="text-[11px] font-medium text-[var(--cs-text-muted)]">{row.label}</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-[var(--cs-text)]" title={row.value}>
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function SelectedMoreActionsPanel({
  booking,
  viewerRole,
  statusAction,
  paymentAction,
  price,
  onOpenCancel,
  onOpenReschedule,
  onShowPaymentReview,
  onShowRecommendations,
  onBookingsChanged,
}: {
  booking: WorkspaceBookingRow;
  viewerRole: string;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  price: number;
  onOpenCancel: () => void;
  onOpenReschedule: () => void;
  onShowPaymentReview: () => void;
  onShowRecommendations: () => void;
  onBookingsChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const plan = getSelectedBookingActionPlan({
    status: booking.status,
    bookingProgressStatus: booking.booking_progress_status,
    type: booking.type,
    deliveryType: booking.delivery_type,
    resourceId: booking.resource_id,
    hasStaff: Boolean(readFirst(booking.staff)),
    hasDriver: false,
  });
  const cancelAction = plan.overflow.find((action) => action.id === "cancel");

  return (
    <div className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          More Actions
        </span>
        <span className="inline-flex items-center gap-2 text-[var(--cs-text)]">
          <MoreHorizontal size={16} />
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} size={16} />
        </span>
      </button>

      {open ? (
        <div className="divide-y divide-[var(--cs-border-soft)] border-t border-[var(--cs-border-soft)]">
          <button
            type="button"
            onClick={onOpenCancel}
            disabled={cancelAction?.disabled}
            className="flex h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-[var(--cs-error-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} />
            Cancel Booking
          </button>
          <div className="px-3 py-2">
            <BookingActionMenu
              bookingId={booking.id}
              currentStatus={booking.status}
              userRole={viewerRole}
              statusAction={statusAction}
              actionScope="status"
              triggerLabel="Change Status"
              triggerVariant="panelSecondary"
              fullWidth
              emptyBehavior="disabled"
              onUpdate={onBookingsChanged}
            />
          </div>
          <button
            type="button"
            onClick={onOpenReschedule}
            disabled={isClosedOperationalBooking(booking)}
            className="flex h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarClock size={16} />
            Reschedule Booking
          </button>
          <button
            type="button"
            onClick={onShowRecommendations}
            className="flex h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-[var(--cs-text)]"
          >
            <RotateCcw size={16} />
            Change Staff
          </button>
          <div className="px-3 py-2">
            <PaymentActionMenu
              bookingId={booking.id}
              paymentStatus={booking.payment_status}
              paymentMethod={booking.payment_method}
              amountPaid={booking.amount_paid}
              pricePaid={price}
              paymentAction={paymentAction}
              triggerLabel="Take Payment"
              triggerVariant="panelSecondary"
              fullWidth
              onUpdate={onBookingsChanged}
            />
          </div>
          {isCrmPendingBookingStatus(booking.status) ? (
            <button
              type="button"
              onClick={onShowPaymentReview}
              className="flex h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-[var(--cs-text)]"
            >
              <CreditCard size={16} />
              Review Payment Confirmation
            </button>
          ) : null}
          <button
            type="button"
            disabled
            className="flex h-12 w-full cursor-not-allowed items-center gap-3 px-3 text-left text-sm font-semibold text-[var(--cs-text-muted)] opacity-60"
          >
            <FileText size={16} />
            View Audit Log
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CompactPanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {label}
      </div>
      {children}
    </section>
  );
}

function formatDateTimeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BookingRecommendationSection({
  booking,
}: {
  booking: WorkspaceBookingRow;
}) {
  const router = useRouter();
  const isHomeService = Boolean(
    booking.type === "home_service" ||
    (booking.metadata && (booking.metadata.delivery_type === "home_service" || booking.metadata.type === "home_service"))
  );
  const staff = readFirst(booking.staff);
  const isClosed = isClosedOperationalBooking(booking);

  if (isClosed) return null;

  return (
    <div>
      <AssignmentRecommendationPanel
        key={booking.id}
        bookingId={booking.id}
        fetchRecommendations={getAssignmentRecommendationsAction}
        onAssignTherapist={async (therapistId, overrideReason) => {
          const result = await assignBookingTherapistAction({
            bookingId: booking.id,
            staffId: therapistId,
            overrideReason,
          });
          if (!result.success) {
            toast.error(result.error ?? "Could not assign therapist.");
            return;
          }
          toast.success("Therapist assigned.");
          router.refresh();
        }}
        onAssignDriver={async (driverId) => {
          await assignBookingDriverAction({ bookingId: booking.id, driverId });
          router.refresh();
        }}
        currentTherapistId={staff?.id ?? null}
        currentDriverId={null}
        showTherapists
        showDrivers={isHomeService}
      />
    </div>
  );
}

export function CrmNextActionsPanel({
  booking,
  statusAction,
  dispatchHref,
  onOpenFollowup,
  onOpenReschedule,
  onOpenArrival,
  onOpenRoomAssignment,
  onBookingsChanged,
  isServiceActionPending = false,
}: {
  booking: WorkspaceBookingRow;
  statusAction?: ActionFn;
  dispatchHref?: string;
  onOpenFollowup: (booking: WorkspaceBookingRow, initialResult: BookingFollowupResult) => void;
  onOpenReschedule: (booking: WorkspaceBookingRow) => void;
  onOpenArrival: (booking: WorkspaceBookingRow) => void;
  onOpenRoomAssignment: (booking: WorkspaceBookingRow) => void;
  onBookingsChanged?: () => void;
  isServiceActionPending?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const actionPlan = getSelectedBookingActionPlan({
    status: booking.status,
    bookingProgressStatus: booking.booking_progress_status,
    type: booking.type,
    deliveryType: booking.delivery_type,
    resourceId: booking.resource_id,
    hasStaff: Boolean(readFirst(booking.staff)),
    hasDriver: false,
    hasDispatchHref: Boolean(dispatchHref),
  });

  function afterMutation() {
    onBookingsChanged?.();
    router.refresh();
  }

  function handleStatus(status: "in_progress" | "completed") {
    setFeedback(null);
    startTransition(async () => {
      const callAction = statusAction ?? updateBookingStatusAction;
      const result = await callAction({ bookingId: booking.id, status });
      if (!result.success) {
        setFeedback(result.error ?? "Could not update booking.");
        return;
      }
      toast.success(status === "in_progress" ? "Service started." : "Service completed.");
      afterMutation();
    });
  }

  async function handleCopyMessage() {
    const customer = readFirst(booking.customers);
    const service = readFirst(booking.services);
    const branch = readFirst(booking.branches);
    const message = [
      `Hi ${customer?.full_name ?? "there"}, this is CradleHub confirming your booking.`,
      `Service: ${service?.name ?? "your selected service"}.`,
      `Schedule: ${new Date(`${booking.booking_date}T00:00:00`).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
      })} at ${formatTime(booking.start_time)}.`,
      branch?.name ? `Branch: ${branch.name}.` : null,
      "Please reply to confirm or let us know if you need to reschedule.",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      await navigator.clipboard.writeText(message);
      setFeedback("Confirmation message copied.");
    } catch {
      setFeedback("Could not copy message. Please copy it manually from the booking details.");
    }
  }

  function handleKeepWaiting() {
    const customer = readFirst(booking.customers);
    const name = customer?.full_name ?? "Customer";
    setFeedback(`${name} remains in waiting until a room is ready.`);
    toast.message("Guest kept in waiting queue.");
  }

  function runAction(actionId: SelectedBookingActionId) {
    switch (actionId) {
      case "confirm":
      case "call":
        onOpenFollowup(booking, "confirmed");
        return;
      case "copy_message":
        void handleCopyMessage();
        return;
      case "no_answer":
        onOpenFollowup(booking, "no_answer");
        return;
      case "reschedule":
        onOpenReschedule(booking);
        return;
      case "mark_arrived":
        onOpenArrival(booking);
        return;
      case "assign_room":
      case "change_room":
        onOpenRoomAssignment(booking);
        return;
      case "keep_waiting":
        handleKeepWaiting();
        return;
      case "start_service":
        handleStatus("in_progress");
        return;
      case "open_dispatch":
      case "track_dispatch":
        if (dispatchHref) router.push(dispatchHref);
        return;
      case "review_record":
        setFeedback("Booking record is open.");
        return;
    }
  }

  const primary = actionPlan.primary;
  const secondary = actionPlan.secondary;
  if (!primary && secondary.length === 0 && !feedback) return null;

  return (
    <CompactPanel label="Next Best Action">
      {primary ? (
        <NextActionButton
          action={primary}
          icon={getSelectedActionIcon(primary.id)}
          disabled={isPending || (primary.id === "start_service" && isServiceActionPending)}
          onClick={() => runAction(primary.id)}
        />
      ) : null}

      {secondary.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {secondary.map((action) => (
            <NextActionButton
              key={action.id}
              action={action}
              icon={getSelectedActionIcon(action.id)}
              disabled={isPending}
              onClick={() => runAction(action.id)}
            />
          ))}
        </div>
      ) : null}

      {feedback ? (
        <div className={cn(
          "mt-3 rounded-xl border px-3 py-2 text-xs font-semibold",
          feedback.includes("Could not")
            ? "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]"
            : "border-[var(--cs-sand-mist)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]"
        )}>
          {feedback}
        </div>
      ) : null}
    </CompactPanel>
  );
}

function NextActionButton({
  action,
  icon,
  onClick,
  disabled,
}: {
  action: SelectedBookingAction;
  icon: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        void onClick();
      }}
      className={cn(
        "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        action.tone === "primary"
          ? "min-h-12 border-[var(--cs-success-text)] bg-[var(--cs-success-text)] text-white shadow-[var(--cs-shadow-xs)] hover:bg-[var(--cs-crm-text)]"
          : null,
        action.tone === "secondary"
          ? "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)]"
          : null
      )}
    >
      {icon}
      {action.label}
    </button>
  );
}

function getSelectedActionIcon(actionId: SelectedBookingActionId): React.ReactNode {
  switch (actionId) {
    case "confirm":
    case "mark_arrived":
    case "start_service":
    case "review_record":
      return <CheckCircle2 size={15} />;
    case "call":
      return <Phone size={15} />;
    case "copy_message":
      return <Copy size={15} />;
    case "no_answer":
      return <UserX size={15} />;
    case "reschedule":
    case "keep_waiting":
      return <CalendarClock size={15} />;
    case "assign_room":
    case "change_room":
      return <DoorOpen size={15} />;
    case "open_dispatch":
    case "track_dispatch":
      return <Home size={15} />;
  }
}

const CONFIRM_PAYMENT_METHODS = [
  { value: "cash",  label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya",  label: "Maya" },
  { value: "card",  label: "Card" },
  { value: "other", label: "Other" },
] as const;

function PaymentConfirmationPanel({
  booking,
  confirmPaymentAction,
}: {
  booking: WorkspaceBookingRow;
  confirmPaymentAction?: ActionFn;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const now = new Date();
  const holdExpired =
    !booking.hold_expires_at ||
    new Date(booking.hold_expires_at).getTime() <= now.getTime();

  const holdExpiresLabel = (() => {
    if (!booking.hold_expires_at) return null;
    const exp = new Date(booking.hold_expires_at);
    if (exp.getTime() <= now.getTime()) return "Hold expired";
    return `Hold active until ${exp.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`;
  })();

  function handleConfirm() {
    if (!confirmPaymentAction) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await confirmPaymentAction({
        bookingId:        booking.id,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        note:             note.trim() || undefined,
      });
      if (result.success) {
        setFeedback({ ok: true, message: "Payment confirmed. Booking is now active." });
        router.refresh();
      } else {
        setFeedback({ ok: false, message: result.error ?? "Failed to confirm payment." });
      }
    });
  }

  return (
    <div className={cn(
      "rounded-lg border bg-[var(--cs-surface)] p-3",
      holdExpired ? "border-[var(--cs-error-bg)]" : "border-[var(--cs-sand-mist)]"
    )}>
      <div className="flex items-start gap-2">
        <span className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          holdExpired ? "bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]" : "bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]"
        )}>
          <ReceiptText size={15} />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Payment Confirmation
          </div>
          {holdExpiresLabel ? (
            <div className={cn(
              "mt-1 text-xs font-semibold",
              holdExpired ? "text-[var(--cs-error-text)]" : "text-[var(--cs-sand-dark)]"
            )}>
              {holdExpiresLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="grid gap-1 text-xs font-medium text-[var(--cs-text-muted)]">
          Payment method
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={isPending}
            className={confirmControlClass}
          >
            {CONFIRM_PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-medium text-[var(--cs-text-muted)]">
          <span>Reference / receipt no. <span className="font-normal opacity-70">(optional)</span></span>
          <input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. GCash ref #"
            disabled={isPending}
            className={confirmControlClass}
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-[var(--cs-text-muted)]">
          <span>Note <span className="font-normal opacity-70">(optional)</span></span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Internal note..."
            disabled={isPending}
            className={cn(confirmControlClass, "h-auto min-h-[70px] resize-y py-2")}
          />
        </label>

        {feedback ? (
          <div className={cn(
            "rounded-xl border px-3 py-2 text-xs font-semibold",
            feedback.ok
              ? "border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]"
              : "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]"
          )}>
            {feedback.message}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || !confirmPaymentAction || feedback?.ok === true}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--cs-crm-text)] bg-[var(--cs-crm-text)] px-3 text-sm font-semibold text-[var(--cs-text-inverse)] transition-colors hover:bg-[var(--cs-success-text)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Confirming..." : "Confirm payment & finalize booking"}
        </button>
      </div>
    </div>
  );
}

const confirmControlClass =
  "h-9 w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60";
