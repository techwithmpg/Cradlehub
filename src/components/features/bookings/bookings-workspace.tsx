"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { BookingsTable } from "./bookings-table";
import type { DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { isBookingClosedForCrm, isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import { cn } from "@/lib/utils";

export type WorkspaceContext = "owner" | "manager" | "crm";

type OneOrMany<T> = T | T[] | null;

export type WorkspaceBookingRow = {
  id: string;
  branch_id?: string | null;
  booking_date: string;
  start_time: string;
  end_time?: string | null;
  type: string;
  delivery_type?: string | null;
  status: string;
  booking_progress_status?: string | null;
  checked_in_at?: string | null;
  travel_started_at?: string | null;
  arrived_at?: string | null;
  session_started_at?: string | null;
  session_completed_at?: string | null;
  no_show_at?: string | null;
  resource_id?: string | null;
  travel_buffer_mins?: number | null;
  metadata?: Record<string, unknown> | null;
  payment_method: string;
  payment_status: string;
  payment_reference?: string | null;
  amount_paid: number;
  hold_expires_at?: string | null;
  branches?: OneOrMany<{ id?: string; name: string }>;
  services?: OneOrMany<{ id?: string; name: string; duration_minutes?: number }>;
  staff?: OneOrMany<{ id?: string; full_name: string; nickname?: string | null; tier?: string }>;
  customers?: OneOrMany<{ id?: string; full_name: string; phone?: string | null; email?: string | null }>;
  branch_resources?: OneOrMany<{ id?: string; name: string; type?: string | null; capacity?: number | null }>;
};

export type BookingWorkspaceTab =
  | "needs-action"
  | "upcoming"
  | "active"
  | "completed";

export type Branch = { id: string; name: string };

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type BookingsWorkspaceProps = {
  workspaceContext: WorkspaceContext;
  viewerRole: string;
  branchName?: string;
  branches?: Branch[];
  date: string;
  statusFilter?: string;
  typeFilter?: string;
  branchFilter?: string;
  search?: string;
  initialTab?: BookingWorkspaceTab;
  bookings: WorkspaceBookingRow[];
  waitlistRows?: WaitlistRow[];
  cashSummary?: DailyCashSummaryData | null;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  initialSelectedId?: string;
  confirmPaymentAction?: ActionFn;
  onBookingsChanged?: () => void;
};

const WORKFLOW_TABS: Array<{ key: BookingWorkspaceTab; label: string }> = [
  { key: "needs-action", label: "Needs Action" },
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

function isNotStartedProgress(status: string | null | undefined): boolean {
  return !status || status === "not_started";
}

function isHomeServiceBooking(booking: WorkspaceBookingRow): boolean {
  return (
    booking.delivery_type === "home_service" ||
    booking.type === "home_service" ||
    booking.metadata?.delivery_type === "home_service" ||
    booking.metadata?.type === "home_service"
  );
}

function hasPaymentIssue(booking: WorkspaceBookingRow): boolean {
  if (isBookingClosedForCrm(booking.status)) return false;
  const paymentStatus = booking.payment_status ?? "unpaid";
  return ["unpaid", "pending", "pending_payment"].includes(paymentStatus);
}

function hasAssignmentIssue(booking: WorkspaceBookingRow): boolean {
  if (isHomeServiceBooking(booking) || isBookingClosedForCrm(booking.status)) return false;
  return booking.status === "confirmed" && !booking.resource_id;
}

function hasFollowUpMetadata(booking: WorkspaceBookingRow): boolean {
  const followup = booking.metadata?.crm_followup;
  if (!followup || typeof followup !== "object" || Array.isArray(followup)) return false;
  const result = (followup as { result?: unknown }).result;
  return result === "no_answer" || result === "reschedule" || result === "confirm_later";
}

function bookingNeedsAction(booking: WorkspaceBookingRow): boolean {
  return (
    !isBookingClosedForCrm(booking.status) &&
    (
      isCrmPendingBookingStatus(booking.status) ||
      hasPaymentIssue(booking) ||
      hasAssignmentIssue(booking) ||
      hasFollowUpMetadata(booking)
    )
  );
}

function bookingMatchesTab(booking: WorkspaceBookingRow, tab: BookingWorkspaceTab): boolean {
  const progress = booking.booking_progress_status ?? null;
  const isClosed =
    isBookingClosedForCrm(booking.status) ||
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    progress === "completed" ||
    progress === "no_show";
  const isActive =
    booking.status === "in_progress" ||
    progress === "checked_in" ||
    progress === "travel_started" ||
    progress === "arrived" ||
    progress === "session_started";

  switch (tab) {
    case "needs-action":
      return bookingNeedsAction(booking);
    case "upcoming":
      return !isClosed && !isActive && !bookingNeedsAction(booking) && (
        booking.status === "confirmed" ||
        booking.status === "scheduled" ||
        isNotStartedProgress(progress)
      );
    case "active":
      return !isClosed && isActive;
    case "completed":
      return isClosed;
  }
}

function deriveTabForBooking(booking: WorkspaceBookingRow | undefined): BookingWorkspaceTab | undefined {
  if (!booking) return undefined;
  return WORKFLOW_TABS.find((tab) => bookingMatchesTab(booking, tab.key))?.key;
}

function applySecondaryFilters(
  bookings: WorkspaceBookingRow[],
  statusFilter?: string,
  typeFilter?: string,
  branchFilter?: string
): WorkspaceBookingRow[] {
  return bookings.filter((booking) => {
    if (statusFilter) {
      const statusMatches =
        statusFilter === "pending"
          ? isCrmPendingBookingStatus(booking.status)
          : booking.status === statusFilter;
      if (!statusMatches) return false;
    }
    if (typeFilter) {
      const typeMatches = typeFilter === "home_service"
        ? isHomeServiceBooking(booking)
        : booking.type === typeFilter;
      if (!typeMatches) return false;
    }
    if (branchFilter && booking.branch_id !== branchFilter) return false;
    return true;
  });
}

function buildClearHref(basePath: string, activeTab: BookingWorkspaceTab): string {
  return `${basePath}?tab=${activeTab}`;
}

function WorkflowTabBar({
  tabs,
  activeKey,
  onSelect,
}: {
  tabs: Array<{ key: BookingWorkspaceTab; label: string; count: number }>;
  activeKey: BookingWorkspaceTab;
  onSelect: (tab: BookingWorkspaceTab) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-1.5 shadow-[var(--cs-shadow-xs)]">
      <div className="flex min-w-max gap-1.5" role="tablist" aria-label="Booking workflow">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]",
                isActive
                  ? "border-[var(--cs-crm-text)] bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)] shadow-[var(--cs-shadow-sm)]"
                  : "border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:border-[var(--cs-border-strong)] hover:text-[var(--cs-text)]"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  isActive
                    ? "bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]"
                    : "bg-[var(--cs-surface)] text-[var(--cs-text-muted)]"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookingsWorkspace({
  workspaceContext,
  viewerRole,
  branchName,
  branches,
  date,
  statusFilter,
  typeFilter,
  branchFilter,
  search,
  initialTab,
  bookings,
  statusAction,
  paymentAction,
  initialSelectedId,
  confirmPaymentAction,
  onBookingsChanged,
}: BookingsWorkspaceProps) {
  const basePath = `/${workspaceContext === "owner" ? "owner" : workspaceContext === "manager" ? "manager" : "crm"}/bookings`;
  const dispatchHref = basePath.replace(/\/bookings$/, "/dispatch");
  const initialBookingTab = deriveTabForBooking(bookings.find((booking) => booking.id === initialSelectedId));
  const [activeTab, setActiveTab] = useState<BookingWorkspaceTab>(
    initialTab ?? initialBookingTab ?? "needs-action"
  );
  const [showFilters, setShowFilters] = useState(Boolean(statusFilter || typeFilter || branchFilter));
  const tabBookings = bookings.filter((booking) => bookingMatchesTab(booking, activeTab));
  const visibleBookings = applySecondaryFilters(tabBookings, statusFilter, typeFilter, branchFilter);
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const isOwner = workspaceContext === "owner";
  const isCrm = workspaceContext === "crm";
  const hasFilters = Boolean(statusFilter || typeFilter || branchFilter || search);
  const tabItems = WORKFLOW_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    count: bookings.filter((booking) => bookingMatchesTab(booking, tab.key)).length,
  }));
  const needsActionCount = tabItems.find((tab) => tab.key === "needs-action")?.count ?? 0;

  function handleTabChange(nextTab: BookingWorkspaceTab) {
    setActiveTab(nextTab);

    const params = new URLSearchParams(window.location.search);
    params.set("tab", nextTab);
    params.delete("status");
    params.delete("bookingId");
    params.delete("highlight");
    params.delete("openRoomAssignment");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <div className="crm-fade-up -m-2 space-y-4 bg-[var(--cs-bg)] p-2 sm:-m-4 sm:space-y-5 sm:p-4">
      <section className="space-y-4 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--cs-text)] sm:text-3xl">
              Bookings
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--cs-text-secondary)]">
              {bookings.length} booking{bookings.length !== 1 ? "s" : ""} · {needsActionCount} need action · {dateLabel}
              {branchName && !isOwner ? <span> · {branchName}</span> : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onBookingsChanged?.()}
              className="cs-btn cs-btn-secondary h-9 rounded-xl px-3"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            {isCrm ? (
              <Link href="/crm/bookings/new" className="cs-btn h-9 rounded-xl bg-[var(--cs-crm-text)] px-3 text-[var(--cs-text-inverse)] shadow-[var(--cs-shadow-sm)] hover:bg-[var(--cs-success-text)]">
                <Plus size={14} />
                New Booking
              </Link>
            ) : null}
          </div>
        </div>

        <form method="get" className="grid gap-3">
          <input type="hidden" name="tab" value={activeTab} />
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
              <input
                type="search"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Search customer, phone, staff, or booking ID"
                aria-label="Search bookings"
                className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] pl-9 pr-3 text-sm text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)]"
              />
            </div>
            <WorkflowTabBar tabs={tabItems} activeKey={activeTab} onSelect={handleTabChange} />
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className="cs-btn cs-btn-secondary h-10 rounded-xl px-3"
              aria-expanded={showFilters}
            >
              <Filter size={14} />
              Filters
            </button>
          </div>

          {showFilters ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-2">
              <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text-secondary)]">
                <CalendarDays size={15} />
                <input
                  type="date"
                  name="date"
                  defaultValue={date}
                  aria-label="Select date"
                  className="bg-transparent text-sm text-[var(--cs-text)] outline-none"
                />
              </label>
              {isOwner && branches && branches.length > 0 ? (
                <select
                  name="branch"
                  defaultValue={branchFilter ?? ""}
                  aria-label="Filter by branch"
                  className="h-9 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              ) : null}

              <select
                name="type"
                defaultValue={typeFilter ?? ""}
                aria-label="Filter by type"
                className="h-9 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
              >
                <option value="">All Sources</option>
                <option value="walkin">Walk-in</option>
                <option value="online">Online</option>
                <option value="home_service">Home Service</option>
              </select>

              <button type="submit" className="cs-btn h-9 rounded-lg bg-[var(--cs-crm-text)] px-4 text-[var(--cs-text-inverse)]">
                Filter
              </button>

              {hasFilters ? (
                <Link href={buildClearHref(basePath, activeTab)} className="cs-btn cs-btn-ghost h-9 rounded-lg px-3">
                  Clear
                </Link>
              ) : null}
            </div>
          ) : null}
        </form>

        <div className="text-xs text-[var(--cs-text-muted)]">
          {visibleBookings.length} booking{visibleBookings.length !== 1 ? "s" : ""} in {tabItems.find((tab) => tab.key === activeTab)?.label.toLowerCase()} for {dateLabel}
        </div>
      </section>

      <BookingsTable
        bookings={visibleBookings}
        allBookings={bookings}
        viewerRole={viewerRole}
        dispatchHref={dispatchHref}
        search={search}
        statusAction={statusAction}
        paymentAction={paymentAction}
        initialSelectedId={initialSelectedId}
        confirmPaymentAction={confirmPaymentAction}
        onBookingsChanged={onBookingsChanged}
      />
    </div>
  );
}
