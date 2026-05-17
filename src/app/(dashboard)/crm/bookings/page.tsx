import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getTodaysSchedule, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { BookingsWorkspace } from "@/components/features/bookings/bookings-workspace";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { confirmBookingPaymentAction } from "./actions";

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

  if (!me?.branch_id || !allowedRoles.includes(me.system_role)) redirect("/login");

  return {
    branchId:   me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
    role:       me.system_role,
  };
}

export default async function CrmBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; type?: string; highlight?: string; search?: string; bookingId?: string }>;
}) {
  const { branchId, branchName, role } = await getCrmContext();
  const params = await searchParams;
  const today  = new Date().toISOString().split("T")[0]!;

  // When navigating from a notification link, resolve the booking's date
  const bookingId = params.bookingId;
  let date = params.date ?? today;

  if (bookingId && !params.date) {
    const supabase = await createClient();
    const { data: ref } = await supabase
      .from("bookings")
      .select("booking_date")
      .eq("id", bookingId)
      .maybeSingle();
    if (ref?.booking_date) date = ref.booking_date;
  }

  const [rawBookings, cashSummary] = await Promise.all([
    getTodaysSchedule(branchId, date),
    getDailyPaymentSummary(branchId, date),
  ]);

  let bookings = rawBookings as WorkspaceBookingRow[];
  if (params.status) bookings = bookings.filter((b) => b.status === params.status);
  if (params.type)   bookings = bookings.filter((b) => b.type   === params.type);

  return (
    <BookingsWorkspace
      workspaceContext="crm"
      viewerRole={role}
      branchName={branchName}
      date={date}
      statusFilter={params.status}
      typeFilter={params.type}
      search={params.search}
      bookings={bookings}
      cashSummary={cashSummary}
      paymentAction={updateBookingPaymentAction}
      initialSelectedId={bookingId}
      confirmPaymentAction={confirmBookingPaymentAction}
    />
  );
}
