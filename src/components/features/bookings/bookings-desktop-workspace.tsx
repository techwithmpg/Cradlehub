"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  List,
  Calendar as CalendarIcon,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import type {
  Branch,
  WorkspaceBookingRow,
  WorkspaceContext,
  BookingActionFn,
} from "./booking-workspace-types";
import {
  bookingMatchesQuickFilter,
  type BookingQuickFilter,
} from "@/lib/bookings/bookings-workspace-filters";
import { groupCrmBookings, matchesCrmBookingGroupSearch } from "@/lib/bookings/crm-booking-groups";
import { findBookingGroup } from "@/lib/bookings/group-bookings-by-order";
import { firstBookingRelation } from "@/lib/bookings/booking-display";
import { HorizontalBookingRow } from "./horizontal-booking-row";
import { BookingsQuickFilters } from "./bookings-quick-filters";
import { useAdministrativeBookingModal } from "./administrative-booking-modal-provider";
import { BookingsModalStack, type BookingModalState } from "./bookings-modal-stack";
import { SheetBookingReferenceDetail } from "./sheet-booking-reference-row";
import { SheetFreshnessControl } from "./sheet-freshness-control";
import { BookingSourceSwitch } from "./booking-source-switch";
import {
  filterSheetBookings,
  withPossibleMatch,
} from "@/lib/integrations/google-sheets/sheet-native-match";
import { sortSheetReferencesRecentFirst } from "@/lib/bookings/booking-recency";
import { isOperationalBookingGroup } from "@/lib/bookings/operational-booking-eligibility";
import type { SheetNativeReferencesState } from "@/lib/integrations/google-sheets/sheet-native-types";

const NO_SELECTION = "__no_booking_selected__";

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
  businessDate?: string;
  clockTime?: string;
  statusFilter?: string;
  sourceFilter?: string;
  referenceSource?: "all" | "cradlehub" | "master_sheet";
  deliveryFilter?: string;
  paymentFilter?: string;
  assignmentFilter?: string;
  branchFilter?: string;
  search?: string;
  initialQuickFilter: BookingQuickFilter;
  initialPage?: number;
  bookings: WorkspaceBookingRow[];
  sheetState?: SheetNativeReferencesState;
  sheetLoading?: boolean;
  sheetRefreshing?: boolean;
  onSheetRefresh?: () => void;
  statusAction?: BookingActionFn;
  paymentAction?: BookingActionFn;
  initialSelectedId?: string;
  confirmPaymentAction?: BookingActionFn;
  onRefresh?: () => void;
  onBookingsChanged?: () => void;
  isRefreshing?: boolean;
};

