"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BookingsTable } from "./bookings-table";
import { CallbackFollowupPanel } from "./callback-followup-panel";
import type { DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { isBookingClosedForCrm, isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import { cn, formatCurrency } from "@/lib/utils";

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
  | "needs-confirmation"
  | "confirmed"
  | "waiting"
  | "in-service"
  | "completed"
  | "callback-followup";

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
  { key: "needs-confirmation", label: "Needs Confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "waiting", label: "Waiting / Arrived" },
  { key: "in-service", label: "In Service" },
  { key: "completed", label: "Completed" },
  { key: "callback-followup", label: "Callback Follow-up" },
];

const TAB_HINTS: Record<BookingWorkspaceTab, string> = {
  "needs-confirmation": "Confirm booking -> moves to Confirmed tab.",
  confirmed: "When guest arrives -> mark Customer Arrived and assign room if needed.",
  waiting: "Assign a room/bed or keep the guest waiting until a room is ready.",
  "in-service": "Track active sessions and complete service when done.",
  completed: "Completed bookings stay here for review and receipt follow-up.",
  "callback-followup": "Follow up with customers who need a callback, reschedule, or conversion.",
};

function readPricePaid(metadata: Record<string, unknown> | null | undefined): number {
  if (!metadata) return 0;
  const n = Number(metadata.price_paid ?? 0);
  return Number.isFinite(n) ? n : 0;
}

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

function bookingMatchesTab(booking: WorkspaceBookingRow, tab: BookingWorkspaceTab): boolean {
  const progress = booking.booking_progress_status ?? null;

  switch (tab) {
    case "needs-confirmation":
      return isCrmPendingBookingStatus(booking.status);
    case "confirmed":
      return booking.status === "confirmed" && (isNotStartedProgress(progress) || progress === "travel_started");
    case "waiting":
      return progress === "checked_in" || progress === "arrived";
    case "in-service":
      return booking.status === "in_progress" || progress === "session_started";
    case "completed":
      return booking.status === "completed" || progress === "completed";
    case "callback-followup":
      return false;
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

function metricLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function computeCommandMetrics(bookings: WorkspaceBookingRow[], cashSummary?: DailyCashSummaryData | null) {
  const needsConfirmation = bookings.filter((booking) => bookingMatchesTab(booking, "needs-confirmation")).length;
  const confirmed = bookings.filter((booking) => bookingMatchesTab(booking, "confirmed")).length;
  const waiting = bookings.filter((booking) => bookingMatchesTab(booking, "waiting")).length;
  const inService = bookings.filter((booking) => bookingMatchesTab(booking, "in-service")).length;
  const completed = bookings.filter((booking) => bookingMatchesTab(booking, "completed")).length;
  const roomsReady = bookings.filter(
    (booking) =>
      booking.resource_id &&
      !isBookingClosedForCrm(booking.status) &&
      booking.booking_progress_status !== "session_started"
  ).length;
  const collection =
    cashSummary != null
      ? cashSummary.total_collected
      : bookings
          .filter((booking) => booking.payment_status === "paid" && !isBookingClosedForCrm(booking.status))
          .reduce((sum, booking) => sum + (booking.amount_paid ?? 0), 0);
  const expected =
    cashSummary != null
      ? cashSummary.total_expected
      : bookings
          .filter((booking) => !isBookingClosedForCrm(booking.status))
          .reduce((sum, booking) => sum + readPricePaid(booking.metadata), 0);

  return {
    needsConfirmation,
    confirmed,
    waiting,
    inService,
    completed,
    roomsReady,
    collection,
    expected,
  };
}

function CommandKpiCard({
  icon: Icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  helper: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-[168px] flex-1 rounded-2xl border bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]",
        accent ? "border-[var(--cs-sand)]" : "border-[var(--cs-border-soft)]"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold leading-none text-[var(--cs-text)] tabular-nums">
            {value}
          </div>
          <div className="mt-1 text-[11px] leading-4 text-[var(--cs-text-muted)]">
            {helper}
          </div>
        </div>
      </div>
    </div>
  );
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
  waitlistRows = [],
  cashSummary,
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
    initialTab ?? initialBookingTab ?? "needs-confirmation"
  );
  const tabBookings = bookings.filter((booking) => bookingMatchesTab(booking, activeTab));
  const visibleBookings = applySecondaryFilters(tabBookings, statusFilter, typeFilter, branchFilter);
  const metrics = computeCommandMetrics(bookings, cashSummary);
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
    count:
      tab.key === "callback-followup"
        ? waitlistRows.length
        : bookings.filter((booking) => bookingMatchesTab(booking, tab.key)).length,
  }));

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
    <div className="crm-fade-up -m-2 space-y-4 rounded-[28px] bg-[var(--cs-bg)] p-2 sm:-m-4 sm:space-y-5 sm:p-4">
      <section className="rounded-3xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4 shadow-[var(--cs-shadow-sm)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cs-sand-dark)]">
              <Sparkles size={13} />
              Front Desk Workflow
            </div>
            <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--cs-text)] sm:text-3xl">
              Bookings Command Center
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--cs-text-secondary)]">
              Confirm bookings, manage arrivals, and assign rooms quickly.
              {branchName && !isOwner ? (
                <span className="font-semibold text-[var(--cs-sand-dark)]"> {branchName}</span>
              ) : null}
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

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          <CommandKpiCard
            icon={Clock3}
            label="Needs Confirmation"
            value={metrics.needsConfirmation}
            helper={metricLabel(metrics.needsConfirmation, "new request")}
            accent
          />
          <CommandKpiCard
            icon={CheckCircle2}
            label="Confirmed Today"
            value={metrics.confirmed}
            helper={metricLabel(metrics.confirmed, "booking")}
          />
          <CommandKpiCard
            icon={Users}
            label="Waiting / Arrived"
            value={metrics.waiting}
            helper={metricLabel(metrics.waiting, "guest")}
          />
          <CommandKpiCard
            icon={Sparkles}
            label="In Service"
            value={metrics.inService}
            helper={metricLabel(metrics.inService, "guest")}
          />
          <CommandKpiCard
            icon={DoorOpen}
            label="Rooms Ready"
            value={metrics.roomsReady}
            helper={metricLabel(metrics.roomsReady, "room assignment")}
          />
          <CommandKpiCard
            icon={CreditCard}
            label="Today's Collection"
            value={formatCurrency(metrics.collection)}
            helper={metrics.expected > 0 ? `of ${formatCurrency(metrics.expected)} expected` : "no expected total"}
          />
        </div>
      </section>

      <WorkflowTabBar tabs={tabItems} activeKey={activeTab} onSelect={handleTabChange} />

      <div className="flex items-center gap-2 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-2 text-xs font-medium text-[var(--cs-text-secondary)] shadow-[var(--cs-shadow-xs)]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--cs-sand)]" />
        <span>{TAB_HINTS[activeTab]}</span>
      </div>

      {activeTab === "callback-followup" ? (
        <CallbackFollowupPanel rows={waitlistRows} />
      ) : (
        <>
          <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)]">
            <form method="get" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="tab" value={activeTab} />

              <div className="relative min-w-[220px] flex-1">
                <input
                  type="search"
                  name="search"
                  defaultValue={search ?? ""}
                  placeholder="Search customer, phone, staff, or booking ID"
                  aria-label="Search bookings"
                  className="h-10 w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 text-sm text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)]"
                />
              </div>

              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 text-sm text-[var(--cs-text-secondary)]">
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
                  className="h-10 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
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
                className="h-10 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
              >
                <option value="">All Sources</option>
                <option value="walkin">Walk-in</option>
                <option value="online">Online</option>
                <option value="home_service">Home Service</option>
              </select>

              <button type="submit" className="cs-btn h-10 rounded-xl bg-[var(--cs-crm-text)] px-4 text-[var(--cs-text-inverse)]">
                Filter
              </button>

              {hasFilters ? (
                <Link href={buildClearHref(basePath, activeTab)} className="cs-btn cs-btn-ghost h-10 rounded-xl px-3">
                  Clear
                </Link>
              ) : null}
            </form>

            <div className="mt-2 text-xs text-[var(--cs-text-muted)]">
              {visibleBookings.length} booking{visibleBookings.length !== 1 ? "s" : ""} in this workflow for {dateLabel}
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
        </>
      )}
    </div>
  );
}
