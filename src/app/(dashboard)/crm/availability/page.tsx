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
import { SystemReadinessBar } from "@/components/shared/system-readiness-bar";
import { PageHelpDisclosure } from "@/components/shared/page-help-disclosure";
import { buildAvailabilityReadinessIssues } from "@/components/features/crm/availability/availability-readiness-utils";
import { buildReadinessResult } from "@/types/readiness";

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

  // Build readiness issues from the snapshot summary for the compact bar
  const availabilityIssues = snapshot
    ? buildAvailabilityReadinessIssues(snapshot.summary)
    : [];
  const availabilityReadiness = buildReadinessResult(availabilityIssues);

  return (
    <section className="space-y-5">
      {/* ── Compact readiness bar ── */}
      <SystemReadinessBar
        issues={availabilityIssues}
        status={availabilityReadiness.status}
        label="Live Readiness"
      />

      <PageHeader
        title="Staff Availability"
        description="Schedule-based staff availability and live booking readiness for today."
      />

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
