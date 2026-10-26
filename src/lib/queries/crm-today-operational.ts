import "server-only";

import {
  getCrmPendingBookingQueue,
  getCrmUpcomingBookings,
  getCrmOrderServiceLines,
  getTodaysSchedule,
} from "@/lib/queries/bookings";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { getActionRequiredNotificationsAction } from "@/lib/notifications/queries";
import { getCrmTodaySnapshot, type CrmTodaySnapshot } from "@/lib/queries/crm-today";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReadinessResult, type ReadinessIssue, type ReadinessStatus } from "@/types/readiness";
import { getBranchBookingDriverIds, getDriverNamesByIds } from "@/lib/actions/driver-actions";
import { getLatestLocationsForActiveHomeServiceTrips } from "@/lib/actions/location-actions";
import { getActiveTrackingTokensForBookings } from "@/lib/actions/tracking-link-actions";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { upcomingBookingEndDate } from "@/lib/bookings/upcoming-bookings";
import { getOpenStaffScheduleException } from "@/lib/bookings/staff-schedule-exception";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

type Relation<T> = T | T[] | null;
type CustomerRel = { full_name: string; phone: string | null };
type ServiceRel = { name: string; duration_minutes: number };
type StaffRel = { id: string; full_name: string; nickname?: string | null };
type ResourceRel = { name: string };

type BookingRow = {
  id: string;
  requested_staff_id?: string | null;
  therapist_selection_source?: string | null;
  order_id?: string | null;
  attendee_id?: string | null;
  booking_attendees?: Relation<{
    id: string;
    sequence: number;
    display_name: string | null;
    customer_id: string | null;
  }>;
  booking_orders?: Relation<{
    id: string;
    order_number: string;
    organizer_customer_id: string;
    metadata: Record<string, unknown> | null;
  }>;
  branch_id: string;
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
  checked_in_at?: string | null;
  session_started_at?: string | null;
  session_due_at?: string | null;
  session_completed_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  customers: Relation<CustomerRel>;
  services: Relation<ServiceRel>;
  staff: Relation<StaffRel>;
  driver_id?: string | null;
  driver?: Relation<StaffRel>;
  branch_resources: Relation<ResourceRel>;
};

