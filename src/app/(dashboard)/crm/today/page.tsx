import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCrmPendingBookingQueue, getTodaysSchedule } from "@/lib/queries/bookings";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getActionRequiredNotificationsAction } from "@/lib/notifications/queries";
import { getCrmTodaySnapshot } from "@/lib/queries/crm-today";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { buildReadinessResult } from "@/types/readiness";
import { CrmTodayShell } from "@/components/features/crm/today/crm-today-shell";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";

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
  travel_buffer_mins: number | null;
  payment_status?: string;
  payment_method?: string;
  amount_paid?: number;
  customers: Relation<CustomerRel>;
  services:  Relation<ServiceRel>;
  staff:     Relation<StaffRel>;
  branch_resources: Relation<ResourceRel>;
};

function first<T>(v: Relation<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getCsrContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const allowedRoles = ["owner", "manager", "assistant_manager", "store_manager", "crm", "csr", "csr_head", "csr_staff"];
  const devBypass = isDevAuthBypassEnabled();

  if (!me && devBypass) {
    const mock = getDevBypassLayoutStaff();
    return { branchId: mock.branch_id, branchName: mock.branches.name, role: mock.system_role };
  }

  if (!me || !allowedRoles.includes(me.system_role) || !me.branch_id) redirect("/login");

  return {
    branchId:   me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
    role:       me.system_role,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmTodayPage() {
  const { branchId, branchName, role } = await getCsrContext();
  const today   = new Date().toISOString().split("T")[0]!;

  const [rawBookings, pendingQueue, snapshot, actionNotifications, readiness] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getCrmPendingBookingQueue(branchId, today),
    getCrmTodaySnapshot({ branchId, date: today }),
    getActionRequiredNotificationsAction(3),
    getCrmReadinessCached(branchId).catch(() => null),
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

  // Build queue data for the interactive panel
  const queueData = bookings.map((b) => {
    const meta = (b as { metadata?: unknown }).metadata as Record<string, unknown> | null;
    const hsAddr = meta?.home_service_address as Record<string, unknown> | null;
    const dispatch = meta?.dispatch as Record<string, unknown> | null;
    const priceRaw = meta?.price_paid;
    const pricePaid = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : 0;
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
      customer_name:         first(b.customers)?.full_name ?? null,
      service_name:          first(b.services)?.name ?? null,
      service_duration:      first(b.services)?.duration_minutes ?? null,
      staff_name:            first(b.staff) ? getStaffAdminName(first(b.staff)!) : null,
      resource_name:         first(b.branch_resources)?.name ?? null,
      hs_zone:               typeof hsAddr?.zone === "string" ? hsAddr.zone : null,
      hs_address:            typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
      hs_city:               typeof hsAddr?.city === "string" ? hsAddr.city : null,
      hs_map_url:            typeof hsAddr?.map_url === "string" ? hsAddr.map_url : null,
      dispatch_warning:      typeof dispatch?.dispatch_warning === "string" ? dispatch.dispatch_warning : null,
      needs_location_review: dispatch?.needs_location_review === true,
    };
  });

  const upcoming = bookings.filter(
    (b) => b.booking_date === today && b.status === "confirmed"
  );
  const nextAppt = [...upcoming].sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const pendingBookingCount = queueData.filter((b) => isCrmPendingBookingStatus(b.status)).length;

  const roleLabel =
    role === "owner"             ? "Owner"
    : role === "manager"         ? "Manager"
    : role === "assistant_manager" ? "Asst. Manager"
    : role === "store_manager"   ? "Store Manager"
    : role === "csr_head"        ? "CSR Head"
    : "CSR Staff";

  const readinessResult = readiness ?? buildReadinessResult([]);
  const readinessIssues = readinessResult.issues;
  const readinessStatus = readinessResult.status;

  const dateLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <CrmTodayShell
      branchName={branchName}
      dateLabel={dateLabel}
      roleLabel={roleLabel}
      queueData={queueData}
      snapshot={snapshot}
      actionNotifications={actionNotifications}
      readinessIssues={readinessIssues}
      readinessStatus={readinessStatus}
      nextApptId={nextAppt?.id}
      pendingBookingCount={pendingBookingCount}
    />
  );
}
