"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2 } from "lucide-react";
import { ScheduleToolbar } from "./schedule-toolbar";
import { ScheduleKpiCards } from "./schedule-kpi-cards";
import { ScheduleBoardPanel } from "./schedule-board-panel";
import { ScheduleDetailsPanel } from "./schedule-details-panel";
import { ScheduleAlertsPanel } from "./schedule-alerts-panel";
import { ScheduleBookingHoverCard, type BookingHoverPreview } from "./schedule-booking-hover-card";
import { PremiumSuccessToast } from "@/components/shared/motion/premium-success-toast";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScheduleDensityProvider, ScheduleDensityToggle } from "./schedule-density";
import { CrmScheduleDetailsPanel } from "./crm-schedule-details-panel";
import { EditAvailabilityModal } from "@/components/features/crm/schedule/edit-availability-modal";
import type { ScheduleViewMode } from "./schedule-mode-switcher";
import type { TimelineDisplayMode } from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { getRequiredResourceType } from "@/lib/schedule/live-schedule-conflicts";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];
type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

export type WorkspaceContext = "owner" | "manager" | "crm";

export type ScheduleWorkspaceProps = {
  workspaceContext: WorkspaceContext;
  viewerRole: string;
  branchId: string;
  branchName: string;
  date: string;
  branches?: { id: string; name: string }[];
  staffRows: DailyScheduleStaffRow[];
  availabilityItems?: StaffScheduleItem[];
  branchResources: ResourceRow[];
  stats: {
    total: number;
    confirmed: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    no_show: number;
  };
  viewBookingsHref: string;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  showToolbar?: boolean;
  showKpiCards?: boolean;
  rightRailExtras?: React.ReactNode;
};

function computeAlerts(staffRows: DailyScheduleStaffRow[]): import("./schedule-alerts-panel").ScheduleAlert[] {
  const alerts: import("./schedule-alerts-panel").ScheduleAlert[] = [];

  for (const staff of staffRows) {
    for (const booking of staff.bookings) {
      if (booking.type === "home_service" && booking.status !== "cancelled" && booking.status !== "no_show") {
        alerts.push({
          id: `travel-${booking.id}`,
          type: "travel_buffer",
          title: "Travel Buffer Risk",
          description: `${booking.service} — ${booking.customer}`,
        });
      }
      if (getRequiredResourceType(booking) && !booking.resource_id && booking.status !== "cancelled" && booking.status !== "no_show") {
        alerts.push({
          id: `missing-${booking.id}`,
          type: "missing_assignment",
          title: "Missing Assignment",
          description: `${booking.service} — no room assigned`,
        });
      }
    }
  }

  // Room conflicts: two bookings using same resource at same time
  const resourceBookings = new Map<string, import("@/lib/queries/schedule").DailyScheduleBooking[]>();
  for (const staff of staffRows) {
    for (const booking of staff.bookings) {
      if (booking.resource_id && booking.status !== "cancelled" && booking.status !== "no_show") {
        const list = resourceBookings.get(booking.resource_id) ?? [];
        list.push(booking);
        resourceBookings.set(booking.resource_id, list);
      }
    }
  }
  for (const list of resourceBookings.values()) {
    if (list.length > 1) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          if (a.start_time < b.end_time && b.start_time < a.end_time) {
            alerts.push({
              id: `conflict-${a.id}-${b.id}`,
              type: "room_conflict",
              title: "Room Conflict",
              description: `Overlapping bookings on same resource`,
            });
          }
        }
      }
    }
  }

  return alerts;
}

