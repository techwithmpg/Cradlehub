import { NotificationSettingsDialog } from "@/components/features/notifications/notification-settings-dialog";
import { getStaffNotices } from "@/lib/staff-pwa/notices-runtime";
import { StaffNoticesList } from "@/components/features/staff-pwa/staff-notices-list";

export default async function StaffNoticesPage() {
  const result = await getStaffNotices();
  return <main className="mx-auto max-w-[480px] space-y-4 p-4">
    <h1 className="text-xl font-bold">Notices</h1>
    <NotificationSettingsDialog role="staff" />
    <p className="text-sm text-stone-600">Current updates for your work. Attendance actions remain in Attendance.</p>
    {result.error ? <p role="alert">{result.error}</p>
      : result.items.length ? <StaffNoticesList items={result.items} /> : <p>No current notices.</p>}
  </main>;
}
