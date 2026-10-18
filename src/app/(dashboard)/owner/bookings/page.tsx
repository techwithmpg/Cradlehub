import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getAllBranches } from "@/lib/queries/branches";
import { OwnerBookingsView } from "@/components/features/bookings/owner-bookings-view";
import { getOwnerWorkspaceBookingsAction } from "./actions";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { ownerBookingsInitialRead } from "@/lib/owner/owner-bookings-query";

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
  searchParams: Promise<{
    date?: string;
    branch?: string | string[];
    status?: string;
    type?: string;
    search?: string;
  }>;
}) {
  await requireOwnerContext();

  const params = await searchParams;
  // Preserve the existing default date until a separately measured
  // business-date change is approved.
  const today = new Date().toISOString().split("T")[0]!;
  const date = params.date ?? today;
  const duplicateBranch = Array.isArray(params.branch);
  const branch = duplicateBranch ? undefined : params.branch;

  const [branches, result] = await Promise.all([
    getAllBranches(),
    duplicateBranch
      ? Promise.resolve({ error: "The selected branch is not available from this workspace." })
      : getOwnerWorkspaceBookingsAction({
          date,
          branchId: branch || undefined,
          status: params.status || undefined,
          type: params.type || undefined,
        }).catch(() => ({ error: "Bookings could not be loaded. Please retry." })),
  ]);

  return (
    <RetainedWorkspaceModule moduleId="owner-bookings">
      <OwnerBookingsView
        initialRead={ownerBookingsInitialRead(result)}
        initialDate={date}
        initialBranch={branch}
        initialStatus={params.status}
        initialType={params.type}
        initialSearch={params.search}
        branches={branches}
      />
    </RetainedWorkspaceModule>
  );
}
