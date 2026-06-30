"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import { AdminDialog, AdminOverlayBody, AdminOverlayHeader } from "@/components/shared/overlays";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import { CrmEditStaffProfileModal } from "@/components/features/crm/staff/crm-edit-staff-profile-modal";
import { StaffServiceEditorSheet } from "@/components/features/staff/staff-service-editor-sheet";
import { EditAvailabilityModal } from "@/components/features/crm/schedule/edit-availability-modal";
import { CheckAvailabilityModal } from "@/components/features/crm/schedule/check-availability-modal";
import { StaffScheduleCalendarModal } from "@/components/features/staff-schedule/staff-schedule-calendar-modal";
import {
  getCrmScheduleStaffProfileAction,
  type CrmScheduleStaffProfileData,
} from "@/app/(dashboard)/crm/schedule/actions";
import { updateStaffServicesFromCrmAction } from "@/lib/actions/crm-staff-services";
import { getStaffAdminName } from "@/lib/staff/display-name";
import type { AvailabilityTab } from "@/components/features/crm/schedule/edit-availability-types";
import { useScheduleRealtime } from "../daily-schedule-board";
import { buildDailyTimelineAlerts } from "./daily-timeline-alerts";
import { DailyTimelineBoard } from "./daily-timeline-board";
import {
  buildStaffTypeMap,
  filterTimelineRows,
  getStaffGroupKey,
  STAFF_GROUPS,
  type StaffGroupKey,
  type TimelineFilters,
} from "./daily-timeline-operations";
import { DailyTimelineOperationsRail } from "./daily-timeline-operations-rail";
import { DailyTimelineSummary } from "./daily-timeline-summary";
import { DailyTimelineToolbar } from "./daily-timeline-toolbar";

const DEFAULT_FILTERS: TimelineFilters = { query: "", shift: "all", status: "all" };

type Props = {
  branchId: string;
  branchName: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  availabilityItems: StaffScheduleItem[];
  loadError: string | null;
  initialNow: string;
  selectedStaffId: string | null;
  selectedBookingId: string | null;
  onSelectedStaffChange: (staffId: string | null) => void;
  onSelectedBookingChange: (bookingId: string | null) => void;
};

function parseStaffGroup(value: string | null): StaffGroupKey {
  return STAFF_GROUPS.some((group) => group.key === value) ? (value as StaffGroupKey) : "all";
}

