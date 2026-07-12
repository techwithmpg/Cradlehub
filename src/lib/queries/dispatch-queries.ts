import { createClient } from "@/lib/supabase/server";
import { getHomeServiceBranchRouteOrigin } from "@/lib/home-service/distance-service";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchAlert, DispatchStatus } from "@/features/dispatch/types";

export interface RealDispatchItem {
  id: string;
  number: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  serviceName: string;
  area: string | null;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  branchName: string | null;
  branchLat: number | null;
  branchLng: number | null;
  needsLocationReview: boolean;
  driverId: string | null;
  driverName: string | null;
  therapistId: string;
  therapistName: string | null;
  dispatchStatus: DispatchStatus;
  bookingStatus: string;
  bookingProgressStatus: string;
  paymentStatus: string;
  etaMinutes: number | null;
  travelStartedAt: string | null;
  arrivedAt: string | null;
  sessionStartedAt: string | null;
  completedAt: string | null;
  rating: null;
  currentLocation: { lat: number; lng: number; recorded_at: string } | null;
}

export interface DispatchStats {
  totalToday: number;
  awaitingDispatch: number;
  activeTrips: number;
  completedToday: number;
  cancelledToday: number;
}

export interface DispatchData {
  items: RealDispatchItem[];
  stats: DispatchStats;
  alerts: DispatchAlert[];
  today: string;
}

type OneOrMany<T> = T | T[] | null | undefined;

function first<T>(value: OneOrMany<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}


type DispatchBranchLocationRow = {
  name?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_embed_url?: string | null;
};

