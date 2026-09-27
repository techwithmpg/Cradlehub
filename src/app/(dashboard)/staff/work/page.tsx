import { getStaffWork } from "@/lib/staff-pwa/work-runtime";
import { StaffWorkList } from "@/components/features/staff-pwa/staff-work-list";

export default async function StaffWorkPage() {
  const result = await getStaffWork();
  return <main className="mx-auto max-w-[480px] space-y-4 p-4">
    <h1 className="text-xl font-bold">Work</h1>
    <p className="text-sm text-stone-600">Today's booking attention, incoming bookings within 14 days, and open workflow / attendance issues. Actions are checked again in the operational workspace.</p>
    <StaffWorkList result={result} />
  </main>;
}