export function DailyTimelineTab({
  branchId,
  branchName,
  date,
  staffRows,
  availabilityItems,
  loadError,
  initialNow,
  selectedStaffId,
  selectedBookingId,
  onSelectedStaffChange,
  onSelectedBookingChange,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openBookingModal } = useAdministrativeBookingModal();
  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const [now, setNow] = useState<Date>(() => new Date(initialNow));
  const [profileStaffId, setProfileStaffId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<CrmScheduleStaffProfileData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [capabilitiesStaffId, setCapabilitiesStaffId] = useState<string | null>(null);
  const [capabilitiesData, setCapabilitiesData] = useState<CrmScheduleStaffProfileData | null>(null);
  const [capabilitiesDraft, setCapabilitiesDraft] = useState<string[]>([]);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [fullScheduleStaffId, setFullScheduleStaffId] = useState<string | null>(null);
  const [availabilityEditor, setAvailabilityEditor] = useState<{
    staffId: string;
    initialTab: AvailabilityTab;
  } | null>(null);
  const [checkAvailabilityOpen, setCheckAvailabilityOpen] = useState(false);
  const [isSavingCapabilities, startSavingCapabilities] = useTransition();
  const activeGroup = parseStaffGroup(searchParams.get("staffType"));

  useScheduleRealtime(branchId, date);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profileStaffId) return;

    let cancelled = false;

    void getCrmScheduleStaffProfileAction({ staffId: profileStaffId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setProfileData(result.data);
        } else {
          setProfileError(result.error);
        }
      })
      .catch(() => {
        if (!cancelled) setProfileError("Staff profile could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileStaffId]);

  useEffect(() => {
    if (!capabilitiesStaffId) return;

    let cancelled = false;

    void getCrmScheduleStaffProfileAction({ staffId: capabilitiesStaffId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setCapabilitiesData(result.data);
          setCapabilitiesDraft(result.data.staffServiceIds);
        } else {
          setCapabilitiesError(result.error);
        }
      })
      .catch(() => {
        if (!cancelled) setCapabilitiesError("Service capabilities could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setCapabilitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [capabilitiesStaffId]);

  const staffTypeById = useMemo(() => buildStaffTypeMap(availabilityItems), [availabilityItems]);
  const groupOptions = useMemo(() => {
    const counts = new Map<StaffGroupKey, number>();
    for (const row of staffRows) {
      const key = getStaffGroupKey(staffTypeById.get(row.staff_id));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return STAFF_GROUPS
      .map((group) => ({ ...group, count: group.key === "all" ? staffRows.length : counts.get(group.key) ?? 0 }))
      .filter((group) => group.key === "all" || group.count > 0);
  }, [staffRows, staffTypeById]);

  const visibleRows = useMemo(
    () => filterTimelineRows({ rows: staffRows, staffTypeById, group: activeGroup, filters, date, now }),
    [activeGroup, date, filters, now, staffRows, staffTypeById]
  );
  const alerts = useMemo(() => buildDailyTimelineAlerts(visibleRows), [visibleRows]);
  const selectedStaff = selectedStaffId
    ? visibleRows.find((row) => row.staff_id === selectedStaffId) ?? null
    : null;
  const selectedBooking =
    selectedStaff?.bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const activeGroupLabel = groupOptions.find((group) => group.key === activeGroup)?.label ?? "All Staff";
  const selectedBookingTime = selectedBooking?.start_time.slice(0, 5) ?? null;
  const selectedAvailabilityItem = selectedStaff
    ? availabilityItems.find((item) => item.staff.id === selectedStaff.staff_id) ?? null
    : null;
  const availabilityEditorItem = availabilityEditor
    ? availabilityItems.find((item) => item.staff.id === availabilityEditor.staffId) ?? null
    : null;
  const fullScheduleStaff = useMemo(() => {
    if (!fullScheduleStaffId) return null;
    const item = availabilityItems.find((candidate) => candidate.staff.id === fullScheduleStaffId);
    const row = staffRows.find((candidate) => candidate.staff_id === fullScheduleStaffId);
    if (!item && !row) return null;

    return {
      id: fullScheduleStaffId,
      full_name: item?.staff.full_name ?? row?.staff_name ?? "Staff member",
      nickname: item?.staff.nickname ?? null,
      avatar_url: null,
      staff_type: item?.staff.staff_type ?? staffTypeById.get(fullScheduleStaffId) ?? null,
      system_role: null,
      branch_name: branchName,
    };
  }, [availabilityItems, branchName, fullScheduleStaffId, staffRows, staffTypeById]);

  useEffect(() => {
    if (!selectedStaffId) return;
    if (visibleRows.some((row) => row.staff_id === selectedStaffId)) return;
    onSelectedStaffChange(null);
    onSelectedBookingChange(null);
  }, [onSelectedBookingChange, onSelectedStaffChange, selectedStaffId, visibleRows]);

  const handleGroupChange = useCallback((group: StaffGroupKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (group === "all") params.delete("staffType");
    else params.set("staffType", group);
    router.replace(`?${params.toString()}`, { scroll: false });
    onSelectedStaffChange(null);
    onSelectedBookingChange(null);
  }, [onSelectedBookingChange, onSelectedStaffChange, router, searchParams]);

  const handleOpenScheduleSetup = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "setup");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const requireSelectedStaff = useCallback(
    (action: string): string | null => {
      if (selectedStaff) return selectedStaff.staff_id;
      toast.error("Select a staff member first", { description: action });
      return null;
    },
    [selectedStaff]
  );

  const handleAddBooking = useCallback(() => {
    openBookingModal({
      mode: "standard_future",
      date,
      staffId: selectedStaff?.staff_id,
      time: selectedBookingTime ?? undefined,
    });
  }, [date, openBookingModal, selectedBookingTime, selectedStaff?.staff_id]);

  const handleCheckAvailability = useCallback(() => {
    setCheckAvailabilityOpen(true);
  }, []);

  const handleEditStaffProfile = useCallback(() => {
    const staffId = requireSelectedStaff("Choose a staff row before editing a profile.");
    if (!staffId) return;
    setProfileData(null);
    setProfileError(null);
    setProfileLoading(true);
    setProfileStaffId(staffId);
  }, [requireSelectedStaff]);

  const openCapabilitiesEditor = useCallback((staffId: string) => {
    setCapabilitiesData(null);
    setCapabilitiesDraft([]);
    setCapabilitiesError(null);
    setCapabilitiesLoading(true);
    setCapabilitiesStaffId(staffId);
  }, []);

  const handleEditStaffCapabilities = useCallback(() => {
    const staffId = requireSelectedStaff("Choose a staff row before editing service capabilities.");
    if (!staffId) return;
    openCapabilitiesEditor(staffId);
  }, [openCapabilitiesEditor, requireSelectedStaff]);

  const handleViewFullSchedule = useCallback(() => {
    const staffId = requireSelectedStaff("Choose a staff row before viewing the full schedule.");
    if (!staffId) return;
    setFullScheduleStaffId(staffId);
  }, [requireSelectedStaff]);

  const handleAdjustStaff = useCallback(() => {
    const staffId = requireSelectedStaff("Choose a staff row before adjusting availability.");
    if (!staffId) return;
    if (!selectedAvailabilityItem) {
      toast.error("Schedule details are not available for this staff member.");
      return;
    }
    setAvailabilityEditor({ staffId, initialTab: "weekly" });
  }, [requireSelectedStaff, selectedAvailabilityItem]);

  const handleBlockStaffTime = useCallback(() => {
    const staffId = requireSelectedStaff("Choose a staff row before blocking staff time.");
    if (!staffId) return;
    if (!selectedAvailabilityItem) {
      toast.error("Schedule details are not available for this staff member.");
      return;
    }
    setAvailabilityEditor({ staffId, initialTab: "blocks" });
  }, [requireSelectedStaff, selectedAvailabilityItem]);

  const handleAvailabilitySaved = useCallback(
    (message?: string) => {
      toast.success(message ?? "Availability updated.");
      setAvailabilityEditor(null);
      router.refresh();
    },
    [router]
  );

  const handleProfileUpdated = useCallback(() => {
    toast.success("Staff profile updated.");
    setProfileStaffId(null);
    setProfileData(null);
    router.refresh();
  }, [router]);

  const handleToggleCapability = useCallback((serviceId: string) => {
    setCapabilitiesDraft((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  }, []);

  const handleSaveCapabilities = useCallback(
    (serviceIds: string[]) => {
      if (!capabilitiesStaffId) return;
      startSavingCapabilities(async () => {
        const result = await updateStaffServicesFromCrmAction({
          staffId: capabilitiesStaffId,
          serviceIds,
        });

        if (!result.ok) {
          toast.error(result.message ?? "Could not update service capabilities.");
          return;
        }

        toast.success("Service capabilities updated.");
        setCapabilitiesDraft(result.serviceIds);
        setCapabilitiesData((current) =>
          current ? { ...current, staffServiceIds: result.serviceIds } : current
        );
        setCapabilitiesStaffId(null);
        setCapabilitiesData(null);
        router.refresh();
      });
    },
    [capabilitiesStaffId, router]
  );

  if (loadError) {
    return (
      <DailyTimelineErrorState
        message={loadError}
        onRetry={() => router.refresh()}
        onOpenScheduleSetup={handleOpenScheduleSetup}
      />
    );
  }

  return (
    <section className="space-y-3" aria-label="Daily Timeline operations board">
      <DailyTimelineToolbar
        branchName={branchName}
        groups={groupOptions}
        activeGroup={activeGroup}
        filters={filters}
        onGroupChange={handleGroupChange}
        onFiltersChange={setFilters}
        onCheckAvailability={handleCheckAvailability}
        onBlockStaffTime={handleBlockStaffTime}
        onOpenScheduleSetup={handleOpenScheduleSetup}
      />

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <DailyTimelineBoard
            rows={visibleRows}
            date={date}
            now={now}
            staffTypeById={staffTypeById}
            alerts={alerts}
            selectedStaffId={selectedStaffId}
            onStaffSelect={(staffId) => {
              onSelectedStaffChange(staffId);
              onSelectedBookingChange(null);
            }}
            onBookingSelect={(staffId, bookingId) => {
              onSelectedStaffChange(staffId);
              onSelectedBookingChange(bookingId);
            }}
          />
          <DailyTimelineSummary rows={visibleRows} date={date} now={now} groupLabel={activeGroupLabel} alerts={alerts} />
        </div>
        <DailyTimelineOperationsRail
          rows={visibleRows}
          alerts={alerts}
          groupLabel={activeGroupLabel}
          selectedStaff={selectedStaff}
          selectedBooking={selectedBooking}
          selectedStaffType={selectedStaff ? staffTypeById.get(selectedStaff.staff_id) ?? null : null}
          date={date}
          now={now}
          onStaffSelect={(staffId) => {
            onSelectedStaffChange(staffId);
            onSelectedBookingChange(null);
          }}
          onEditStaffProfile={handleEditStaffProfile}
          onEditStaffCapabilities={handleEditStaffCapabilities}
          onViewFullSchedule={handleViewFullSchedule}
          onAddBooking={handleAddBooking}
          onCheckAvailability={handleCheckAvailability}
          onAdjustStaff={handleAdjustStaff}
          onBlockStaffTime={handleBlockStaffTime}
        />
      </div>
      <CheckAvailabilityModal
        open={checkAvailabilityOpen}
        onOpenChange={setCheckAvailabilityOpen}
        initialDate={date}
        initialStaffId={selectedStaff?.staff_id}
        initialTime={selectedBookingTime}
      />
      <StaffScheduleCalendarModal
        open={fullScheduleStaffId !== null}
        onOpenChange={(open) => {
          if (!open) setFullScheduleStaffId(null);
        }}
        staff={fullScheduleStaff}
        initialDate={date}
        branchName={branchName}
      />
      <EditAvailabilityModal
        item={availabilityEditorItem}
        open={availabilityEditor !== null && availabilityEditorItem !== null}
        branchId={branchId}
        branchName={branchName}
        initialTab={availabilityEditor?.initialTab}
        initialDate={date}
        onOpenChange={(open) => {
          if (!open) setAvailabilityEditor(null);
        }}
        onSaved={handleAvailabilitySaved}
      />
      <CrmEditStaffProfileModal
        open={profileStaffId !== null && profileData !== null}
        onOpenChange={(open) => {
          if (!open) setProfileStaffId(null);
        }}
        staffMember={profileData?.staffMember ?? null}
        branches={profileData?.branches ?? []}
        services={profileData?.services ?? []}
        staffServiceIds={profileData?.staffServiceIds ?? []}
        serviceAssignmentsError={profileData?.serviceAssignmentsError}
        reviewerSystemRole={profileData?.reviewerSystemRole ?? "staff"}
        onEditServices={() => {
          const staffId = profileData?.staffMember.id;
          if (!staffId) return;
          setProfileStaffId(null);
          setProfileData(null);
          openCapabilitiesEditor(staffId);
        }}
        onSuccess={handleProfileUpdated}
      />
      <StaffServiceEditorSheet
        open={capabilitiesStaffId !== null && capabilitiesData !== null}
        services={capabilitiesData?.services ?? []}
        selectedIds={capabilitiesDraft}
        onToggle={handleToggleCapability}
        onClose={() => {
          setCapabilitiesStaffId(null);
          setCapabilitiesData(null);
        }}
        onSave={handleSaveCapabilities}
        saving={isSavingCapabilities}
        staffName={capabilitiesData ? getStaffAdminName(capabilitiesData.staffMember) : undefined}
      />
      <StaffProfileLoadingDialog
        open={profileStaffId !== null && profileData === null}
        loading={profileLoading}
        error={profileError}
        onClose={() => setProfileStaffId(null)}
      />
      <StaffProfileLoadingDialog
        open={capabilitiesStaffId !== null && capabilitiesData === null}
        loading={capabilitiesLoading}
        error={capabilitiesError}
        loadingTitle="Loading Service Capabilities"
        errorTitle="Capabilities Unavailable"
        loadingDescription="Preparing assigned and available services."
        onClose={() => setCapabilitiesStaffId(null)}
      />
    </section>
  );
}

function DailyTimelineErrorState({
  message,
  onRetry,
  onOpenScheduleSetup,
}: {
  message: string;
  onRetry: () => void;
  onOpenScheduleSetup: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <AlertTriangle className="mx-auto size-6 text-red-700" />
      <h2 className="mt-3 text-sm font-bold text-red-950">We could not load the daily schedule.</h2>
      <p className="mt-1 text-xs text-red-800">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onRetry} className="inline-flex h-9 items-center gap-2 rounded-md bg-red-800 px-3 text-xs font-semibold text-white">
          <RefreshCw className="size-3.5" /> Refresh timeline
        </button>
        <button type="button" onClick={onOpenScheduleSetup} className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-900">
          <Settings2 className="size-3.5" /> Open Schedule Setup
        </button>
      </div>
    </div>
  );
}

function StaffProfileLoadingDialog({
  open,
  loading,
  error,
  loadingTitle = "Loading Staff Profile",
  errorTitle = "Profile Unavailable",
  loadingDescription = "Preparing staff profile details.",
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  loadingTitle?: string;
  errorTitle?: string;
  loadingDescription?: string;
  onClose: () => void;
}) {
  return (
    <AdminDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} size="sm" placement="center">
      <AdminOverlayHeader
        title={error ? errorTitle : loadingTitle}
        description={error ?? loadingDescription}
      />
      <AdminOverlayBody className="bg-[var(--cs-surface-warm)]">
        <div className="flex min-h-28 items-center justify-center rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-4 py-6 text-sm font-semibold text-[var(--cs-text-muted)]">
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading profile...
            </>
          ) : (
            error ?? "Staff profile could not be loaded."
          )}
        </div>
      </AdminOverlayBody>
    </AdminDialog>
  );
}