function formatDateDisplay(dateStr: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function BookingsDesktopWorkspace(props: DesktopWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prevInitialQuickFilter, setPrevInitialQuickFilter] = useState(props.initialQuickFilter);
  const [quickFilter, setQuickFilter] = useState(props.initialQuickFilter);

  if (prevInitialQuickFilter !== props.initialQuickFilter) {
    setPrevInitialQuickFilter(props.initialQuickFilter);
    setQuickFilter(props.initialQuickFilter);
  }

  // Try to use administrative booking modal context if available
  let modalContext: ReturnType<typeof useAdministrativeBookingModal> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    modalContext = useAdministrativeBookingModal();
  } catch {
    modalContext = null;
  }

  // Filter & Search local states
  const [searchQuery, setSearchQuery] = useState(props.search ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(props.statusFilter ?? "all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [therapistFilter, setTherapistFilter] = useState<string>(
    props.assignmentFilter ?? "all"
  );
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"time-asc" | "time-desc" | "name-asc">("time-asc");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Single expanded Quick Edit row ID
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(props.initialPage ?? 1);
  const PAGE_SIZE = 15;

  // Master Sheet & modal stack backward compatibility
  const [selectedSheetKey, setSelectedSheetKey] = useState<string | null>(null);
  const [modalState, setModalState] = useState<BookingModalState>(null);

  // Group bookings
  const allGroups = useMemo(
    () => groupCrmBookings(props.bookings, props.workspaceContext === "crm"),
    [props.bookings, props.workspaceContext]
  );

  // Operational bookings simplification (CRM):
  // Show only operationally actionable bookings (excluding completed+paid, cancelled, expired unattended)
  const operationalGroups = useMemo(() => {
    if (props.workspaceContext !== "crm") {
      return allGroups;
    }
    const businessDate = props.businessDate ?? props.date;
    return allGroups.filter((group) =>
      isOperationalBookingGroup(group, {
        businessDate,
        clockTime: props.clockTime,
      })
    );
  }, [allGroups, props.workspaceContext, props.businessDate, props.date, props.clockTime]);

  // Collect unique options for dropdowns
  const availableServices = useMemo(() => {
    if (modalContext?.services && modalContext.services.length > 0) {
      return modalContext.services.map((s) => ({ id: s.id, name: s.name }));
    }
    const map = new Map<string, string>();
    for (const b of props.bookings) {
      const s = firstBookingRelation(b.services);
      if (s?.id && s?.name) map.set(s.id, s.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [modalContext, props.bookings]);

  const availableStaff = useMemo(() => {
    if (modalContext?.staff && modalContext.staff.length > 0) {
      return modalContext.staff.map((st) => ({ id: st.id, name: st.name }));
    }
    const map = new Map<string, string>();
    for (const b of props.bookings) {
      const st = firstBookingRelation(b.staff);
      if (st?.id && st?.full_name) map.set(st.id, st.full_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [modalContext, props.bookings]);

  const availableRooms = useMemo(() => {
    if (modalContext?.resources && modalContext.resources.length > 0) {
      return modalContext.resources.map((r) => ({ id: r.id, name: r.name }));
    }
    const map = new Map<string, string>();
    for (const b of props.bookings) {
      const r = firstBookingRelation(b.branch_resources);
      if (r?.id && r?.name) map.set(r.id, r.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [modalContext, props.bookings]);

  // Master sheet references
  const sheetReferences = useMemo(() => {
    if (
      props.referenceSource === "cradlehub" ||
      props.sheetState?.status !== "available"
    ) {
      return [];
    }
    return sortSheetReferencesRecentFirst(
      filterSheetBookings(
        withPossibleMatch(
          props.sheetState.bookings.filter(
            (reference) => !props.branchFilter || reference.branchId === props.branchFilter
          ),
          props.bookings
        ),
        searchQuery
      )
    );
  }, [props.bookings, props.branchFilter, props.referenceSource, props.sheetState, searchQuery]);

  const selectedSheet =
    sheetReferences.find((reference) => reference.source.sourceKey === selectedSheetKey) ?? null;

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (props.referenceSource === "master_sheet") return [];

    return operationalGroups
      .filter((group) => {
        if (quickFilter === "needs-attention" && group.attentionSummary.length === 0) return false;
        if (
          quickFilter === "active-now" &&
          !group.lines.some((line) => bookingMatchesQuickFilter(line, "active-now"))
        ) {
          return false;
        }

        const primaryLine = group.lines[0]!;

        // Status filter
        if (statusFilter !== "all") {
          const isInService =
            primaryLine.status === "in_progress" ||
            primaryLine.booking_progress_status === "session_started" ||
            primaryLine.booking_progress_status === "in_service" ||
            (Boolean(primaryLine.session_started_at) && !primaryLine.session_completed_at);
          const isCheckedIn =
            !isInService &&
            (primaryLine.booking_progress_status === "checked_in" ||
              primaryLine.booking_progress_status === "arrived" ||
              Boolean(primaryLine.checked_in_at) ||
              Boolean(primaryLine.arrived_at));
          const isCompleted =
            primaryLine.status === "completed" ||
            primaryLine.booking_progress_status === "completed" ||
            Boolean(primaryLine.session_completed_at);
          const isCancelled = primaryLine.status === "cancelled";

          if (statusFilter === "in_service" && !isInService) return false;
          if (statusFilter === "checked_in" && !isCheckedIn) return false;
          if (statusFilter === "completed" && !isCompleted) return false;
          if (statusFilter === "cancelled" && !isCancelled) return false;
          if (
            statusFilter === "upcoming" &&
            (isInService || isCheckedIn || isCompleted || isCancelled)
          ) {
            return false;
          }
        }

        // Service filter
        if (serviceFilter !== "all") {
          const matchesService = group.lines.some((line) => {
            const svc = firstBookingRelation(line.services);
            return svc?.id === serviceFilter || svc?.name === serviceFilter;
          });
          if (!matchesService) return false;
        }

        // Therapist filter
        if (therapistFilter !== "all") {
          const matchesStaff = group.lines.some((line) => {
            const st = firstBookingRelation(line.staff);
            return (
              line.staff_id === therapistFilter ||
              st?.id === therapistFilter ||
              st?.full_name === therapistFilter
            );
          });
          if (!matchesStaff) return false;
        }

        // Room filter
        if (roomFilter !== "all") {
          const matchesRoom = group.lines.some((line) => {
            const r = firstBookingRelation(line.branch_resources);
            return (
              line.resource_id === roomFilter ||
              r?.id === roomFilter ||
              r?.name === roomFilter
            );
          });
          if (!matchesRoom) return false;
        }

        // Search text
        if (searchQuery.trim()) {
          return matchesCrmBookingGroupSearch(group, searchQuery.trim());
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "time-desc") {
          return b.startTime.localeCompare(a.startTime);
        }
        if (sortBy === "name-asc") {
          return a.organizerName.localeCompare(b.organizerName);
        }
        return a.startTime.localeCompare(b.startTime);
      });
  }, [
    operationalGroups,
    props.referenceSource,
    quickFilter,
    statusFilter,
    serviceFilter,
    therapistFilter,
    roomFilter,
    searchQuery,
    sortBy,
  ]);

  const requestedId =
    searchParams?.get("bookingId") ?? searchParams?.get("highlight") ?? props.initialSelectedId;
  const [selectedId, setSelectedId] = useState<string>(() => {
    return (
      findBookingGroup(filteredGroups, requestedId)?.displayId ??
      filteredGroups[0]?.displayId ??
      NO_SELECTION
    );
  });
  const [selectedLineId, setSelectedLineId] = useState<string | null>(requestedId ?? null);
  const [prevRequestedId, setPrevRequestedId] = useState(requestedId);
  if (prevRequestedId !== requestedId) {
    setPrevRequestedId(requestedId);
    if (requestedId && selectedLineId !== requestedId) {
      const matchingGroup = findBookingGroup(filteredGroups, requestedId);
      if (matchingGroup) {
        setSelectedSheetKey(null);
        setSelectedId(matchingGroup.displayId);
        setSelectedLineId(requestedId);
      }
    }
  }
  const selectedGroup =
    selectedSheet || props.referenceSource === "master_sheet" || selectedId === NO_SELECTION
      ? null
      : (findBookingGroup(filteredGroups, selectedId) ?? filteredGroups[0] ?? null);

  const quickItems = [
    {
      key: "all" as const,
      label: "All bookings",
      count: quickFilter === "upcoming" ? undefined : operationalGroups.length,
    },
    {
      key: "needs-attention" as const,
      label: "Needs attention",
      count:
        quickFilter === "upcoming"
          ? undefined
          : operationalGroups.filter((group) => group.attentionSummary.length > 0).length,
    },
    {
      key: "active-now" as const,
      label: "Active now",
      count:
        quickFilter === "upcoming"
          ? undefined
          : operationalGroups.filter((group) =>
              group.lines.some((line) => bookingMatchesQuickFilter(line, "active-now"))
            ).length,
    },
    {
      key: "upcoming" as const,
      label: "Upcoming",
      count: quickFilter === "upcoming" ? operationalGroups.length : undefined,
    },
  ];

  function selectQuickFilter(nextFilter: BookingQuickFilter) {
    setQuickFilter(nextFilter);
    const params = new URLSearchParams(window.location.search);
    if (nextFilter === "all") {
      params.delete("tab");
    } else {
      params.set("tab", nextFilter);
    }
    params.delete("page");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (nextFilter === "upcoming" || quickFilter === "upcoming") {
      router.push(nextUrl);
    } else {
      window.history.replaceState(null, "", nextUrl);
    }
  }

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredGroups.slice(start, start + PAGE_SIZE);
  }, [filteredGroups, currentPage, PAGE_SIZE]);

  // Date Navigation handlers
  function navigateDate(days: number) {
    const current = new Date(props.date + "T00:00:00");
    current.setDate(current.getDate() + days);
    const nextDateStr = current.toISOString().slice(0, 10);
    const params = new URLSearchParams(window.location.search);
    params.set("date", nextDateStr);
    params.delete("page");
    router.push(`${window.location.pathname}?${params.toString()}`);
  }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const params = new URLSearchParams(window.location.search);
    params.set("date", e.target.value);
    params.delete("page");
    router.push(`${window.location.pathname}?${params.toString()}`);
  }

  function handleNewBooking() {
    if (modalContext?.openBookingModal) {
      modalContext.openBookingModal({ mode: "walkin" });
    } else {
      router.push("/crm/bookings/new");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage today&apos;s bookings, check-ins and service flow.
          </p>
        </div>

        {/* Header actions: Refresh + Green New Booking button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={props.isRefreshing}
            onClick={() => (props.onRefresh ?? props.onBookingsChanged)?.()}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${props.isRefreshing ? "animate-spin" : ""}`} />
            <span>{props.isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button
            type="button"
            onClick={handleNewBooking}
            className="flex items-center gap-1.5 rounded-lg bg-[#006044] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004d37] active:scale-[0.98]"
          >
            <Plus className="size-4" />
            <span>New Booking</span>
          </button>
        </div>
      </div>

      {props.referenceSource !== "master_sheet" ? (
        <div className="mb-4">
          <BookingsQuickFilters
            items={quickItems}
            activeFilter={quickFilter}
            onChange={selectQuickFilter}
          />
        </div>
      ) : null}

      {/* Master Sheet Source Switcher (if in CRM context) */}
      {props.workspaceContext === "crm" && props.referenceSource === "master_sheet" ? (
        <div className="mb-4">
          <BookingSourceSwitch
            source={props.referenceSource === "master_sheet" ? "master_sheet" : "cradlehub"}
          />
          <SheetFreshnessControl
            state={props.sheetState}
            refreshing={props.sheetRefreshing}
            onRefresh={props.onSheetRefresh}
          />
        </div>
      ) : null}

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {/* Date Selector with < and > controls */}
        <div className="flex items-center gap-1.5">
          <label className="relative flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-300">
            <CalendarDays className="size-4 text-neutral-500" />
            <span>{formatDateDisplay(props.date)}</span>
            <ChevronDown className="size-3.5 text-neutral-400" />
            <input
              type="date"
              value={props.date}
              onChange={handleDateInput}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Pick date"
            />
          </label>

          <button
            type="button"
            onClick={() => navigateDate(-1)}
            className="grid size-10 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50 active:scale-95"
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => navigateDate(1)}
            className="grid size-10 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50 active:scale-95"
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by guest name, service or phone..."
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-xs text-neutral-800 placeholder:text-neutral-400 shadow-sm transition focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
          >
            <option value="all">All Statuses</option>
            <option value="in_service">In Service</option>
            <option value="checked_in">Checked In</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
            ▼
          </div>
        </div>

        {/* Services Filter Dropdown */}
        <div className="relative">
          <select
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
          >
            <option value="all">All Services</option>
            {availableServices.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
            ▼
          </div>
        </div>

        {/* Therapists Filter Dropdown */}
        <div className="relative">
          <select
            value={therapistFilter}
            onChange={(e) => {
              setTherapistFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
          >
            <option value="all">All Therapists</option>
            {availableStaff.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
            ▼
          </div>
        </div>

        {/* Rooms Filter Dropdown */}
        <div className="relative">
          <select
            value={roomFilter}
            onChange={(e) => {
              setRoomFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
          >
            <option value="all">All Rooms</option>
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* ── Sub-bar: Count on left, Sort and View switch on right ───── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold text-neutral-600">
          {filteredGroups.length} {filteredGroups.length === 1 ? "booking" : "bookings"}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "time-asc" | "time-desc" | "name-asc")
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-800 shadow-sm focus:border-[#006044] focus:outline-none"
            >
              <option value="time-asc">Time (earliest)</option>
              <option value="time-desc">Time (latest)</option>
              <option value="name-asc">Customer name (A-Z)</option>
            </select>
          </div>

          {/* View Switchers */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-1.5 transition ${
                viewMode === "list"
                  ? "border border-[#a7d7c5] bg-[#e6f4ee] text-[#006044]"
                  : "border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
              }`}
              aria-label="List view"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("calendar");
                router.push("/crm/calendar");
              }}
              className={`rounded-lg p-1.5 transition ${
                viewMode === "calendar"
                  ? "border border-[#a7d7c5] bg-[#e6f4ee] text-[#006044]"
                  : "border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
              }`}
              aria-label="Calendar view"
            >
              <CalendarIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Column Headers matching approved screenshot ──────── */}
      <div className="mb-2 flex items-center gap-3 px-4 py-1.5 sm:px-5 text-xs font-semibold text-neutral-500">
        <div className="w-[100px] shrink-0">Time</div>
        <div className="min-w-0 flex-[1.1]">Customer</div>
        <div className="min-w-0 flex-[1.3]">Service</div>
        <div className="w-[85px] shrink-0">Duration</div>
        <div className="w-[125px] shrink-0">Therapist</div>
        <div className="w-[95px] shrink-0">Room</div>
        <div className="w-[100px] shrink-0">Type</div>
        <div className="w-[95px] shrink-0">Status</div>
        <div className="w-[85px] shrink-0">Payment</div>
        <div className="shrink-0 w-[145px]">Action</div>
      </div>

      {/* ── Booking List Rows ────────────────────────────────────────── */}
      {props.referenceSource === "master_sheet" && selectedSheet ? (
        <SheetBookingReferenceDetail
          reference={selectedSheet}
          onClose={() => setSelectedSheetKey(null)}
        />
      ) : paginatedGroups.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-neutral-800">No bookings found</p>
          <p className="mt-1 text-xs text-neutral-500">
            {searchQuery
              ? `No bookings match "${searchQuery}". Try clearing search.`
              : "No bookings scheduled for this date."}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-3 text-xs font-semibold text-[#006044] hover:underline"
            >
              Clear search
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedGroups.map((group) => {
            const isExpanded = expandedBookingId === group.primaryBookingId;
            const isSelected = selectedGroup?.displayId === group.displayId;
            return (
              <HorizontalBookingRow
                key={group.displayId}
                group={group}
                isExpanded={isExpanded}
                isSelected={isSelected}
                onSelect={() => {
                  setSelectedSheetKey(null);
                  setSelectedId(group.displayId);
                  setSelectedLineId(group.primaryBookingId);
                  replaceSelectionQuery(group.primaryBookingId);
                }}
                onToggleExpand={() =>
                  setExpandedBookingId((prev) =>
                    prev === group.primaryBookingId ? null : group.primaryBookingId
                  )
                }
                onBookingsChanged={props.onBookingsChanged}
                paymentAction={props.paymentAction}
                onOpenFallbackReschedule={(booking) =>
                  setModalState({ type: "reschedule", booking })
                }
              />
            );
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4">
          <span className="text-xs text-neutral-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* Legacy / overlay modals if triggered */}
      <BookingsModalStack
        state={modalState}
        onStateChange={setModalState}
        onChanged={props.onBookingsChanged}
        onArrived={() => props.onBookingsChanged?.()}
      />
    </div>
  );
}
