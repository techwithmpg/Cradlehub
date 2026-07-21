import { getCrmPendingBookingQueue, getTodaysSchedule } from "@/lib/queries/bookings";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { getActionRequiredNotificationsAction } from "@/lib/notifications/queries";
import { getCrmTodaySnapshot } from "@/lib/queries/crm-today";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReadinessResult } from "@/types/readiness";
import { CrmTodayShell } from "@/components/features/crm/today/crm-today-shell";
import { getBranchBookingDriverIds, getDriverNamesByIds, getAvailableBranchDrivers, assignBookingDriverAction } from "@/lib/actions/driver-actions";
import { getLatestLocationsForActiveHomeServiceTrips } from "@/lib/actions/location-actions";
import { getOrCreateCustomerTrackingLinkAction, getActiveTrackingTokensForBookings } from "@/lib/actions/tracking-link-actions";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { SYSTEM_ROLE_LABELS, canonicalizeSystemRole } from "@/constants/staff";
import { updateWorkQueueBookingStatusAction } from "./actions";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import {
  createAttendanceScanFeedFallback,
  getRecentAttendanceScanFeed,
} from "@/lib/attendance/recent-scans";
import { getOpenStaffScheduleException } from "@/lib/bookings/staff-schedule-exception";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

// ── Local types ───────────────────────────────────────────────────────────────

type Relation<T> = T | T[] | null;
type CustomerRel = { full_name: string; phone: string | null };
type ServiceRel  = { name: string; duration_minutes: number };
type StaffRel    = { full_name: string; nickname?: string | null };
type ResourceRel = { name: string };

type BookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  resource_id: string | null;
  delivery_type?: string | null;
  travel_buffer_mins: number | null;
  payment_status?: string;
  payment_method?: string;
  amount_paid?: number;
  payment_reference?: string | null;
  booking_progress_status?: string;
  metadata?: Record<string, unknown> | null;
  customers: Relation<CustomerRel>;
  services:  Relation<ServiceRel>;
  staff:     Relation<StaffRel>;
  branch_resources: Relation<ResourceRel>;
};

