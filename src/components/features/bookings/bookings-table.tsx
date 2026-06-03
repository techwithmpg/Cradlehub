"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  DoorOpen,
  Home,
  MapPin,
  Phone,
  Play,
  ReceiptText,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentStatusBadge } from "@/components/features/dashboard/payment-status-badge";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { cn, formatTime, formatCurrency } from "@/lib/utils";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { getAssignmentRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import { updateBookingStatusAction } from "@/app/(dashboard)/manager/bookings/actions";
import { crmStartServiceAction, crmCompleteServiceAction } from "@/app/(dashboard)/crm/bookings/actions";
import { autoCompleteDueSessionAction } from "@/app/(dashboard)/staff-portal/actions";
import { isCrmPendingBookingStatus, isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";
import { BookingFollowupModal, type BookingFollowupResult } from "./booking-followup-modal";
import { CustomerArrivedModal } from "./customer-arrived-modal";
import { RoomAssignmentModal } from "./room-assignment-modal";
import { HybridSelectedBookingCard } from "./hybrid-selected-booking-card";
import type { WorkspaceBookingRow } from "./bookings-workspace";

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

function formatLongBookingDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

function sourceLabel(booking: WorkspaceBookingRow): string {
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
  | null;

export function BookingsTable({
  bookings,
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
  const selected =
    selectedId === NO_SELECTION
      ? null
      : pageBookings.find((booking) => booking.id === selectedId) ?? pageBookings[0] ?? null;
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
        description={
          search
            ? "No bookings match your search."
            : "No bookings match the selected filters."
        }
        icon="Bookings"
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
        .bw-row-selected .bw-td { background: var(--cs-sand-tint); }
        .bw-row-selected .bw-td:first-child { box-shadow: inset 4px 0 0 var(--cs-sand); }
        .bw-row:last-child .bw-td { border-bottom: none; }
        .bw-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bw-col-customer { width: 190px; }
        .bw-col-service { width: 190px; }
        .bw-col-time { width: 106px; }
        .bw-col-source { width: 118px; }
        .bw-col-status { width: 128px; }
        .bw-col-payment { width: 104px; }
        .bw-col-amount { width: 98px; }
        .bw-col-next { width: 140px; }
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
          .bw-col-source, .bw-col-amount { display: none; }
        }
        @media (max-width: 760px) {
          .bw-table-wrap { display: none; }
          .bw-mobile-list { display: grid; }
          .bw-pagination { align-items: stretch; }
          .bw-page-controls { width: 100%; justify-content: flex-start; }
        }
      `}</style>

      <div className="bw-shell grid grid-cols-[minmax(0,1fr)_360px] items-start gap-4">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-sm)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--cs-text)]">Booking List</div>
              <div className="text-xs text-[var(--cs-text-muted)]">Select a row to guide the next front-desk action.</div>
            </div>
            <div className="rounded-full bg-[var(--cs-surface)] px-3 py-1 text-xs font-semibold text-[var(--cs-text-muted)]">
              {filtered.length} total
            </div>
          </div>

          <div className="bw-table-wrap overflow-x-auto">
          <table className="bw-table">
            <thead>
              <tr>
                <th className="bw-th bw-col-customer">Customer</th>
                <th className="bw-th bw-col-service">Service</th>
                <th className="bw-th bw-col-time">Time</th>
                <th className="bw-th bw-col-source">Source/Type</th>
                <th className="bw-th bw-col-status">Status</th>
                <th className="bw-th bw-col-payment">Payment</th>
                <th className="bw-th bw-col-amount">Amount</th>
                <th className="bw-th bw-col-next">Next Action</th>
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
                const price = readPricePaid(booking.metadata);
                const isSelected = booking.id === selected?.id;
                const shortId = booking.id.slice(0, 8).toUpperCase();
                const nextAction = getNextActionLabel(booking);

                return (
                  <tr
                    key={booking.id}
                    className={`bw-row${isSelected ? " bw-row-selected" : ""}`}
                    onClick={() => setSelectedId(booking.id)}
                    aria-selected={isSelected}
                  >
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
                      <div
                        className="bw-truncate text-[11px] text-[var(--cs-text-muted)]"
                        title={[staffName, resource?.name].filter(Boolean).join(" / ")}
                      >
                        {staffName}
                        {resource ? ` / ${resource.name}` : ""}
                      </div>
                    </td>

                    <td className="bw-td bw-col-time">
                      <div className="text-sm font-semibold text-[var(--cs-text)]">
                        {formatTime(booking.start_time)}
                      </div>
                      <div className="text-[11px] text-[var(--cs-text-muted)]">
                        {formatBookingDate(booking.booking_date)}
                      </div>
                    </td>

                    <td className="bw-td bw-col-source">
                      <SourcePill booking={booking} />
                    </td>

                    <td className="bw-td bw-col-status">
                      <OperationalStatusPill booking={booking} />
                    </td>

                    <td className="bw-td bw-col-payment">
                      <PaymentStatusBadge status={booking.payment_status} />
                    </td>

                    <td className="bw-td bw-col-amount">
                      {price > 0 ? (
                        <span className="whitespace-nowrap text-[0.8125rem] font-semibold text-[var(--cs-text)]">
                          {formatCurrency(price)}
                        </span>
                      ) : (
                        <span className="text-[var(--cs-text-muted)]">-</span>
                      )}
                    </td>

                    <td className="bw-td bw-col-next">
                      <span className="inline-flex rounded-full bg-[var(--cs-sand-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cs-sand-dark)]">
                        {nextAction}
                      </span>
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
                    "rounded-2xl border bg-[var(--cs-surface)] p-3 text-left shadow-[var(--cs-shadow-xs)]",
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
        </div>

        <div className="bw-panel">
          {selected ? (
            <BookingDetailsPanel
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
              onOpenArrival={(booking) => setModalState({ type: "arrival", booking })}
              onOpenRoomAssignment={(booking) => setModalState({ type: "room", booking })}
              onBookingsChanged={handleBookingsChanged}
            />
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-5">
              <span className="text-sm text-[var(--cs-text-muted)]">Select a booking to view details.</span>
            </div>
          )}
        </div>
      </div>

      <BookingFollowupModal
        key={modalState?.type === "followup" ? `${modalState.booking.id}-${modalState.initialResult}` : "followup-closed"}
        open={modalState?.type === "followup"}
        booking={modalState?.type === "followup" ? modalState.booking : null}
        initialResult={modalState?.type === "followup" ? modalState.initialResult : "confirmed"}
        cancelBookingAction={statusAction}
        onOpenChange={(open) => {
          if (!open) setModalState(null);
        }}
        onSuccess={handleBookingsChanged}
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
  onOpenArrival: (booking: WorkspaceBookingRow) => void;
  onOpenRoomAssignment: (booking: WorkspaceBookingRow) => void;
  onBookingsChanged?: () => void;
}) {
  const router = useRouter();
  const [isStarting,   startStartTransition]    = useTransition();
  const [isCompleting, startCompleteTransition] = useTransition();

  const customer = readFirst(booking.customers);
  const service  = readFirst(booking.services);
  const staff    = readFirst(booking.staff);
  const staffName = staff ? getStaffAdminName(staff) : "Unassigned";
  const branch   = readFirst(booking.branches);
  const resource = readFirst(booking.branch_resources);
  const price    = readPricePaid(booking.metadata);
  const balance  = price > 0 ? Math.max(0, price - booking.amount_paid) : 0;
  const notes    = (booking.metadata as Record<string, unknown> | null)?.["customer_notes"];
  const durationMinutes = service?.duration_minutes;
  const addOns   = readAddOns(booking.metadata);
  const isHomeService = isHomeServiceBooking(booking);
  const roomLabel = resource?.name ?? (isHomeService ? "Home service" : "Room TBD");
  const operationalStatus = getOperationalStatus(booking);

  // ── Service state guards ──────────────────────────────────────────────────
  const progress = booking.booking_progress_status ?? null;

  // Active service requires BOTH a status flag AND session_started_at.
  // A booking updated via the old updateBookingStatusAction only had
  // status = 'in_progress' without session_started_at, causing the card to
  // show "Complete Service" with no countdown. Requiring the timestamp here
  // ensures the countdown and Complete button only appear after a proper
  // RPC-based service start (which sets all three fields atomically).
  const isServiceActive = (
    booking.status === "in_progress" ||
    progress === "session_started"
  ) && Boolean(booking.session_started_at);

  // Eligible for Start Service: any confirmed in-spa booking that hasn't
  // started a session yet. Broader than the old "checked_in + room" check.
  const isPendingConfirmation = isCrmPendingBookingStatus(booking.status);
  const isClosed = isBookingClosedForCrm(booking.status) ||
    booking.status === "completed" ||
    booking.status === "no_show";
  const canStartService =
    !isHomeService &&
    !isServiceActive &&
    !isPendingConfirmation &&
    !isClosed &&
    (booking.status === "confirmed" || booking.status === "in_progress");

  // ── Mutation helpers ──────────────────────────────────────────────────────

  function afterServiceMutation() {
    onBookingsChanged?.();
    router.refresh();
  }

  // Uses the RPC action so booking_progress_status + session_started_at are
  // set atomically alongside status = 'in_progress'.
  function handleStartService() {
    startStartTransition(async () => {
      const result = await crmStartServiceAction({ bookingId: booking.id });
      if (!result.success) {
        toast.error(result.error ?? "Could not start service.");
        return;
      }
      toast.success("Service started.");
      afterServiceMutation();
    });
  }

  // Uses the RPC action so booking_progress_status + session_completed_at are
  // set atomically alongside status = 'completed'.
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
  // autoCompleteDueSessionAction re-validates on the server before completing.
  function handleAutoComplete() {
    startCompleteTransition(async () => {
      const result = await autoCompleteDueSessionAction(booking.id);
      if (result.ok) {
        toast.success("Service auto-completed.");
        afterServiceMutation();
      }
      // If already completed (idempotent), silently refresh.
      if (!result.ok && result.code !== "ALREADY_COMPLETED") {
        toast.error(result.message ?? "Auto-complete failed.");
      }
      afterServiceMutation();
    });
  }

  // Wrapped statusAction for CrmNextActionsPanel: intercepts 'in_progress' and
  // routes it through the RPC-based action so session_started_at is always set.
  async function wrappedStatusAction(input: unknown) {
    const typed = input as { bookingId?: string; status?: string } | undefined;
    if (typed?.status === "in_progress" && typed?.bookingId) {
      return crmStartServiceAction({ bookingId: typed.bookingId });
    }
    const callAction = statusAction ?? updateBookingStatusAction;
    return callAction(input);
  }

  return (
    <aside className="sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto rounded-3xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-sm)]">
      {/* Panel title row */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Selected Booking
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--cs-text-muted)]">
            #{booking.id.slice(0, 8).toUpperCase()}
          </div>
        </div>
        {/* Status pills next to the ID */}
        <div className="flex items-center gap-2">
          <OperationalStatusPill booking={booking} />
          <SourcePill booking={booking} />
        </div>
      </div>

      {/* Hybrid card replaces the old hero card + ServiceCountdownChip.
          Key changes when session_started_at changes so hasAutoCompletedRef resets. */}
      <HybridSelectedBookingCard
        key={`${booking.id}-${booking.session_started_at ?? "none"}`}
        booking={{
          id:                      booking.id,
          booking_code:            `#${booking.id.slice(0, 8).toUpperCase()}`,
          customer_name:           customer?.full_name,
          service_name:            service?.name,
          staff_name:              staffName,
          resource_name:           resource?.name,
          start_time:              booking.start_time,
          end_time:                booking.end_time,
          status:                  booking.status,
          booking_progress_status: booking.booking_progress_status,
          session_started_at:      booking.session_started_at,
          session_completed_at:    booking.session_completed_at,
          service_duration:        durationMinutes,
          type:                    booking.type,
        }}
        onClose={onClose}
        onStartService={canStartService ? handleStartService : undefined}
        onCompleteService={isServiceActive ? handleCompleteService : undefined}
        onAutoComplete={isServiceActive ? handleAutoComplete : undefined}
        isStarting={isStarting}
        isCompleting={isCompleting}
      />

      <div className="mt-4 space-y-4">
        {/* CrmNextActionsPanel handles all pre-service workflow (check-in,
            arrival, dispatch, room assignment, follow-up, etc.).
            When service is active, the hybrid card owns Complete Service
            to avoid duplicate buttons. wrappedStatusAction intercepts the
            'in_progress' path so CrmNextActionsPanel's Start Service button
            (for checked-in + room states) also calls the RPC correctly. */}
        {!isServiceActive ? (
          <CrmNextActionsPanel
            booking={booking}
            statusAction={wrappedStatusAction}
            dispatchHref={dispatchHref}
            onOpenFollowup={onOpenFollowup}
            onOpenArrival={onOpenArrival}
            onOpenRoomAssignment={onOpenRoomAssignment}
            onBookingsChanged={onBookingsChanged}
          />
        ) : null}


        <PanelSection label="Booking Details">
          <PanelRow
            label="Date"
            value={formatLongBookingDate(booking.booking_date)}
          />
          <PanelRow label="Time" value={formatTime(booking.start_time)} />
          {durationMinutes != null ? <PanelRow label="Duration" value={`${durationMinutes} min`} /> : null}
          <PanelRow label="Service" value={service?.name ?? "Service"} />
          <PanelRow label="Staff/Therapist" value={staffName} />
          <PanelRow label="Source" value={sourceLabel(booking)} />
          <PanelRow label="Room/Bed" value={roomLabel} />
          {branch ? <PanelRow label="Branch" value={branch.name} /> : null}
          {addOns ? <PanelRow label="Add-ons" value={addOns} /> : null}
          {booking.travel_buffer_mins != null && booking.travel_buffer_mins > 0 ? (
            <PanelRow label="Travel buffer" value={`+${booking.travel_buffer_mins} min`} />
          ) : null}
        </PanelSection>

        <PanelSection label="Payment / Confirmation">
          <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={booking.payment_status} />
                <PaymentMethodBadge method={booking.payment_method} />
              </div>
              {price > 0 ? (
                <span className="text-sm font-semibold text-[var(--cs-text)]">{formatCurrency(price)}</span>
              ) : null}
            </div>
            {price > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[var(--cs-surface)] px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">Paid</div>
                  <div className="mt-1 font-semibold text-[var(--cs-text)]">{formatCurrency(booking.amount_paid)}</div>
                </div>
                <div className="rounded-xl bg-[var(--cs-surface)] px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">Balance</div>
                  <div className={cn("mt-1 font-semibold", balance > 0 ? "text-[var(--cs-error-text)]" : "text-[var(--cs-success-text)]")}>
                    {formatCurrency(balance)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {isCrmPendingBookingStatus(booking.status) ? (
            <PaymentConfirmationPanel booking={booking} confirmPaymentAction={confirmPaymentAction} />
          ) : null}
        </PanelSection>

        {typeof notes === "string" && notes.trim() ? (
          <PanelSection label="Notes">
            <p className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3 text-sm leading-6 text-[var(--cs-text-secondary)]">
              {notes}
            </p>
          </PanelSection>
        ) : null}

        {operationalStatus.tone !== "completed" ? (
          <BookingRecommendationSection booking={booking} />
        ) : null}

        <PanelSection label="More Actions">
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <BookingActionMenu
                bookingId={booking.id}
                currentStatus={booking.status}
                userRole={viewerRole}
                statusAction={statusAction}
                actionScope="status"
                triggerLabel="More Status"
                triggerVariant="panelSecondary"
                fullWidth
                emptyBehavior="disabled"
              />
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
              />
            </div>

            {!isClosedOperationalBooking(booking) ? (
              <BookingActionMenu
                bookingId={booking.id}
                currentStatus={booking.status}
                userRole={viewerRole}
                statusAction={statusAction}
                actionScope="cancel"
                triggerLabel="Cancel Booking"
                triggerVariant="panelDanger"
                fullWidth
              />
            ) : null}
          </div>
        </PanelSection>
      </div>
    </aside>
  );
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
  const needsTherapist = !staff;
  const needsDriver = isHomeService;

  if (!needsTherapist && !needsDriver) return null;

  return (
    <div>
      <AssignmentRecommendationPanel
        bookingId={booking.id}
        fetchRecommendations={getAssignmentRecommendationsAction}
        onAssignDriver={async (driverId) => {
          await assignBookingDriverAction({ bookingId: booking.id, driverId });
          router.refresh();
        }}
        currentTherapistId={staff?.id ?? null}
        currentDriverId={null}
        showTherapists={needsTherapist}
        showDrivers={needsDriver}
      />
      <div className="mt-2 text-center text-[10px] text-[var(--cs-text-muted)]">
        Recommendation only. Use existing booking controls to confirm assignment.
      </div>
    </div>
  );
}

function CrmNextActionsPanel({
  booking,
  statusAction,
  dispatchHref,
  onOpenFollowup,
  onOpenArrival,
  onOpenRoomAssignment,
  onBookingsChanged,
}: {
  booking: WorkspaceBookingRow;
  statusAction?: ActionFn;
  dispatchHref?: string;
  onOpenFollowup: (booking: WorkspaceBookingRow, initialResult: BookingFollowupResult) => void;
  onOpenArrival: (booking: WorkspaceBookingRow) => void;
  onOpenRoomAssignment: (booking: WorkspaceBookingRow) => void;
  onBookingsChanged?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const isHomeService = isHomeServiceBooking(booking);
  const progress = booking.booking_progress_status ?? null;
  const isClosed = isClosedOperationalBooking(booking);
  const isPendingConfirmation = isCrmPendingBookingStatus(booking.status);
  const isConfirmedInSpa =
    !isHomeService &&
    booking.status === "confirmed" &&
    isNotStartedProgress(progress);
  const isConfirmedHomeService =
    isHomeService &&
    booking.status === "confirmed" &&
    isNotStartedProgress(progress);
  const isHomeServiceTravel = isHomeService && (progress === "travel_started" || progress === "arrived");
  const isWaitingArrived = progress === "checked_in";
  const isInService = booking.status === "in_progress" || progress === "session_started";
  const resourceAssigned = Boolean(booking.resource_id);

  if (isClosed) return null;

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

  const actions: React.ReactNode[] = [];

  if (isPendingConfirmation) {
    actions.push(
      <NextActionButton key="call" tone="secondary" icon={<Phone size={14} />} onClick={() => onOpenFollowup(booking, "confirmed")}>
        Call Customer
      </NextActionButton>,
      <NextActionButton key="copy" tone="secondary" icon={<Copy size={14} />} onClick={handleCopyMessage}>
        Copy Message
      </NextActionButton>,
      <NextActionButton key="confirmed" icon={<CheckCircle2 size={14} />} onClick={() => onOpenFollowup(booking, "confirmed")}>
        Mark Booking Confirmed
      </NextActionButton>,
      <NextActionButton key="no-answer" tone="secondary" icon={<UserX size={14} />} onClick={() => onOpenFollowup(booking, "no_answer")}>
        No Answer
      </NextActionButton>,
      <NextActionButton key="reschedule" tone="secondary" icon={<CalendarClock size={14} />} onClick={() => onOpenFollowup(booking, "reschedule")}>
        Reschedule
      </NextActionButton>,
      <NextActionButton key="cancel" tone="danger" icon={<UserX size={14} />} onClick={() => onOpenFollowup(booking, "cancel")}>
        Cancel Booking
      </NextActionButton>
    );
  } else if (isConfirmedInSpa) {
    actions.push(
      <NextActionButton key="arrived" icon={<CheckCircle2 size={14} />} onClick={() => onOpenArrival(booking)}>
        Customer Arrived
      </NextActionButton>
    );
  } else if (isConfirmedHomeService && dispatchHref) {
    actions.push(
      <NextActionButton key="dispatch" icon={<Home size={14} />} onClick={() => router.push(dispatchHref)}>
        Open Dispatch
      </NextActionButton>
    );
  } else if (isHomeServiceTravel && dispatchHref) {
    actions.push(
      <NextActionButton key="track-dispatch" icon={<Home size={14} />} onClick={() => router.push(dispatchHref)}>
        Track Dispatch
      </NextActionButton>
    );
  } else if (isWaitingArrived && !isHomeService) {
    actions.push(
      <NextActionButton key="room" tone={resourceAssigned ? "secondary" : "primary"} icon={<DoorOpen size={14} />} onClick={() => onOpenRoomAssignment(booking)}>
        {resourceAssigned ? "Change Room" : "Assign Room"}
      </NextActionButton>
    );

    if (resourceAssigned) {
      actions.push(
        <NextActionButton
          key="start"
          icon={<Play size={14} />}
          disabled={isPending}
          onClick={() => handleStatus("in_progress")}
        >
          {isPending ? "Starting..." : "Start Service"}
        </NextActionButton>
      );
    } else {
      actions.push(
        <NextActionButton key="waiting" tone="secondary" icon={<CalendarClock size={14} />} onClick={handleKeepWaiting}>
          Keep Waiting
        </NextActionButton>
      );
    }
  } else if (isInService) {
    actions.push(
      <NextActionButton
        key="complete"
        icon={<CheckCircle2 size={14} />}
        disabled={isPending}
        onClick={() => handleStatus("completed")}
      >
        {isPending ? "Completing..." : "Complete Service"}
      </NextActionButton>
    );
  }

  if (actions.length === 0 && !feedback) return null;

  return (
    <PanelSection label="Next Best Action">
      {actions.length > 0 ? (
        <div className="grid gap-2">{actions}</div>
      ) : null}
      {feedback ? (
        <div className={cn(
          "rounded-xl border px-3 py-2 text-xs font-semibold",
          feedback.includes("Could not")
            ? "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]"
            : "border-[var(--cs-sand-mist)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]"
        )}>
          {feedback}
        </div>
      ) : null}
    </PanelSection>
  );
}

function NextActionButton({
  children,
  icon,
  onClick,
  tone = "primary",
  disabled,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void | Promise<void>;
  tone?: "primary" | "secondary" | "danger";
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
        tone === "primary"
          ? "border-[var(--cs-crm-text)] bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)] hover:bg-[var(--cs-success-text)]"
          : null,
        tone === "secondary"
          ? "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)]"
          : null,
        tone === "danger"
          ? "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] text-[var(--cs-error-text)] hover:border-[var(--cs-error-text)]"
          : null
      )}
    >
      {icon}
      {children}
    </button>
  );
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
      "rounded-2xl border bg-[var(--cs-surface)] p-3",
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

function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {label}
      </div>
      <div className="grid gap-2">
        {children}
      </div>
    </section>
  );
}

function PanelRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-2">
      <span className="shrink-0 text-[0.8125rem] text-[var(--cs-text-muted)]">{label}</span>
      <span className={cn(
        "min-w-0 text-right text-[0.8125rem]",
        danger ? "font-semibold text-[var(--cs-error-text)]" : "font-medium text-[var(--cs-text)]"
      )}>
        {value}
      </span>
    </div>
  );
}
