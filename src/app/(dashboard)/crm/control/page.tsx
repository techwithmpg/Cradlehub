import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getTodaysSchedule, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { ControlConsolePage } from "@/components/features/control-console/control-console-page";
import { updateBookingPaymentAction, updateBookingStatusAction } from "@/app/(dashboard)/manager/bookings/actions";

async function getCrmContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const allowedRoles = ["owner", "manager", "crm", "csr", "csr_head", "csr_staff"];

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { branchId: mock.branch_id, branchName: mock.branches.name, role: mock.system_role };
  }

  if (!me || !allowedRoles.includes(me.system_role) || !me.branch_id) redirect("/login");

  return {
    branchId: me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
    role: me.system_role,
  };
}

function first<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function CrmControlPage() {
  const { branchId, branchName, role } = await getCrmContext();
  const today = new Date().toISOString().split("T")[0]!;

  const [rawBookings] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getDailyPaymentSummary(branchId, today).catch(() => null),
  ]);

  const bookings = rawBookings.map((b) => {
    const meta = (b as { metadata?: unknown }).metadata as Record<string, unknown> | null;
    const hsAddr = meta?.home_service_address as Record<string, unknown> | null;
    const dispatch = meta?.dispatch as Record<string, unknown> | null;
    const priceRaw = meta?.price_paid;
    const pricePaid = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : 0;

    return {
      id: b.id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      type: b.type,
      travel_buffer_mins: b.travel_buffer_mins,
      payment_status: (b as { payment_status?: string }).payment_status,
      payment_method: (b as { payment_method?: string }).payment_method,
      amount_paid: (b as { amount_paid?: number }).amount_paid,
      price_paid: pricePaid,
      payment_reference: (b as { payment_reference?: string | null }).payment_reference ?? null,
      customer_name: first(b.customers)?.full_name ?? null,
      service_name: first(b.services)?.name ?? null,
      service_duration: first(b.services)?.duration_minutes ?? null,
      staff_name: first(b.staff)?.full_name ?? null,
      resource_name: first((b as { branch_resources?: { name: string } | { name: string }[] | null }).branch_resources)?.name ?? null,
      booking_progress_status: (b as { booking_progress_status?: string }).booking_progress_status,
      hs_zone: typeof hsAddr?.zone === "string" ? hsAddr.zone : null,
      hs_address: typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
      hs_city: typeof hsAddr?.city === "string" ? hsAddr.city : null,
      hs_map_url: typeof hsAddr?.map_url === "string" ? hsAddr.map_url : null,
      dispatch_warning: typeof dispatch?.dispatch_warning === "string" ? dispatch.dispatch_warning : null,
      needs_location_review: dispatch?.needs_location_review === true,
    };
  });

  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ControlConsolePage
      branchName={branchName}
      todayLabel={todayLabel}
      viewerRole={role}
      workspaceLabel="Front-desk Operations"
      bookings={bookings}
      paymentAction={updateBookingPaymentAction}
      statusAction={updateBookingStatusAction}
    />
  );
}
