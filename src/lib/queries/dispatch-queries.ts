import { createClient } from "@/lib/supabase/server";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchStatus, DispatchAlert } from "@/features/dispatch/types";

// ── Shared real data types ─────────────────────────────────────────────────────

export interface RealDispatchItem {
  id: string;
  number: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  serviceName: string;
  /** zone or city from metadata.home_service_address */
  area: string | null;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
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
  /** No rating system yet — always null */
  rating: null;
  /** Latest staff location snapshot for this booking */
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

// ── Internal helpers ───────────────────────────────────────────────────────────

type OneOrMany<T> = T | T[] | null;

function first<T>(v: OneOrMany<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function computeDispatchStatus(
  bookingStatus: string,
  progressStatus: string | null,
  driverId: string | null
): DispatchStatus {
  if (bookingStatus === "cancelled" || bookingStatus === "no_show") return "cancelled";
  if (bookingStatus === "completed" || progressStatus === "completed") return "completed";
  if (progressStatus === "session_started") return "service_started";
  if (progressStatus === "arrived") return "arrived_at_customer";
  if (progressStatus === "travel_started") return "in_route";
  if (!driverId) return "awaiting_driver";
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

    if (!item.formattedAddress || item.needsLocationReview) {
      alerts.push({
        id: `location-${item.id}`,
        title: "Location Needs Confirmation",
        description: `${item.customerName} · ${item.serviceName}`,
        timeAgo: "—",
        severity: "danger",
        dispatchNumber: item.number,
        bookingId: item.id,
      });
    }

    const appointmentMs = new Date(`${item.bookingDate}T${item.startTime}`).getTime();
    const minutesPast = (now - appointmentMs) / 60000;
    const notProgressed = !["arrived_at_customer", "service_started"].includes(item.dispatchStatus);
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
    totalToday: items.filter((i) => i.dispatchStatus !== "cancelled").length,
    awaitingDispatch: items.filter((i) => i.dispatchStatus === "awaiting_driver").length,
    activeTrips: items.filter((i) =>
      ["ready", "in_route", "arrived_at_customer", "service_started"].includes(i.dispatchStatus)
    ).length,
    completedToday: items.filter((i) => i.dispatchStatus === "completed").length,
    cancelledToday: items.filter((i) => i.dispatchStatus === "cancelled").length,
  };
}

// ── Main query ─────────────────────────────────────────────────────────────────

export interface GetDispatchDataArgs {
  branchId: string;
  date: string;
  /** For driver/therapist role: only return their own bookings */
  role?: string;
  staffId?: string;
}

export async function getDispatchData(args: GetDispatchDataArgs): Promise<DispatchData> {
  const empty = { items: [], stats: computeStats([]), alerts: [], today: args.date };
  try {
    const supabase = await createClient();

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
         customers ( full_name )`
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
    if (bookingsError) {
      console.error("[dispatch] getDispatchData bookings query failed", {
        branchId: args.branchId,
        date: args.date,
        error: bookingsError.message,
      });
      return empty;
    }

    if (!rawBookings || rawBookings.length === 0) return empty;

    const bookingIds = rawBookings.map((b) => b.id);

    const driverIds = [
      ...new Set(
        rawBookings
          .map((b) => (b as { driver_id?: string | null }).driver_id)
          .filter((id): id is string => typeof id === "string")
      ),
    ];

    const [driversRes, snapshotsRes] = await Promise.all([
      driverIds.length > 0
        ? supabase.from("staff").select("id, full_name, nickname").in("id", driverIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; nickname: string | null }[] }),
      supabase
        .from("staff_location_snapshots")
        .select("booking_id, lat, lng, recorded_at")
        .in("booking_id", bookingIds)
        .order("recorded_at", { ascending: false }),
    ]);

    const driverNameMap: Record<string, string> = {};
    for (const d of driversRes.data ?? []) {
      driverNameMap[d.id] = getStaffAdminName(d);
    }

    const locationMap: Record<string, { lat: number; lng: number; recorded_at: string }> = {};
    for (const snap of snapshotsRes.data ?? []) {
      if (snap.booking_id && !locationMap[snap.booking_id]) {
        locationMap[snap.booking_id] = {
          lat: Number(snap.lat),
          lng: Number(snap.lng),
          recorded_at: snap.recorded_at,
        };
      }
    }

    const items: RealDispatchItem[] = rawBookings.map((b, idx) => {
      const meta = (b as { metadata?: unknown }).metadata as Record<string, unknown> | null;
      const hsAddr = meta?.home_service_address as Record<string, unknown> | null;
      const dispatch = meta?.dispatch as Record<string, unknown> | null;

      const rawLat = hsAddr?.lat;
      const rawLng = hsAddr?.lng;
      const lat =
        typeof rawLat === "number" ? rawLat :
        typeof rawLat === "string" ? parseFloat(rawLat) : null;
      const lng =
        typeof rawLng === "number" ? rawLng :
        typeof rawLng === "string" ? parseFloat(rawLng) : null;

      const driverId = (b as { driver_id?: string | null }).driver_id ?? null;
      const staffIdVal = (b as { staff_id?: string }).staff_id ?? "";
      const liveEta = parseLiveEta(dispatch?.live_eta);
      const needsLocationReview = dispatch?.needs_location_review === true;

      const bookingStatus = b.status ?? "pending";
      const progressStatus =
        (b as { booking_progress_status?: string | null }).booking_progress_status ?? null;
      const dispatchStatus = computeDispatchStatus(bookingStatus, progressStatus, driverId);

      const therapist = first(
        (b as { therapist?: OneOrMany<{ id: string; full_name: string; nickname?: string | null }> }).therapist
      );
      const service = first(
        (b as { services?: OneOrMany<{ name: string }> }).services
      );
      const customer = first(
        (b as { customers?: OneOrMany<{ full_name: string }> }).customers
      );

      const area =
        typeof hsAddr?.zone === "string" && hsAddr.zone
          ? hsAddr.zone
          : typeof hsAddr?.city === "string" && hsAddr.city
          ? hsAddr.city
          : null;

      return {
        id: b.id,
        number: `#${String(idx + 1).padStart(3, "0")}`,
        bookingDate: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time,
        customerName: customer?.full_name ?? "Guest Customer",
        serviceName: service?.name ?? "—",
        area,
        formattedAddress:
          typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
        lat: lat !== null && !isNaN(lat) ? lat : null,
        lng: lng !== null && !isNaN(lng) ? lng : null,
        needsLocationReview,
        driverId,
        driverName: driverId ? (driverNameMap[driverId] ?? null) : null,
        therapistId: staffIdVal,
        therapistName: therapist ? getStaffAdminName(therapist) : null,
        dispatchStatus,
        bookingStatus,
        bookingProgressStatus: progressStatus ?? "not_started",
        paymentStatus: (b as { payment_status?: string }).payment_status ?? "pending",
        etaMinutes: liveEta?.eta_minutes ?? null,
        travelStartedAt: (b as { travel_started_at?: string | null }).travel_started_at ?? null,
        arrivedAt: (b as { arrived_at?: string | null }).arrived_at ?? null,
        sessionStartedAt: (b as { session_started_at?: string | null }).session_started_at ?? null,
        completedAt: (b as { completed_at?: string | null }).completed_at ?? null,
        rating: null,
        currentLocation: locationMap[b.id] ?? null,
      };
    });

    return {
      items,
      stats: computeStats(items),
      alerts: computeAlerts(items),
      today: args.date,
    };
  } catch (error) {
    console.error("[dispatch] getDispatchData failed", {
      branchId: args.branchId,
      date: args.date,
      error: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }
}
