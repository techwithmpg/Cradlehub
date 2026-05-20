import { PageHeader } from "@/components/features/dashboard/page-header";
import { StaffSchedulePageClient } from "@/components/features/staff-schedule/staff-schedule-page-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";

async function getPageData(branchId: string): Promise<{
  items: StaffScheduleItem[];
  error: string | null;
}> {
  try {
    const items = await getStaffWithAvailability(branchId);
    return { items: items as unknown as StaffScheduleItem[], error: null };
  } catch (err) {
    console.error("[crm/staff-availability] load failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { items: [], error: "Failed to load staff availability data. Please refresh." };
  }
}

export default async function CrmStaffAvailabilityPage() {
  const branchId = await getManagerBranchId();
  const { items, error } = await getPageData(branchId);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Schedule Setup"
        description="Set weekly working hours, day overrides, and blocked time for each staff member. These settings control when staff appear as bookable in the scheduling engine."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load staff data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <StaffSchedulePageClient items={items} />
      )}
    </section>
  );
}
