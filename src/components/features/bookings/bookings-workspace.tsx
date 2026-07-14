"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { BookingsTable } from "./bookings-table";
import { BookingsDesktopWorkspace } from "./bookings-desktop-workspace";
import type {
  BookingActionFn,
  Branch,
  WorkspaceBookingRow,
  WorkspaceContext,
} from "./booking-workspace-types";
import { Button } from "@/components/ui/button";
import type { DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import {
  AttendanceTabPanel,
  ContextChip,
  ToolbarShell,
} from "@/components/features/attendance/attendance-ui";
import { isBookingClosedForCrm, isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import { cn } from "@/lib/utils";
import type { BookingQuickFilter } from "@/lib/bookings/bookings-workspace-filters";

export type { Branch, WorkspaceBookingRow, WorkspaceContext } from "./booking-workspace-types";

export type BookingWorkspaceTab =
  | "needs-action"
  | "upcoming"
  | "active"
  | "completed";

type ActionFn = BookingActionFn;

type BookingsWorkspaceProps = {
  workspaceContext: WorkspaceContext;
  viewerRole: string;
  branchName?: string;
  branches?: Branch[];
  date: string;
  statusFilter?: string;
  typeFilter?: string;
  deliveryFilter?: string;
  paymentFilter?: string;
  assignmentFilter?: string;
  branchFilter?: string;
  search?: string;
  initialTab?: BookingWorkspaceTab;
  initialQuickFilter?: BookingQuickFilter;
  initialPage?: number;
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

const WORKFLOW_TAB_ICONS = {
  "needs-action": AlertCircle,
  upcoming: CalendarClock,
  active: Activity,
  completed: CheckCircle2,
} satisfies Record<BookingWorkspaceTab, typeof AlertCircle>;

function bookingTabId(tab: BookingWorkspaceTab): string {
  return `booking-tab-${tab}`;
}

function bookingTabPanelId(tab: BookingWorkspaceTab): string {
  return `booking-panel-${tab}`;
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
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const tablist = event.currentTarget;
    const index = tabs.findIndex((tab) => tab.key === activeKey);
    const lastIndex = tabs.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (index + 1) % tabs.length
            : (index - 1 + tabs.length) % tabs.length;

    const nextTab = tabs[nextIndex]?.key ?? "needs-action";
    onSelect(nextTab);
    window.setTimeout(() => {
      const tabButtons = tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      tabButtons[nextIndex]?.focus();
    }, 0);
  }

  return (
    <div
      className="flex min-w-0 gap-1 overflow-x-auto border-b border-border"
      role="tablist"
      aria-label="Booking workflow"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const Icon = WORKFLOW_TAB_ICONS[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={bookingTabId(tab.key)}
            aria-controls={bookingTabPanelId(tab.key)}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-[var(--cs-crm-text)] text-[var(--cs-crm-text)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{tab.label}</span>
            <span
              className={cn(
                "inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                isActive
                  ? "bg-muted text-foreground"
                  : "bg-muted/70 text-muted-foreground"
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
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
  deliveryFilter,
  paymentFilter,
  assignmentFilter,
  branchFilter,
  search,
  initialTab,
  initialQuickFilter = "all",
  initialPage,
  bookings,
  statusAction,
  paymentAction,
  initialSelectedId,
  confirmPaymentAction,
  onBookingsChanged,
}: BookingsWorkspaceProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(
    () => workspaceContext === "crm" ? null : false
  );
  const basePath = `/${workspaceContext === "owner" ? "owner" : workspaceContext === "manager" ? "manager" : "crm"}/bookings`;
  const dispatchHref = basePath.replace(/\/bookings$/, "/dispatch");
  const [activeTab, setActiveTab] = useState<BookingWorkspaceTab>(
    () => initialTab ?? deriveTabForBooking(bookings.find((booking) => booking.id === initialSelectedId)) ?? "needs-action"
  );
  const [showFilters, setShowFilters] = useState(Boolean(statusFilter || typeFilter || branchFilter));
  const tabItems = useMemo(
    () =>
      WORKFLOW_TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        count: bookings.filter((booking) => bookingMatchesTab(booking, tab.key)).length,
      })),
    [bookings]
  );
  const tabBookings = useMemo(
    () => bookings.filter((booking) => bookingMatchesTab(booking, activeTab)),
    [activeTab, bookings]
  );
  const visibleBookings = useMemo(
    () => applySecondaryFilters(tabBookings, statusFilter, typeFilter, branchFilter),
    [branchFilter, statusFilter, tabBookings, typeFilter]
  );
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const isOwner = workspaceContext === "owner";
  const isCrm = workspaceContext === "crm";
  const hasFilters = Boolean(statusFilter || typeFilter || branchFilter || search);
  const needsActionCount = tabItems.find((tab) => tab.key === "needs-action")?.count ?? 0;

  useEffect(() => {
    if (workspaceContext !== "crm") return;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktop(mediaQuery.matches);
    const initialTimer = window.setTimeout(updateViewport, 0);
    mediaQuery.addEventListener("change", updateViewport);
    return () => {
      window.clearTimeout(initialTimer);
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, [workspaceContext]);

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

  if (isDesktop === null) {
    return <div className="min-h-[690px] animate-pulse rounded-xl border border-[var(--cs-border-soft)] bg-white" aria-label="Loading bookings workspace" aria-busy="true" />;
  }

  if (isDesktop) {
    return (
      <BookingsDesktopWorkspace
        workspaceContext={workspaceContext}
        viewerRole={viewerRole}
        branches={branches}
        date={date}
        statusFilter={statusFilter}
        sourceFilter={typeFilter}
        deliveryFilter={deliveryFilter}
        paymentFilter={paymentFilter}
        assignmentFilter={assignmentFilter}
        branchFilter={branchFilter}
        search={search}
        initialQuickFilter={initialQuickFilter}
        initialPage={initialPage}
        bookings={bookings}
        statusAction={statusAction}
        paymentAction={paymentAction}
        initialSelectedId={initialSelectedId}
        confirmPaymentAction={confirmPaymentAction}
        onBookingsChanged={onBookingsChanged}
      />
    );
  }

  return (
    <div className="crm-fade-up grid gap-5">
      <header className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="m-0 text-2xl font-bold tracking-normal text-foreground">
              Bookings
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Manage booking triage, customer follow-up, payment review, resource assignment, and service progress.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onBookingsChanged?.()}
            >
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
            {isCrm ? (
              <OpenAdministrativeBookingButton
                mode="standard_future"
                date={date}
                size="lg"
              >
                <Plus data-icon="inline-start" />
                New Booking
              </OpenAdministrativeBookingButton>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ContextChip ariaLabel={`Bookings date: ${dateLabel}`} icon={<CalendarDays className="size-4" />}>
            {dateLabel}
          </ContextChip>
          {branchName && !isOwner ? (
            <ContextChip ariaLabel={`Bookings branch: ${branchName}`} icon={<Building2 className="size-4" />}>
              {branchName}
            </ContextChip>
          ) : null}
          <ContextChip ariaLabel={`Bookings loaded: ${bookings.length}`} icon={<ClipboardList className="size-4" />}>
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
          </ContextChip>
          <ContextChip ariaLabel={`Bookings needing action: ${needsActionCount}`} icon={<AlertCircle className="size-4" />}>
            {needsActionCount} need action
          </ContextChip>
        </div>
      </header>

      <form method="get" className="grid gap-3">
        <input type="hidden" name="tab" value={activeTab} />
        <ToolbarShell
          fieldsClassName="grid-cols-1 gap-3 xl:grid-cols-[minmax(220px,1fr)_minmax(0,auto)] xl:items-end"
          actions={
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setShowFilters((current) => !current)}
              aria-expanded={showFilters}
            >
              <Filter data-icon="inline-start" />
              Filters
            </Button>
          }
        >
          <label className="grid min-w-0 gap-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
              Search
            </span>
            <span className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 shadow-sm">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Customer, phone, staff, or booking ID"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </span>
          </label>
          <WorkflowTabBar tabs={tabItems} activeKey={activeTab} onSelect={handleTabChange} />
        </ToolbarShell>

        {showFilters ? (
          <ToolbarShell
            className="bg-muted/40 shadow-none"
            fieldsClassName="grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            actions={
              <>
                <Button type="submit" size="lg">
                  Filter
                </Button>
                {hasFilters ? (
                  <Button asChild variant="ghost" size="lg">
                    <Link href={buildClearHref(basePath, activeTab)}>Clear</Link>
                  </Button>
                ) : null}
              </>
            }
          >
            <label className="grid min-w-0 gap-1">
              <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
                Date
              </span>
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-emerald-800"
              />
            </label>
            {isOwner && branches && branches.length > 0 ? (
              <label className="grid min-w-0 gap-1">
                <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
                  Branch
                </span>
                <select
                  name="branch"
                  defaultValue={branchFilter ?? ""}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-emerald-800"
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="grid min-w-0 gap-1">
              <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
                Source
              </span>
              <select
                name="type"
                defaultValue={typeFilter ?? ""}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-emerald-800"
              >
                <option value="">All Sources</option>
                <option value="walkin">Walk-in</option>
                <option value="online">Online</option>
                <option value="home_service">Home Service</option>
              </select>
            </label>
          </ToolbarShell>
        ) : null}
      </form>

      <div className="text-xs text-[var(--cs-text-muted)]">
        {visibleBookings.length} booking{visibleBookings.length !== 1 ? "s" : ""} in {tabItems.find((tab) => tab.key === activeTab)?.label.toLowerCase()} for {dateLabel}
      </div>

      {WORKFLOW_TABS.map((tab) => (
        <AttendanceTabPanel
          key={tab.key}
          id={bookingTabPanelId(tab.key)}
          labelledBy={bookingTabId(tab.key)}
          active={activeTab === tab.key}
        >
          {activeTab === tab.key ? (
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
          ) : null}
        </AttendanceTabPanel>
      ))}
    </div>
  );
}