function first<T>(v: Relation<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type CrmTodayOperationalData = {
  queueData: CradleFlowBooking[];
  snapshot: CrmTodaySnapshot;
  actionNotifications: { id: string; title: string; message?: string }[];
  readinessIssues: ReadinessIssue[];
  readinessStatus: ReadinessStatus;
  readinessAvailable: boolean;
};

export async function getCrmTodayOperationalData(params: {
  branchId: string;
  date?: string;
}): Promise<CrmTodayOperationalData> {
  const { branchId } = params;
  const date = params.date ?? getBranchBusinessDate();

  const [
    rawBookings,
    pendingQueue,
    upcomingBookings,
    snapshot,
    actionNotifications,
    readiness,
    driverIdMap,
    locationMap,
  ] = await Promise.all([
    getTodaysSchedule(branchId, date),
    getCrmPendingBookingQueue(branchId, date, undefined, upcomingBookingEndDate(date)),
    getCrmUpcomingBookings(branchId, date),
    getCrmTodaySnapshot({ branchId, date }),
    getActionRequiredNotificationsAction(3),
    getCrmReadinessCached(branchId).catch(() => null),
    getBranchBookingDriverIds(branchId, date),
    getLatestLocationsForActiveHomeServiceTrips(branchId, date),
  ]);

  const futureOrderIds = [
    ...new Set(
      [...pendingQueue, ...upcomingBookings].flatMap((row) =>
        row.booking_date > date && row.order_id ? [row.order_id] : []
      )
    ),
  ];
  const futureOrderLines =
    futureOrderIds.length > 0 ? await getCrmOrderServiceLines(branchId, futureOrderIds) : [];

  const bookingsById = new Map<string, BookingRow>();
  for (const booking of rawBookings as BookingRow[]) {
    bookingsById.set(booking.id, booking);
  }
  for (const booking of pendingQueue as BookingRow[]) {
    if (!bookingsById.has(booking.id)) {
      bookingsById.set(booking.id, booking);
    }
  }
  for (const booking of upcomingBookings as BookingRow[]) {
    if (!bookingsById.has(booking.id)) bookingsById.set(booking.id, booking);
  }
  for (const booking of futureOrderLines as BookingRow[]) {
    if (!bookingsById.has(booking.id)) bookingsById.set(booking.id, booking);
  }

  const bookings = Array.from(bookingsById.values()).sort((a, b) => {
    const dateCompare = a.booking_date.localeCompare(b.booking_date);
    return dateCompare !== 0 ? dateCompare : a.start_time.localeCompare(b.start_time);
  });

  const orderIds = [...new Set(bookings.flatMap((b) => (b.order_id ? [b.order_id] : [])))];
  const orderStates = new Map<
    string,
    {
      status: string;
      paid: number;
      total: number;
    }
  >();
  if (orderIds.length > 0) {
    const admin = createAdminClient();
    const [{ data: summaries, error: summaryError }, { data: orders, error: ordersError }] =
      await Promise.all([
        admin
          .from("v_booking_order_financial_summaries")
          .select("order_id, total_payable, net_allocated, payment_state")
          .in("order_id", orderIds),
        admin.from("booking_orders").select("id, metadata").in("id", orderIds),
      ]);
    if (summaryError || ordersError) throw new Error("Could not load order payment status.");
    const quotes = new Map(
      (orders ?? []).map((order) => [
        order.id,
        Number((order.metadata as Record<string, unknown> | null)?.total_amount) || 0,
      ])
    );
    for (const summary of summaries ?? []) {
      if (!summary.order_id) continue;
      const payable = Number(summary.total_payable) || 0;
      const total = payable > 0 ? payable : (quotes.get(summary.order_id) ?? 0);
      orderStates.set(summary.order_id, {
        status: payable > 0 || total === 0 ? (summary.payment_state ?? "unpaid") : "unpaid",
        paid: Number(summary.net_allocated) || 0,
        total,
      });
    }
  }

  const resourceIds = [
    ...new Set(bookings.map((booking) => booking.resource_id).filter(Boolean) as string[]),
  ];
  const resourceNamesPromise = (async () => {
    const resourceNameMap = new Map<string, string>();
    if (resourceIds.length === 0) return resourceNameMap;
    const supabase = createAdminClient();
    const { data: resources } = await supabase
      .from("branch_resources")
      .select("id, name")
      .in("id", resourceIds);
    for (const resource of resources ?? []) {
      resourceNameMap.set(resource.id, resource.name);
    }
    return resourceNameMap;
  })();

  const hsBookingIds = bookings
    .filter((b) => b.type === "home_service" || b.delivery_type === "home_service")
    .map((b) => b.id);
  const driverIds = [...new Set(Object.values(driverIdMap).filter(Boolean) as string[])];
  const [resourceNameMap, trackingMap, driverNameMap] = await Promise.all([
    resourceNamesPromise,
    getActiveTrackingTokensForBookings(hsBookingIds),
    getDriverNamesByIds(driverIds),
  ]);

  const queueData: CradleFlowBooking[] = bookings.map((b) => {
    const meta = b.metadata ?? null;
    const hsAddr = meta?.home_service_address as Record<string, unknown> | null;
    const dispatch = meta?.dispatch as Record<string, unknown> | null;
    const staffScheduleException = getOpenStaffScheduleException(meta);
    const priceRaw = meta?.price_paid;
    const pricePaid = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : 0;
    const rawLat = hsAddr?.lat;
    const rawLng = hsAddr?.lng;
    const destLat =
      typeof rawLat === "number" ? rawLat : typeof rawLat === "string" ? parseFloat(rawLat) : null;
    const destLng =
      typeof rawLng === "number" ? rawLng : typeof rawLng === "string" ? parseFloat(rawLng) : null;
    const liveEta = parseLiveEta(dispatch?.live_eta);
    const isHomeService = b.type === "home_service" || b.delivery_type === "home_service";

    return {
      id: b.id,
      order_id: b.order_id ?? null,
      attendee_id: b.attendee_id ?? null,
      booking_attendees: b.booking_attendees ?? null,
      booking_orders: b.booking_orders ?? null,
      order_payment_status: b.order_id ? (orderStates.get(b.order_id)?.status ?? null) : null,
      order_amount_paid: b.order_id ? (orderStates.get(b.order_id)?.paid ?? null) : null,
      order_total_amount: b.order_id ? (orderStates.get(b.order_id)?.total ?? null) : null,
      branch_id: b.branch_id,
      booking_date: b.booking_date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      type: b.type,
      travel_buffer_mins: b.travel_buffer_mins,
      payment_status: b.payment_status,
      payment_method: b.payment_method,
      amount_paid: b.amount_paid,
      price_paid: pricePaid,
      payment_reference: b.payment_reference ?? null,
      customer_name: first(b.customers)?.full_name ?? null,
      customer_phone: first(b.customers)?.phone ?? null,
      service_name: first(b.services)?.name ?? null,
      service_duration: first(b.services)?.duration_minutes ?? null,
      staff_name: first(b.staff) ? getStaffAdminName(first(b.staff)!) : null,
      staff_id: first(b.staff)?.id ?? null,
      requested_staff_id: b.requested_staff_id ?? null,
      therapist_selection_source: b.therapist_selection_source ?? "legacy_unknown",
      resource_name: b.resource_id
        ? (resourceNameMap.get(b.resource_id) ?? first(b.branch_resources)?.name ?? null)
        : (first(b.branch_resources)?.name ?? null),
      booking_progress_status: b.booking_progress_status,
      checked_in_at: b.checked_in_at ?? null,
      session_started_at: b.session_started_at ?? null,
      session_due_at: b.session_due_at ?? null,
      session_completed_at: b.session_completed_at ?? null,
      created_at: b.created_at ?? null,
      resource_id: b.resource_id,
      delivery_type: b.delivery_type ?? null,
      metadata: meta,
      hs_zone: typeof hsAddr?.zone === "string" ? hsAddr.zone : null,
      hs_address: typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
      hs_city: typeof hsAddr?.city === "string" ? hsAddr.city : null,
      hs_map_url: typeof hsAddr?.map_url === "string" ? hsAddr.map_url : null,
      dispatch_warning:
        typeof dispatch?.dispatch_warning === "string" ? dispatch.dispatch_warning : null,
      needs_location_review: dispatch?.needs_location_review === true,
      needs_staff_schedule_review: Boolean(staffScheduleException),
      staff_schedule_exception_label: staffScheduleException?.reasonLabel ?? null,
      staff_schedule_exception_reason: staffScheduleException?.reasonCode ?? null,
      driver_id: driverIdMap[b.id] ?? b.driver_id ?? null,
      driver_name:
        first(b.driver)?.full_name ??
        (driverIdMap[b.id] ? (driverNameMap[driverIdMap[b.id]!] ?? null) : null),
      no_driver_warning: isHomeService && !(driverIdMap[b.id] ?? b.driver_id),
      last_location_at: locationMap[b.id]?.recorded_at ?? null,
      tracking_token: trackingMap[b.id]?.token ?? null,
      tracking_url: trackingMap[b.id]?.url ?? null,
      tracking_message: trackingMap[b.id]?.message ?? null,
      dest_lat: typeof destLat === "number" && Number.isFinite(destLat) ? destLat : null,
      dest_lng: typeof destLng === "number" && Number.isFinite(destLng) ? destLng : null,
      live_eta: liveEta,
    };
  });

  const readinessResult = readiness ?? buildReadinessResult([]);
  const readinessIssues = readinessResult.issues;
  const readinessStatus = readinessResult.status;

  return {
    queueData,
    snapshot,
    actionNotifications,
    readinessIssues,
    readinessStatus,
    readinessAvailable: readiness !== null,
  };
}
