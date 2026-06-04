import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getDriverTodayTrips } from "@/lib/actions/driver-actions";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { DriverTripList } from "@/components/features/driver/driver-trip-list";
import { DriverMobileHome } from "@/components/features/driver/driver-mobile-home";
import { getStaffAdminName } from "@/lib/staff/display-name";

async function requireDriverRecord() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("id, full_name, nickname, branch_id, system_role, staff_type")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) {
    if (isDevAuthBypassEnabled()) {
      return {
        id: "00000000-0000-0000-0000-000000000000",
        full_name: "Dev Driver",
        nickname: null,
        branch_id: "00000000-0000-0000-0000-000000000000",
        system_role: "driver",
        staff_type: "driver",
      };
    }
    redirect("/login");
  }

  // Allow owner + driver roles; others go back to staff portal
  if (me.system_role !== "owner" && me.system_role !== "driver" && me.staff_type !== "driver") {
    redirect("/staff-portal");
  }

  return me;
}

function first<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function DriverPanelPage() {
  const me = await requireDriverRecord();
  const today = new Date().toISOString().split("T")[0]!;

  let trips: Awaited<ReturnType<typeof getDriverTodayTrips>> = [];
  let fetchError: string | null = null;

  try {
    trips = await getDriverTodayTrips(me.id, today);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to load trips";
  }

  // Normalise trips for the client component
  const normalised = trips.map((t) => {
    const meta = (t.metadata as Record<string, unknown> | null) ?? {};
    const hsAddr = (meta.home_service_address as Record<string, unknown> | null) ?? {};

    return {
      id: t.id,
      booking_date: t.booking_date,
      start_time: t.start_time,
      end_time: t.end_time,
      type: t.type as string,
      status: t.status,
      booking_progress_status: (t.booking_progress_status as string | null) ?? "not_started",
      travel_buffer_mins: t.travel_buffer_mins ?? null,
      travel_started_at: (t.travel_started_at as string | null) ?? null,
      arrived_at: (t.arrived_at as string | null) ?? null,
      session_started_at: (t.session_started_at as string | null) ?? null,
      session_completed_at: (t.session_completed_at as string | null) ?? null,
      service_name: first(t.services)?.name ?? "Service",
      service_duration: first(t.services)?.duration_minutes ?? null,
      customer_name: first(t.customers)?.full_name ?? "Customer",
      therapist_name: first((t.staff as unknown) as { id: string; full_name: string; nickname?: string | null } | { id: string; full_name: string; nickname?: string | null }[] | null)
        ? getStaffAdminName(
            first((t.staff as unknown) as { id: string; full_name: string; nickname?: string | null } | { id: string; full_name: string; nickname?: string | null }[] | null)!
          )
        : null,
      hs_address: typeof hsAddr.full_address === "string" ? hsAddr.full_address : null,
      hs_city: typeof hsAddr.city === "string" ? hsAddr.city : null,
      hs_zone: typeof hsAddr.zone === "string" ? hsAddr.zone : null,
      hs_map_url: typeof hsAddr.map_url === "string" ? hsAddr.map_url : null,
    };
  });

  return (
    <>
      {/* ── Desktop layout (md and above) ── */}
      <div className="hidden md:block">
        <PageHeader
          title="Driver Panel"
          description={`${getStaffAdminName(me)} · ${formatDate(new Date())}`}
          icon="🚗"
        />

        {fetchError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Error loading trips: {fetchError}
          </div>
        ) : null}

        <DriverTripList trips={normalised} />
      </div>

      {/* ── Mobile layout (below md) ── */}
      <div className="block md:hidden">
        <DriverMobileHome driver={me} trips={normalised} />
      </div>
    </>
  );
}