export function ScheduleWorkspace({
  workspaceContext,
  viewerRole,
  branchId,
  branchName,
  date,
  branches,
  staffRows,
  availabilityItems = [],
  branchResources,
  stats,
  viewBookingsHref,
  statusAction,
  paymentAction,
  showToolbar = true,
  showKpiCards = true,
  rightRailExtras,
}: ScheduleWorkspaceProps) {
  const router = useRouter();
  const [staffSearch, setStaffSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [editingAvailabilityStaffId, setEditingAvailabilityStaffId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("day");
  const [timelineMode, setTimelineMode] = useState<TimelineDisplayMode>("fit");
  const [hoveredPreview, setHoveredPreview] = useState<BookingHoverPreview | null>(null);
  const [adjustmentToast, setAdjustmentToast] = useState<{
    title: string;
    description?: string;
    variant: "success" | "error";
  } | null>(null);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCrm = workspaceContext === "crm";
  const isTimelineExpanded = isCrm && viewMode === "day" && timelineMode === "expanded";

  let filteredRows = staffRows;

  if (staffSearch.trim()) {
    const term = staffSearch.toLowerCase();
    filteredRows = filteredRows.filter((s) => s.staff_name.toLowerCase().includes(term));
  }

  if (statusFilter || typeFilter) {
    filteredRows = filteredRows.map((s) => ({
      ...s,
      bookings: s.bookings.filter((b) => {
        if (statusFilter && b.status !== statusFilter) return false;
        if (typeFilter && b.type !== typeFilter) return false;
        return true;
      }),
    }));
  }

  const selectedBookingWithStaff = (() => {
    if (!selectedBookingId) return null;
    for (const staff of filteredRows) {
      const booking = staff.bookings.find((b) => b.id === selectedBookingId);
      if (booking) return { booking, staff };
    }
    return null;
  })();

  const selectedStaff = (() => {
    if (!selectedStaffId) return null;
    return filteredRows.find((s) => s.staff_id === selectedStaffId) ?? null;
  })();

  const availabilityItemForSelectedStaff = selectedStaff
    ? availabilityItems.find((item) => item.staff.id === selectedStaff.staff_id) ?? null
    : null;

  const selectedAvailabilityItem = (() => {
    if (!editingAvailabilityStaffId) return null;
    return (
      availabilityItems.find(
        (item) => item.staff.id === editingAvailabilityStaffId
      ) ?? null
    );
  })();

  const alertList = computeAlerts(filteredRows);
  const kpiData = {
    total: stats.total,
    confirmed: stats.confirmed,
    in_progress: stats.in_progress,
    completed: stats.completed,
    available_staff: filteredRows.filter((s) => s.work_start && s.work_end).length,
    alerts: alertList.length,
  };

  const handleBookingClick = useCallback((bookingId: string) => {
    setSelectedBookingId(bookingId);
    if (isCrm) {
      // In CRM mode, also select the owning staff so the details panel shows both
      for (const staff of filteredRows) {
        if (staff.bookings.find((b) => b.id === bookingId)) {
          setSelectedStaffId(staff.staff_id);
          break;
        }
      }
    } else {
      setIsSheetOpen(true);
    }
  }, [isCrm, filteredRows]);

  const handleStaffClick = useCallback((staffId: string) => {
    setSelectedStaffId(staffId);
    setSelectedBookingId(null);
  }, []);

  const handleTimelineModeToggle = useCallback(() => {
    setTimelineMode((current) => (current === "expanded" ? "fit" : "expanded"));
  }, []);



  const handleCloseDetails = useCallback(() => {
    setIsSheetOpen(false);
    setSelectedBookingId(null);
    setSelectedStaffId(null);
  }, []);

  const handleDateChange = useCallback((nextDate: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("date", nextDate);
    router.push(`?${params.toString()}`);
  }, [router]);

  // Hover card handlers — plain functions so they always close over current filteredRows/date
  function handleHoverEnter(bookingId: string, x: number, y: number) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    for (const staff of filteredRows) {
      const booking = staff.bookings.find((b) => b.id === bookingId);
      if (booking) {
        setHoveredPreview({ booking, staffName: staff.staff_name, date, x, y });
        break;
      }
    }
  }

  const handleHoverLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setHoveredPreview(null), 200);
  }, []);

  const handleHoverCardMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleHoverCardMouseLeave = useCallback(() => {
    setHoveredPreview(null);
  }, []);

  const handleOpenDetailsFromHover = useCallback(() => {
    if (hoveredPreview) {
      setSelectedBookingId(hoveredPreview.booking.id);
      if (!isCrm) {
        setIsSheetOpen(true);
      }
      setHoveredPreview(null);
    }
  }, [hoveredPreview, isCrm]);

  const handleScheduleAdjusted = useCallback(
    (feedback: { title: string; description?: string; variant?: "success" | "error" }) => {
      setAdjustmentToast({
        title: feedback.title,
        description: feedback.description,
        variant: feedback.variant ?? "success",
      });
      window.setTimeout(() => setAdjustmentToast(null), 3500);
      if ((feedback.variant ?? "success") === "success") {
        router.refresh();
      }
    },
    [router]
  );

  const handleAvailabilitySaved = useCallback(
    (message?: string) => {
      setAdjustmentToast({
        title: "Schedule updated successfully.",
        description: message && message !== "Schedule updated successfully." ? message : undefined,
        variant: "success",
      });
      window.setTimeout(() => setAdjustmentToast(null), 3500);
      router.refresh();
    },
    [router]
  );

  const workspaceContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header — only shown in non-CRM context; CRM page renders its own PageHeader */}
      {!isCrm && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--cs-text)", fontFamily: "var(--font-display)", margin: 0 }}>
              Schedule
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", margin: "0.25rem 0 0" }}>
              Manage staff availability, bookings, and resources for today.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {showToolbar && (
        <ScheduleToolbar
          workspaceContext={workspaceContext}
          branchId={branchId}
          branchName={branchName}
          date={date}
          branches={branches}
          staffSearch={staffSearch}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStaffSearchChange={setStaffSearch}
          onStatusFilterChange={setStatusFilter}
          onTypeFilterChange={setTypeFilter}
          onDateChange={handleDateChange}
          viewBookingsHref={viewBookingsHref}
        />
      )}

      {/* KPI Cards */}
      {showKpiCards && <ScheduleKpiCards data={kpiData} />}

      {/* Board area */}
      {isCrm ? (
        <div
          className={
            isTimelineExpanded
              ? "grid grid-cols-1 items-start gap-4"
              : "grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"
          }
          style={{ width: "100%", maxWidth: "100%" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>
                {branchName} · {new Date(date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" })}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <ScheduleDensityToggle />
                {viewMode === "day" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        color: "var(--cs-crm-text)",
                        background: "var(--cs-crm-bg)",
                        border: "1px solid var(--cs-border-soft)",
                        borderRadius: 999,
                        padding: "3px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {timelineMode === "expanded" ? "Expanded" : "Fit Day"}
                    </span>
                    <button
                      type="button"
                      onClick={handleTimelineModeToggle}
                      aria-label={
                        timelineMode === "expanded"
                          ? "Collapse timeline to fit day view"
                          : "Expand timeline for detailed view"
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        border: `1px solid ${timelineMode === "expanded" ? "var(--cs-sand)" : "var(--cs-border-soft)"}`,
                        background: timelineMode === "expanded" ? "var(--cs-sand-mist)" : "var(--cs-surface)",
                        color: timelineMode === "expanded" ? "var(--cs-sand)" : "var(--cs-text-secondary)",
                        borderRadius: 6,
                        padding: "4px 9px",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {timelineMode === "expanded" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      {timelineMode === "expanded" ? "Collapse" : "Expand"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <ScheduleBoardPanel
              branchId={branchId}
              branchName={branchName}
              date={date}
              staffRows={filteredRows}
              branchResources={branchResources}
              onBookingClick={handleBookingClick}
              selectedBookingId={selectedBookingId}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              onScheduleAdjusted={handleScheduleAdjusted}
              onStaffClick={handleStaffClick}
              timelineMode={timelineMode}
            />

            {alertList.length > 0 && <ScheduleAlertsPanel alerts={alertList} />}
          </div>

          {!isTimelineExpanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", minWidth: 0 }}>
              <CrmScheduleDetailsPanel
                staff={selectedStaff}
                booking={selectedBookingWithStaff?.booking ?? null}
                availabilityItem={availabilityItemForSelectedStaff}
                branchResources={branchResources}
                date={date}
                branchName={branchName}
                onClose={handleCloseDetails}
                canEditAvailability={availabilityItemForSelectedStaff !== null}
                onEditAvailability={() => {
                  if (availabilityItemForSelectedStaff) {
                    setEditingAvailabilityStaffId(availabilityItemForSelectedStaff.staff.id);
                  }
                }}
              />
              {rightRailExtras}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ScheduleBoardPanel
            branchId={branchId}
            branchName={branchName}
            date={date}
            staffRows={filteredRows}
            branchResources={branchResources}
            onBookingClick={handleBookingClick}
            selectedBookingId={selectedBookingId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onHoverEnter={handleHoverEnter}
            onHoverLeave={handleHoverLeave}
            onScheduleAdjusted={handleScheduleAdjusted}
          />

          {alertList.length > 0 && <ScheduleAlertsPanel alerts={alertList} />}
        </div>
      )}

      {/* Booking details — opens in a right-side sheet on click (non-CRM only) */}
      {!isCrm && (
        <Sheet
          open={isSheetOpen}
          onOpenChange={(open: boolean) => { if (!open) handleCloseDetails(); }}
        >
          <SheetContent side="right" showCloseButton={false}>
            <ScheduleDetailsPanel
              booking={selectedBookingWithStaff?.booking ?? null}
              staffName={selectedBookingWithStaff?.staff.staff_name ?? ""}
              branchResources={branchResources}
              date={date}
              viewerRole={viewerRole}
              statusAction={statusAction}
              paymentAction={paymentAction}
              onClose={handleCloseDetails}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Hover card — desktop only, appears near the booking block */}
      {hoveredPreview && (
        <ScheduleBookingHoverCard
          preview={hoveredPreview}
          onOpenDetails={handleOpenDetailsFromHover}
          onMouseEnter={handleHoverCardMouseEnter}
          onMouseLeave={handleHoverCardMouseLeave}
        />
      )}

      {isCrm ? (
        <EditAvailabilityModal
          open={editingAvailabilityStaffId !== null}
          item={selectedAvailabilityItem}
          branchId={branchId}
          branchName={branchName}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingAvailabilityStaffId(null);
            }
          }}
          onSaved={handleAvailabilitySaved}
        />
      ) : null}

      <PremiumSuccessToast
        open={adjustmentToast !== null}
        title={adjustmentToast?.title ?? ""}
        description={adjustmentToast?.description}
        variant={adjustmentToast?.variant}
      />
    </div>
  );

  return isCrm ? (
    <ScheduleDensityProvider defaultDensity="compact">
      {workspaceContent}
    </ScheduleDensityProvider>
  ) : (
    workspaceContent
  );
}
