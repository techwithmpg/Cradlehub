import { notFound, redirect } from "next/navigation";
import { UtilityRoomDetail } from "@/components/features/staff-pwa/utility/utility-room-detail";
import { getUtilityWorkspaceRuntime } from "@/lib/staff-pwa/utility-runtime";
import { StaffFeedback, StaffScreen } from "@/components/features/staff-pwa/native-foundation";

export const metadata = { title: "Room turnover | CradleHub Staff" };

export default async function UtilityTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const runtime = await getUtilityWorkspaceRuntime();
  if (!runtime) redirect("/staff/");
  const item = [...runtime.turnoverItems, ...runtime.recentCompletedItems].find(
    (task) => task.taskId === taskId
  );
  if (!item && (runtime.queueError || runtime.historyError)) {
    return (
      <StaffScreen>
        <StaffFeedback error>
          Room turnover data is unavailable. No room state changed.
        </StaffFeedback>
      </StaffScreen>
    );
  }
  if (!item) notFound();
  return <UtilityRoomDetail item={item} staffId={runtime.staff.id} />;
}
