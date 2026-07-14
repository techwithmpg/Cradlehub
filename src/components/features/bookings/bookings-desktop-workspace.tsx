"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingsListToolbar } from "./bookings-list-toolbar";
import { BookingsQuickFilters } from "./bookings-quick-filters";
import { BookingsDesktopList } from "./bookings-desktop-list";
import { SelectedBookingCommandPane } from "./selected-booking-command-pane";
import { BookingsModalStack, type BookingModalState } from "./bookings-modal-stack";
import type { BookingActionFn, Branch, WorkspaceBookingRow, WorkspaceContext } from "./booking-workspace-types";
import type { BookingQuickFilter } from "@/lib/bookings/bookings-workspace-filters";
import { applyBookingListFilters } from "@/lib/bookings/booking-list-exact-filters";
import { bookingMatchesQuickFilter } from "@/lib/bookings/bookings-workspace-filters";
import { firstBookingRelation } from "@/lib/bookings/booking-display";
import { getStaffAdminName } from "@/lib/staff/display-name";

const NO_SELECTION = "__no_booking_selected__";

function searchBookings(bookings: WorkspaceBookingRow[], search?: string): WorkspaceBookingRow[] {
  const term = search?.trim().toLowerCase();
  if (!term) return bookings;
  return bookings.filter((booking) => {
    const customer = firstBookingRelation(booking.customers);
    const staff = firstBookingRelation(booking.staff);
    const service = firstBookingRelation(booking.services);
    return [booking.id, customer?.full_name, customer?.phone, staff ? getStaffAdminName(staff) : null, service?.name]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(term));
  });
}

