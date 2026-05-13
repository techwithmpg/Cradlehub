import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackingPageClient } from "@/components/features/tracking/tracking-page-client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Cradle Therapist Is On the Way",
  robots: { index: false, follow: false },
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function recordAccessSimple(linkId: string, currentCount: number): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("customer_tracking_links")
      .update({
        access_count: currentCount + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", linkId);
  } catch { /* non-critical */ }
}

type Props = { params: Promise<{ token: string }> };

export default async function TrackingPage({ params }: Props) {
  const { token } = await params;

  if (!token || token.length > 200) notFound();

  const supabase = createAdminClient();

  // ── 1. Validate token ──────────────────────────────────────────────────────
  const { data: link } = await supabase
    .from("customer_tracking_links")
    .select("id, booking_id, is_active, expires_at, access_count")
    .eq("token", token)
    .maybeSingle();

  const now = new Date();

  if (!link || !link.is_active || new Date(link.expires_at) <= now) {
    return <ExpiredPage />;
  }

  // ── 2. Fetch booking (safe fields only) ───────────────────────────────────
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, booking_date, start_time, status, type, delivery_type, booking_progress_status, metadata, staff_id, driver_id, service_id"
    )
    .eq("id", link.booking_id)
    .maybeSingle();

  if (!booking) return <ExpiredPage />;

  // Must be home-service and not cancelled/no_show
  const isHomeService =
    booking.type === "home_service" || booking.delivery_type === "home_service";

  if (!isHomeService || booking.status === "cancelled" || booking.status === "no_show") {
    return <ExpiredPage />;
  }

  // ── 3. Fetch supporting data in parallel ──────────────────────────────────
  const [serviceRes, therapistRes, driverRes, locationRes] = await Promise.all([
    supabase.from("services").select("name").eq("id", booking.service_id).maybeSingle(),
    supabase.from("staff").select("full_name").eq("id", booking.staff_id).maybeSingle(),
    booking.driver_id
      ? supabase.from("staff").select("full_name").eq("id", booking.driver_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("staff_location_snapshots")
      .select("lat, lng, recorded_at")
      .eq("booking_id", booking.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ── 4. Increment access count (non-blocking) ──────────────────────────────
  void recordAccessSimple(link.id, link.access_count);

  // ── 5. Extract safe data ──────────────────────────────────────────────────
  const meta = booking.metadata as Record<string, unknown> | null;
  const hsAddr = meta?.home_service_address as Record<string, unknown> | null;

  const destLat =
    typeof hsAddr?.lat === "number" ? hsAddr.lat :
    typeof hsAddr?.lat === "string" ? parseFloat(hsAddr.lat) : null;
  const destLng =
    typeof hsAddr?.lng === "number" ? hsAddr.lng :
    typeof hsAddr?.lng === "string" ? parseFloat(hsAddr.lng) : null;
  const destAddress =
    typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null;

  const dispatch = meta?.dispatch as Record<string, unknown> | null;
  // Prefer live_eta (Phase 10 Routes API refresh) over static dispatch estimates
  const liveEtaRaw = dispatch?.live_eta as Record<string, unknown> | null;
  const etaMinutes =
    typeof liveEtaRaw?.eta_minutes === "number"
      ? liveEtaRaw.eta_minutes
      : typeof dispatch?.travel_minutes_estimate === "number"
      ? dispatch.travel_minutes_estimate
      : typeof dispatch?.eta_minutes === "number"
      ? dispatch.eta_minutes
      : null;

  const progressStatus = (booking.booking_progress_status ?? "not_started") as string;
  const serviceName = serviceRes.data?.name ?? "Wellness Service";
  const therapistName = therapistRes.data?.full_name ?? null;
  const driverName = driverRes.data?.full_name ?? null;

  const initialLocation = locationRes.data
    ? {
        lat: Number(locationRes.data.lat),
        lng: Number(locationRes.data.lng),
        recorded_at: locationRes.data.recorded_at,
      }
    : null;

  // Completed booking — show ended state
  if (booking.status === "completed" || progressStatus === "completed") {
    return (
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          padding: "2rem 1.5rem",
          textAlign: "center",
          boxShadow: "0 1px 6px rgba(22,58,43,0.07)",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#065F46", marginBottom: 8, margin: 0 }}>
          Service Completed
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#6B7A6F", marginTop: 8 }}>
          Your session has ended. We hope you enjoyed your visit!
        </p>
        <p style={{ fontSize: "0.8125rem", color: "#9CA8A2", marginTop: 6 }}>
          {serviceName} · {formatDate(booking.booking_date)}
        </p>
      </div>
    );
  }

  // Display name: prefer therapist; fall back to driver
  const displayStaffName = therapistName ?? driverName;

  return (
    <TrackingPageClient
      token={token}
      serviceName={serviceName}
      bookingDateLabel={formatDate(booking.booking_date)}
      startTimeLabel={formatTime(booking.start_time)}
      progressStatus={progressStatus}
      bookingStatus={booking.status}
      therapistName={displayStaffName}
      destLat={destLat !== null && !isNaN(destLat) ? destLat : null}
      destLng={destLng !== null && !isNaN(destLng) ? destLng : null}
      destAddress={destAddress}
      etaMinutes={etaMinutes}
      initialLocation={initialLocation}
    />
  );
}

function ExpiredPage() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        padding: "2rem 1.5rem",
        textAlign: "center",
        boxShadow: "0 1px 6px rgba(22,58,43,0.07)",
      }}
    >
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔗</div>
      <h2
        style={{
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "#163A2B",
          margin: "0 0 8px",
        }}
      >
        Tracking link unavailable
      </h2>
      <p style={{ fontSize: "0.875rem", color: "#6B7A6F", margin: 0 }}>
        This link may have expired or is no longer active.
      </p>
      <p style={{ fontSize: "0.8125rem", color: "#9CA8A2", marginTop: 8 }}>
        Please contact us if you need assistance with your booking.
      </p>
    </div>
  );
}
