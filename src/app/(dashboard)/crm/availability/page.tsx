import { PageHeader } from "@/components/features/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CrmAvailabilitySummary } from "@/components/features/crm/availability/crm-availability-summary";
import { CrmAvailabilityClient } from "@/components/features/crm/availability/crm-availability-client";
import { CheckInExplainer } from "@/components/features/crm/availability/checkin-explainer";
import { StartDayChecklist } from "@/components/features/crm/availability/start-day-checklist";
import { LiveAvailabilityImpactCard } from "@/components/features/crm/availability/live-availability-impact-card";
import { AvailabilityRelatedTools } from "@/components/features/crm/availability/availability-related-tools";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getCrmAvailabilitySnapshot, type CrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function getPageData(branchId: string): Promise<{
  snapshot: CrmAvailabilitySnapshot | null;
  error: string | null;
}> {
  try {
    const snapshot = await getCrmAvailabilitySnapshot({
      branchId,
      date: todayDateString(),
    });
    return { snapshot, error: null };
  } catch (err) {
    console.error("[crm/availability] load failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { snapshot: null, error: "Failed to load availability data. Please refresh." };
  }
}

export default async function CrmAvailabilityPage() {
  const branchId = await getManagerBranchId();
  const { snapshot, error } = await getPageData(branchId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Live Availability & Check-In Center"
        description="Manage same-day staff readiness, check-ins, check-outs, and live availability for walk-ins, in-house bookings, and dispatch operations."
      />

      {/* How each booking flow uses availability and check-in data */}
      <CheckInExplainer />

      {error || !snapshot ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load availability</AlertTitle>
          <AlertDescription>{error ?? "Unknown error."}</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Quick-glance health stats (computed from snapshot — no extra query) */}
          <CrmAvailabilitySummary summary={snapshot.summary} />

          {/* 4-tab workspace: Live Board, Staff List, Schedule Issues, Driver Readiness */}
          <CrmAvailabilityClient snapshot={snapshot} />
        </>
      )}

      {/* Start-of-day action checklist */}
      <StartDayChecklist />

      {/* What live check-in affects across booking flows */}
      <LiveAvailabilityImpactCard />

      {/* Footer links to related CRM tools */}
      <AvailabilityRelatedTools />
    </section>
  );
}
