import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getAllBranches } from "@/lib/queries/branches";
import { OwnerBookingsView } from "@/components/features/bookings/owner-bookings-view";
import {
  getOwnerWorkspaceBookingsAction,
} from "./actions";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

async function requireOwnerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isDevAuthBypassEnabled()) redirect("/login");
  if (!user) return;

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (me?.system_role !== "owner") redirect("/login");
}

export default async function OwnerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch?: string; status?: string; type?: string; search?: string }>;
}) {
  await requireOwnerContext();

  const params = await searchParams;
  const today  = new Date().toISOString().split("T")[0]!;
  const date   = params.date   ?? today;

  const [branchesResult, bookingsResult] = await Promise.all([
    getAllBranches(),
    getOwnerWorkspaceBookingsAction({
      date,
      branchId: params.branch  || undefined,
      status:   params.status  || undefined,
      type:     params.type    || undefined,
    }),
  ]);

  const bookings: WorkspaceBookingRow[] = "error" in bookingsResult ? [] : (bookingsResult.bookings as WorkspaceBookingRow[]);

  return (
    <RetainedWorkspaceModule moduleId="owner-bookings">
      <OwnerBookingsView
        initialBookings={bookings}
        initialDate={date}
        initialBranch={params.branch}
        initialStatus={params.status}
        initialType={params.type}
        initialSearch={params.search}
        branches={branchesResult}
      />
    </RetainedWorkspaceModule>
  );
}
