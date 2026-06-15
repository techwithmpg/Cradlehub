import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/features/owner/dashboard/owner-dashboard";
import {
  getOwnerOverviewDashboardData,
  OwnerDashboardAccessError,
} from "@/lib/queries/owner-dashboard";

export const dynamic = "force-dynamic";

export default async function OwnerOverviewPage() {
  const data = await loadOwnerOverviewDashboardData();
  return <OwnerDashboard data={data} />;
}

async function loadOwnerOverviewDashboardData() {
  try {
    return await getOwnerOverviewDashboardData();
  } catch (error) {
    if (error instanceof OwnerDashboardAccessError) {
      redirect(error.destination);
    }
    throw error;
  }
}
