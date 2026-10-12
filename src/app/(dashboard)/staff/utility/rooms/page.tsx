import { redirect } from "next/navigation";
import { UtilityWorkList } from "@/components/features/staff-pwa/utility/utility-work-list";
import { getUtilityWorkspaceRuntime } from "@/lib/staff-pwa/utility-runtime";

export const metadata = { title: "Rooms | CradleHub Staff" };

export default async function UtilityRoomsPage() {
  const runtime = await getUtilityWorkspaceRuntime();
  if (!runtime) redirect("/staff/");
  return <UtilityWorkList runtime={runtime} mode="rooms" />;
}
