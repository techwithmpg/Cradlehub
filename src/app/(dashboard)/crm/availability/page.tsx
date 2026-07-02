import { PageHeader } from "@/components/features/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CrmAvailabilitySummary } from "@/components/features/crm/availability/crm-availability-summary";
import { CrmAvailabilityClient } from "@/components/features/crm/availability/crm-availability-client";
import { CheckInExplainer } from "@/components/features/crm/availability/checkin-explainer";
import { StartDayChecklist } from "@/components/features/crm/availability/start-day-checklist";
import { LiveAvailabilityImpactCard } from "@/components/features/crm/availability/live-availability-impact-card";
import { AvailabilityRelatedTools } from "@/components/features/crm/availability/availability-related-tools";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getCrmAvailabilitySnapshot, type CrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";
import { PageHelpDisclosure } from "@/components/shared/page-help-disclosure";
import { CrmTabNav, SCHEDULE_TABS } from "@/components/features/crm/crm-tab-nav";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

async function getPageData(branchId: string): Promise<{
  snapshot: CrmAvailabilitySnapshot | null;
  error: string | null;
}> {
  try {
    const snapshot = await getCrmAvailabilitySnapshot({
      branchId,
      date: getBranchBusinessDate(),
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
  const context = await getFrontDeskContext();
  const { snapshot, error } = await getPageData(context.branchId);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Staff Availability"
        description="Schedule-based staff availability and live booking readiness for today."
      />

      <CrmTabNav tabs={SCHEDULE_TABS} activeHref="/crm/availability" />

      {/* ── How this page works — collapsed by default ── */}
      <PageHelpDisclosure title="How live availability works">
        <CheckInExplainer />
      </PageHelpDisclosure>

      {error || !snapshot ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load availability</AlertTitle>
          <AlertDescription>{error ?? "Unknown error."}</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* KPI summary strip */}
          <CrmAvailabilitySummary summary={snapshot.summary} />

          {/* 4-tab workspace: Live Board, Staff List, Schedule Issues, Driver Readiness */}
          <CrmAvailabilityClient snapshot={snapshot} />
        </>
      )}

      {/* Start-of-day checklist — below the board */}
      <PageHelpDisclosure title="Start-of-day checklist">
        <StartDayChecklist />
      </PageHelpDisclosure>

      {/* What live check-in affects across booking flows */}
      <LiveAvailabilityImpactCard />

      {/* Footer links to related CRM tools */}
      <AvailabilityRelatedTools />
    </section>
  );
}
