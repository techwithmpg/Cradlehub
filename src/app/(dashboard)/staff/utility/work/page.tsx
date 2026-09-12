import { redirect } from "next/navigation";
import { UtilityWorkList } from "@/components/features/staff-pwa/utility/utility-work-list";

export const metadata = {
  title: "Room Turnover | CradleHub Staff",
};

export default async function UtilityWorkPage() {
  const {
    getUtilityWorkspaceRuntime,
  } = await import(
    "@/lib/staff-pwa/utility-runtime"
  );

  const today =
    new Date().toISOString().slice(0, 10);

  const runtime =
    await getUtilityWorkspaceRuntime(today);

  if (!runtime) {
    redirect("/staff");
  }

  return (
    <UtilityWorkList runtime={runtime} />
  );
}