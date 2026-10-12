import { getStaffWork } from "@/lib/staff-pwa/work-runtime";
import { getCrmMobileRuntime } from "@/lib/staff-pwa/crm-runtime";
import { CrmWorkList } from "@/components/features/staff-pwa/crm/crm-work-list";

export default async function StaffWorkPage() {
  const [work, runtime] = await Promise.all([
    getStaffWork(),
    getCrmMobileRuntime().catch(() => null),
  ]);
  return <CrmWorkList work={work} runtime={runtime} />;
}
