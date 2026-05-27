import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getTodaysSchedule, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { CrmBookingsView } from "@/components/features/bookings/crm-bookings-view";
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

  const [bookings, cashSummary] = await Promise.all([
    getTodaysSchedule(branchId, date),
    getDailyPaymentSummary(branchId, date),
  ]);

  const initialData = {
    branchId,
    branchName,
    role,
    date,
    // Cast: getTodaysSchedule returns metadata as unknown; WorkspaceBookingRow
    // expects Record<string,unknown>|null|undefined. The values are compatible.
    bookings: bookings as WorkspaceBookingRow[],
    cashSummary,
  };

  return (
    <CrmBookingsView
      initialData={initialData}
      paymentAction={updateBookingPaymentAction}
      confirmPaymentAction={confirmBookingPaymentAction}
    />
  );
}