function replaceSelectionQuery(bookingId: string | null) {
  const params = new URLSearchParams(window.location.search);
  params.delete("highlight");
  if (bookingId) params.set("bookingId", bookingId);
  else params.delete("bookingId");
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

type DesktopWorkspaceProps = {
  workspaceContext: WorkspaceContext;
  viewerRole: string;
  branches?: Branch[];
  date: string;
  statusFilter?: string;
  sourceFilter?: string;
  deliveryFilter?: string;
  paymentFilter?: string;
  assignmentFilter?: string;
  branchFilter?: string;
  search?: string;
  initialQuickFilter: BookingQuickFilter;
  initialPage?: number;
  bookings: WorkspaceBookingRow[];
  statusAction?: BookingActionFn;
  paymentAction?: BookingActionFn;
  initialSelectedId?: string;
  confirmPaymentAction?: BookingActionFn;
  onBookingsChanged?: () => void;
};

export function BookingsDesktopWorkspace(props: DesktopWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quickFilter, setQuickFilter] = useState(props.initialQuickFilter);
  const visibleBookings = useMemo(() => {
    const quickFiltered = props.bookings.filter((booking) => bookingMatchesQuickFilter(booking, quickFilter));
    const exactFiltered = applyBookingListFilters(quickFiltered, {
      status: props.statusFilter,
      source: props.sourceFilter,
      delivery: props.deliveryFilter,
      payment: props.paymentFilter,
      assignment: props.assignmentFilter,
      branchId: props.branchFilter,
    });
    return searchBookings(exactFiltered, props.search);
  }, [props.assignmentFilter, props.bookings, props.branchFilter, props.deliveryFilter, props.paymentFilter, props.search, props.sourceFilter, props.statusFilter, quickFilter]);
  const requestedId = searchParams.get("bookingId") ?? searchParams.get("highlight") ?? props.initialSelectedId;
  const initialRoomBooking = searchParams.get("openRoomAssignment") === "1" && requestedId
    ? props.bookings.find((booking) => booking.id === requestedId && !booking.resource_id) ?? null
    : null;
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (requestedId && visibleBookings.some((booking) => booking.id === requestedId)) return requestedId;
    return visibleBookings[0]?.id ?? NO_SELECTION;
  });
  const [modalState, setModalState] = useState<BookingModalState>(() => initialRoomBooking ? { type: "room", booking: initialRoomBooking } : null);

  useEffect(() => {
    if (searchParams.get("openRoomAssignment") !== "1") return;
    const params = new URLSearchParams(window.location.search);
    params.delete("openRoomAssignment");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [searchParams]);

  const selected = selectedId === NO_SELECTION
    ? null
    : visibleBookings.find((booking) => booking.id === selectedId) ?? visibleBookings[0] ?? null;
  const quickItems = [
    { key: "all" as const, label: "All bookings", count: props.bookings.length },
    { key: "needs-attention" as const, label: "Needs attention", count: props.bookings.filter((booking) => bookingMatchesQuickFilter(booking, "needs-attention")).length },
    { key: "active-now" as const, label: "Active now", count: props.bookings.filter((booking) => bookingMatchesQuickFilter(booking, "active-now")).length },
  ];
  const basePath = `/${props.workspaceContext === "owner" ? "owner" : props.workspaceContext === "manager" ? "manager" : "crm"}/bookings`;
  const dispatchHref = basePath.replace(/\/bookings$/, "/dispatch");

  function selectQuickFilter(nextFilter: BookingQuickFilter) {
    setQuickFilter(nextFilter);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", nextFilter);
    params.delete("page");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function changed() {
    props.onBookingsChanged?.();
    router.refresh();
  }

  function handleArrived() {
    if (modalState?.type !== "arrival") return;
    const arrived = { ...modalState.booking, booking_progress_status: "checked_in" };
    changed();
    if (!arrived.resource_id && arrived.delivery_type !== "home_service" && arrived.type !== "home_service") {
      setModalState({ type: "room", booking: arrived });
    } else setModalState(null);
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[1120px] grid-cols-[minmax(620px,1.28fr)_minmax(480px,0.98fr)] items-start gap-3 bg-[var(--cs-bg)]">
        <section className="flex h-[calc(100vh-78px)] min-h-[690px] max-h-[940px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-white shadow-[var(--cs-shadow-sm)]">
          <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--cs-text)]">Bookings</h1>
              <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">Manage and action bookings</p>
            </div>
            <span className="rounded-lg border border-[var(--cs-border)] bg-white px-3 py-2 text-sm font-bold text-[var(--cs-text)]">{props.bookings.length} total</span>
          </header>
          <BookingsListToolbar basePath={basePath} date={props.date} quickFilter={quickFilter} search={props.search} status={props.statusFilter} source={props.sourceFilter} delivery={props.deliveryFilter} payment={props.paymentFilter} assignment={props.assignmentFilter} branch={props.branchFilter} branches={props.branches} preservedQuery={{ bookingId: searchParams.get("bookingId") ?? undefined, branchId: searchParams.get("branchId") ?? undefined, highlight: searchParams.get("highlight") ?? undefined, page: searchParams.get("page") ?? undefined }} />
          <BookingsQuickFilters items={quickItems} activeFilter={quickFilter} onChange={selectQuickFilter} />
          <BookingsDesktopList bookings={visibleBookings} selectedId={selected?.id ?? null} initialPage={props.initialPage} onSelect={(booking) => { setSelectedId(booking.id); replaceSelectionQuery(booking.id); }} />
        </section>

        {selected ? (
          <SelectedBookingCommandPane key={`${selected.id}-${firstBookingRelation(selected.staff)?.id ?? "none"}-${selected.session_started_at ?? "none"}-${selected.booking_progress_status ?? "none"}`} booking={selected} viewerRole={props.viewerRole} dispatchHref={dispatchHref} statusAction={props.statusAction} paymentAction={props.paymentAction} confirmPaymentAction={props.confirmPaymentAction} onClose={() => { setSelectedId(NO_SELECTION); replaceSelectionQuery(null); }} onOpenFollowup={(initialResult) => setModalState({ type: "followup", booking: selected, initialResult })} onOpenReschedule={() => setModalState({ type: "reschedule", booking: selected })} onOpenArrival={() => setModalState({ type: "arrival", booking: selected })} onOpenRoom={() => setModalState({ type: "room", booking: selected })} onChanged={changed} />
        ) : (
          <aside className="sticky top-4 flex h-[calc(100vh-78px)] min-h-[690px] items-center justify-center rounded-xl border border-[var(--cs-border-soft)] bg-white p-8 text-center shadow-[var(--cs-shadow-sm)]">
            <div><p className="text-sm font-semibold text-[var(--cs-text)]">No booking selected</p><p className="mt-1 text-sm text-[var(--cs-text-muted)]">Select a booking row to open its command center.</p></div>
          </aside>
        )}
      </div>
      <BookingsModalStack state={modalState} onStateChange={setModalState} onChanged={changed} onArrived={handleArrived} />
    </div>
  );
}