function numberOrNull(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseCoordinatesFromMapsUrl(value: string | null | undefined): { lat: number; lng: number } | null {
  if (!value) return null;

  const qMatch = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(value);
  if (qMatch) {
    const lat = Number(qMatch[1]);
    const lng = Number(qMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const atMatch = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(value);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}

function resolveBranchOrigin(branch: DispatchBranchLocationRow | null | undefined): {
  branchName: string | null;
  branchLat: number | null;
  branchLng: number | null;
} {
  if (!branch) {
    return { branchName: null, branchLat: null, branchLng: null };
  }

  const lat = numberOrNull(branch.latitude);
  const lng = numberOrNull(branch.longitude);

  if (lat !== null && lng !== null) {
    return {
      branchName: branch.name ?? "Branch",
      branchLat: lat,
      branchLng: lng,
    };
  }

  const fallback = parseCoordinatesFromMapsUrl(branch.maps_embed_url);
  if (fallback) {
    return {
      branchName: branch.name ?? "Branch",
      branchLat: fallback.lat,
      branchLng: fallback.lng,
    };
  }

  return {
    branchName: branch.name ?? "Branch",
    branchLat: null,
    branchLng: null,
  };
}
function computeDispatchStatus(
  bookingStatus: string,
  progressStatus: string | null,
  driverId: string | null,
  dispatchMetaStatus: string | null
): DispatchStatus {
  if (bookingStatus === "cancelled" || bookingStatus === "no_show") return "cancelled";
  if (bookingStatus === "completed" || progressStatus === "completed") return "completed";
  if (progressStatus === "session_started") return "service_started";
  if (progressStatus === "arrived") return "arrived_at_customer";
  if (progressStatus === "travel_started") return "in_route";
  if (!driverId) return "awaiting_driver";
  if (dispatchMetaStatus === "scheduled") return "scheduled";
  if (dispatchMetaStatus === "released_to_driver") return "released_to_driver";
  return "ready";
}

function timeAgoLabel(bookingDate: string, startTime: string): string {
  const diffMin = Math.round(
    (Date.now() - new Date(`${bookingDate}T${startTime}`).getTime()) / 60000
  );

  if (diffMin < 0) return `in ${Math.abs(diffMin)}m`;
  if (diffMin === 0) return "now";
  return `${diffMin}m ago`;
}

function computeAlerts(items: RealDispatchItem[]): DispatchAlert[] {
  const now = Date.now();
  const alerts: DispatchAlert[] = [];

  for (const item of items) {
    if (item.dispatchStatus === "completed" || item.dispatchStatus === "cancelled") continue;

    if (!item.driverId && item.dispatchStatus === "awaiting_driver") {
      alerts.push({
        id: `no-driver-${item.id}`,
        title: "No Driver Assigned",
        description: `${item.customerName} · ${item.serviceName} · ${formatTime12h(item.startTime)}`,
        timeAgo: timeAgoLabel(item.bookingDate, item.startTime),
        severity: "warning",
        dispatchNumber: item.number,
        bookingId: item.id,
      });
    }

    if (!item.lat || !item.lng || item.needsLocationReview) {
      alerts.push({
        id: `location-${item.id}`,
        title: "GPS Location Needed",
        description: `${item.customerName} · ${item.serviceName}`,
        timeAgo: "—",
        severity: "danger",
        dispatchNumber: item.number,
        bookingId: item.id,
      });
    }

    const appointmentMs = new Date(`${item.bookingDate}T${item.startTime}`).getTime();
    const minutesPast = (now - appointmentMs) / 60000;
    const notProgressed = ![
      "arrived_at_customer",
      "service_started",
      "completed",
      "cancelled",
      "scheduled",
    ].includes(item.dispatchStatus);

    if (minutesPast > 10 && notProgressed && item.dispatchStatus !== "awaiting_driver") {
      alerts.push({
        id: `delayed-${item.id}`,
        title: "Booking Running Late",
        description: `${item.customerName} · appointment at ${formatTime12h(item.startTime)} · ${Math.round(minutesPast)}m past`,
        timeAgo: `${Math.round(minutesPast)}m overdue`,
        severity: "danger",
        dispatchNumber: item.number,
        bookingId: item.id,
      });
    }
  }

  return alerts;
}

function computeStats(items: RealDispatchItem[]): DispatchStats {
  return {
    totalToday: items.filter((item) => item.dispatchStatus !== "cancelled").length,
    awaitingDispatch: items.filter((item) =>
      ["awaiting_driver", "ready", "scheduled"].includes(item.dispatchStatus)
    ).length,
    activeTrips: items.filter((item) =>
      ["released_to_driver", "in_route", "arrived_at_customer", "service_started"].includes(item.dispatchStatus)
    ).length,
    completedToday: items.filter((item) => item.dispatchStatus === "completed").length,
    cancelledToday: items.filter((item) => item.dispatchStatus === "cancelled").length,
  };
}

export interface GetDispatchDataArgs {
  branchId: string;
  date: string;
  role?: string;
  staffId?: string;
}

export async function getDispatchData(args: GetDispatchDataArgs): Promise<DispatchData> {
  const empty: DispatchData = {
    items: [],
    stats: computeStats([]),
    alerts: [],
    today: args.date,
  };

  try {
    const supabase = await createClient();
    const branchRouteOrigin = await getHomeServiceBranchRouteOrigin(args.branchId);
    let query = supabase
      .from("bookings")
      .select(
        `id, booking_date, start_time, end_time,
         status, booking_progress_status,
         driver_id, staff_id,
         payment_status, metadata,
         travel_started_at, arrived_at,
         session_started_at, completed_at,
         services ( name ),
         therapist:staff!staff_id ( id, full_name, nickname ),
         customers ( full_name ),
         branches ( name, latitude, longitude, maps_embed_url )`
      )
      .eq("branch_id", args.branchId)
      .eq("booking_date", args.date)
      .or("type.eq.home_service,delivery_type.eq.home_service")
      .order("start_time", { ascending: true })
      .limit(50);

    if (args.role === "driver" && args.staffId) {
      query = query.eq("driver_id", args.staffId);
    } else if (args.role === "therapist" && args.staffId) {
      query = query.eq("staff_id", args.staffId);
    }

    const { data: rawBookings, error: bookingsError } = await query;

    if (bookingsError || !rawBookings || rawBookings.length === 0) {
      return empty;
    }

    const bookingIds = rawBookings.map((booking) => booking.id);
    const driverIds = Array.from(
      new Set(
        rawBookings
          .map((booking) => booking.driver_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    const driversPromise =
      driverIds.length > 0
        ? supabase.from("staff").select("id, full_name, nickname").in("id", driverIds)
        : Promise.resolve({
            data: [] as { id: string; full_name: string; nickname: string | null }[],
            error: null,
          });

    const snapshotsPromise =
      bookingIds.length > 0
        ? supabase
            .from("staff_location_snapshots")
            .select("booking_id, lat, lng, recorded_at")
            .in("booking_id", bookingIds)
            .order("recorded_at", { ascending: false })
        : Promise.resolve({
            data: [] as { booking_id: string | null; lat: number; lng: number; recorded_at: string }[],
            error: null,
          });

    const [driversRes, snapshotsRes] = await Promise.all([driversPromise, snapshotsPromise]);

    const driverNameMap = new Map<string, string>();
    for (const driver of driversRes.data ?? []) {
      driverNameMap.set(driver.id, getStaffAdminName(driver));
    }

    const locationMap = new Map<string, { lat: number; lng: number; recorded_at: string }>();
    for (const snapshot of snapshotsRes.data ?? []) {
      if (!snapshot.booking_id || locationMap.has(snapshot.booking_id)) continue;

      locationMap.set(snapshot.booking_id, {
        lat: Number(snapshot.lat),
        lng: Number(snapshot.lng),
        recorded_at: snapshot.recorded_at,
      });
    }

    const mappedItems: RealDispatchItem[] = rawBookings.map((booking, index) => {
      const metadata = asRecord(booking.metadata);
      const homeServiceAddress = asRecord(metadata?.home_service_address);
      const dispatch = asRecord(metadata?.dispatch);

      const lat = readNumber(homeServiceAddress?.lat);
      const lng = readNumber(homeServiceAddress?.lng);
      const liveEta = parseLiveEta(dispatch?.live_eta);

      const dispatchMetaStatus = readString(dispatch?.status);
      const driverId = booking.driver_id ?? null;
      const therapistId = booking.staff_id ?? "";
      const bookingStatus = booking.status ?? "pending";
      const progressStatus = booking.booking_progress_status ?? null;

      const therapist = first(
        booking.therapist as OneOrMany<{ id: string; full_name: string; nickname?: string | null }>
      );
      const service = first(booking.services as OneOrMany<{ name: string }>);
      const customer = first(booking.customers as OneOrMany<{ full_name: string }>);
      const branch = first(
        booking.branches as OneOrMany<{
          name: string | null;
          latitude: number | string | null;
          longitude: number | string | null;
          maps_embed_url?: string | null;
        }>
      );
      const branchOrigin = resolveBranchOrigin(branch);

      const area =
        readString(homeServiceAddress?.zone) ??
        readString(homeServiceAddress?.barangay) ??
        readString(homeServiceAddress?.city);

      const dispatchStatus = computeDispatchStatus(
        bookingStatus,
        progressStatus,
        driverId,
        dispatchMetaStatus
      );

      return {
        id: booking.id,
        number: `#${String(index + 1).padStart(3, "0")}`,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        customerName: customer?.full_name ?? "Guest Customer",
        serviceName: service?.name ?? "—",
        area,
        formattedAddress: readString(homeServiceAddress?.full_address),
        lat,
        lng,
        branchName: branchOrigin.branchName ?? branchRouteOrigin?.branchName ?? null,
        branchLat: branchOrigin.branchLat ?? branchRouteOrigin?.lat ?? null,
        branchLng: branchOrigin.branchLng ?? branchRouteOrigin?.lng ?? null,
        needsLocationReview: dispatch?.needs_location_review === true,
        driverId,
        driverName: driverId ? driverNameMap.get(driverId) ?? null : null,
        therapistId,
        therapistName: therapist ? getStaffAdminName(therapist) : null,
        dispatchStatus,
        bookingStatus,
        bookingProgressStatus: progressStatus ?? "not_started",
        paymentStatus: booking.payment_status ?? "pending",
        etaMinutes: liveEta?.eta_minutes ?? readNumber(dispatch?.eta_minutes),
        travelStartedAt: booking.travel_started_at ?? null,
        arrivedAt: booking.arrived_at ?? null,
        sessionStartedAt: booking.session_started_at ?? null,
        completedAt: booking.completed_at ?? null,
        rating: null,
        currentLocation: locationMap.get(booking.id) ?? null,
      };
    });

    const items =
      args.role === "driver"
        ? mappedItems.filter((item) => item.dispatchStatus !== "scheduled")
        : mappedItems;

    return {
      items,
      stats: computeStats(items),
      alerts: computeAlerts(items),
      today: args.date,
    };
  } catch {
    return empty;
  }
}





