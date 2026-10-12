import { redirect } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import {
  getWorkspaceSwitchDestination,
  hasWorkspaceAccess,
} from "@/lib/auth/workspace-access";
import { getAllBranches } from "@/lib/queries/branches";
import { OwnerBookingsView } from "@/components/features/bookings/owner-bookings-view";
import {
  getOwnerWorkspaceBookingsAction,
} from "./actions";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

async function requireOwnerContext() {
  const access = await getCurrentUserWorkspaceAccess();
  if (!access) {
    if (isDevAuthBypassEnabled()) return;
    redirect("/login");
  }

  if (!hasWorkspaceAccess(access.workspaces, "owner")) {
    redirect(getWorkspaceSwitchDestination(access.workspaces));
  }
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
