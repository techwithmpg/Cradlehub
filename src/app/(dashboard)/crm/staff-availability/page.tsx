import { redirect } from "next/navigation";

export default function CrmStaffAvailabilityPage() {
  redirect("/crm/schedule?tab=setup");
}