function first<T>(v: Relation<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmTodayPage() {
  const { branchId, branchName, role } = await getFrontDeskContext();
  const today   = getBranchBusinessDate();

  const [
    rawBookings,
    pendingQueue,
    snapshot,
    actionNotifications,
    readiness,
    driverIdMap,
    availableDrivers,
    locationMap,
    attendanceScanFeed,
  ] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getCrmPendingBookingQueue(branchId, today),
    getCrmTodaySnapshot({ branchId, date: today }),
    getActionRequiredNotificationsAction(3),
    getCrmReadinessCached(branchId).catch(() => null),
    getBranchBookingDriverIds(branchId, today),
    getAvailableBranchDrivers(branchId),
    getLatestLocationsForActiveHomeServiceTrips(branchId, today),
    getRecentAttendanceScanFeed({
      workspace: "crm",
      branchId,
      branchName,
      selectedDate: today,
      maxItems: 5,
    }).catch(() =>
      createAttendanceScanFeedFallback({
        workspace: "crm",
        branchId,
        branchName,
        selectedDate: today,
        error: "Attendance activity could not be refreshed.",
      })
    ),
  ]);

  const bookingsById = new Map<string, BookingRow>();
  for (const booking of rawBookings as BookingRow[]) {
    bookingsById.set(booking.id, booking);
  }
  for (const booking of pendingQueue as BookingRow[]) {
    if (!bookingsById.has(booking.id)) {
      bookingsById.set(booking.id, booking);
    }
  }

  const bookings = Array.from(bookingsById.values()).sort((a, b) => {
    const dateCompare = a.booking_date.localeCompare(b.booking_date);
    return dateCompare !== 0 ? dateCompare : a.start_time.localeCompare(b.start_time);
  });

  const resourceIds = [...new Set(bookings.map((booking) => booking.resource_id).filter(Boolean) as string[])];
  const resourceNameMap = new Map<string, string>();
  if (resourceIds.length > 0) {
    const supabase = createAdminClient();
    const { data: resources } = await supabase
      .from("branch_resources")
      .select("id, name")
      .in("id", resourceIds);
    for (const resource of resources ?? []) {
      resourceNameMap.set(resource.id, resource.name);
    }
  }

  const hsBookingIds = bookings
    .filter((b) => b.type === "home_service" || b.delivery_type === "home_service")
    .map((b) => b.id);
  const trackingMap = await getActiveTrackingTokensForBookings(hsBookingIds);
  const driverIds = [...new Set(Object.values(driverIdMap).filter(Boolean) as string[])];
  const driverNameMap = await getDriverNamesByIds(driverIds);

  // Build queue data for the interactive panel
  const queueData = bookings.map((b) => {
    const meta = b.metadata ?? null;
    const hsAddr = meta?.home_service_address as Record<string, unknown> | null;
    const dispatch = meta?.dispatch as Record<string, unknown> | null;
    const staffScheduleException = getOpenStaffScheduleException(meta);
    const priceRaw = meta?.price_paid;
    const pricePaid = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : 0;
    const rawLat = hsAddr?.lat;
    const rawLng = hsAddr?.lng;
    const destLat =
      typeof rawLat === "number" ? rawLat :
      typeof rawLat === "string" ? parseFloat(rawLat) : null;
    const destLng =
      typeof rawLng === "number" ? rawLng :
      typeof rawLng === "string" ? parseFloat(rawLng) : null;
    const liveEta = parseLiveEta(dispatch?.live_eta);
    const isHomeService = b.type === "home_service" || b.delivery_type === "home_service";

    return {
      id:                    b.id,
      booking_date:          b.booking_date,
      start_time:            b.start_time,
      end_time:              b.end_time,
      status:                b.status,
      type:                  b.type,
      travel_buffer_mins:    b.travel_buffer_mins,
      payment_status:        b.payment_status,
      payment_method:        b.payment_method,
      amount_paid:           b.amount_paid,
      price_paid:            pricePaid,
      payment_reference:     b.payment_reference ?? null,
      customer_name:         first(b.customers)?.full_name ?? null,
      service_name:          first(b.services)?.name ?? null,
      service_duration:      first(b.services)?.duration_minutes ?? null,
      staff_name:            first(b.staff) ? getStaffAdminName(first(b.staff)!) : null,
      resource_name:         b.resource_id
        ? (resourceNameMap.get(b.resource_id) ?? first(b.branch_resources)?.name ?? null)
        : first(b.branch_resources)?.name ?? null,
      booking_progress_status: b.booking_progress_status,
      hs_zone:               typeof hsAddr?.zone === "string" ? hsAddr.zone : null,
      hs_address:            typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
      hs_city:               typeof hsAddr?.city === "string" ? hsAddr.city : null,
      hs_map_url:            typeof hsAddr?.map_url === "string" ? hsAddr.map_url : null,
      dispatch_warning:      typeof dispatch?.dispatch_warning === "string" ? dispatch.dispatch_warning : null,
      needs_location_review: dispatch?.needs_location_review === true,
      needs_staff_schedule_review: Boolean(staffScheduleException),
      staff_schedule_exception_label: staffScheduleException?.reasonLabel ?? null,
      staff_schedule_exception_reason: staffScheduleException?.reasonCode ?? null,
      driver_id:             driverIdMap[b.id] ?? null,
      driver_name:           driverIdMap[b.id] ? (driverNameMap[driverIdMap[b.id]!] ?? null) : null,
      no_driver_warning:     isHomeService && !driverIdMap[b.id],
      last_location_at:      locationMap[b.id]?.recorded_at ?? null,
      tracking_token:        trackingMap[b.id]?.token ?? null,
      tracking_url:          trackingMap[b.id]?.url ?? null,
      tracking_message:      trackingMap[b.id]?.message ?? null,
      dest_lat:              typeof destLat === "number" && Number.isFinite(destLat) ? destLat : null,
      dest_lng:              typeof destLng === "number" && Number.isFinite(destLng) ? destLng : null,
      live_eta:              liveEta,
    };
  });

  const canonicalRole = canonicalizeSystemRole(role);
  const roleLabel =
    SYSTEM_ROLE_LABELS[canonicalRole as keyof typeof SYSTEM_ROLE_LABELS] ??
    "CRM";

  const readinessResult = readiness ?? buildReadinessResult([]);
  const readinessIssues = readinessResult.issues;
  const readinessStatus = readinessResult.status;

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <RetainedWorkspaceModule moduleId="crm-work-queue">
      <CrmOperationalPageShell
        title="Work Queue"
        description="One prioritized list for confirmations, follow-up, exceptions, and home-service work."
        context={`${branchName} · ${dateLabel} · ${roleLabel}`}
      >
        <CrmTodayShell
          branchName={branchName}
          dateLabel={dateLabel}
          roleLabel={roleLabel}
          queueData={queueData}
          snapshot={snapshot}
          actionNotifications={actionNotifications}
          attendanceScanFeed={attendanceScanFeed}
          attendanceScanDate={today}
          readinessIssues={readinessIssues}
          readinessStatus={readinessStatus}
          viewerRole={role}
          paymentAction={updateBookingPaymentAction}
          statusAction={updateWorkQueueBookingStatusAction}
          assignDriverAction={assignBookingDriverAction}
          availableDrivers={availableDrivers}
          getTrackingLinkAction={getOrCreateCustomerTrackingLinkAction}
          showHeader={false}
        />
      </CrmOperationalPageShell>
    </RetainedWorkspaceModule>
  );
}
